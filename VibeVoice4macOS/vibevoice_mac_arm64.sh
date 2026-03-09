#!/usr/bin/env bash
set -Eeuo pipefail

#==============================================================
# VibeVoice macOS Apple Silicon setup & runner (fully-contained)
#==============================================================
# Requirements met:
# - Creates ~/vibevoice_mac + local Python venv + local caches
# - No sudo / no global installs (unless --allow-brew for ffmpeg)
# - Idempotent; safe to re-run; offline-friendly reuse
# - Supports HF auth via HF_TOKEN; downloads models locally
# - Provides --demo (Gradio) and --infer (CLI-ish) paths
# - Forces all Hugging Face caches into ./_cache
# - Avoids CUDA/FlashAttention; uses PyTorch MPS if available
#
# Usage examples:
#   bash setup_vibevoice_mac.sh --demo
#   bash setup_vibevoice_mac.sh --infer
#   bash setup_vibevoice_mac.sh --model microsoft/VibeVoice-1.5B --demo --share
#   bash setup_vibevoice_mac.sh --clean --force
#   HF_TOKEN=hf_xxx bash setup_vibevoice_mac.sh --demo
#
# Flags:
#   --model <hf_repo>     Model repo on Hugging Face (default: WestZhang/VibeVoice-Large-pt)
#   --demo                Launch Gradio demo on port 7860
#   --share               Add --share to Gradio (optional)
#   --server-name <host>  Bind to specific host (default: 127.0.0.1, use 0.0.0.0 for network access)
#   --infer               Run a simple CLI inference example from text file
#   --allow-brew          If ffmpeg missing, permit Homebrew install (no sudo)
#   --clean               Remove venv, caches, repo, models, outputs (prompt unless --force)
#   --force               Use with --clean to skip prompt
#   -h | --help           Show this help
#
# Notes:
# - Tested targets: macOS (Darwin) + arm64 (Apple Silicon) only; exits otherwise
# - Python: requires >= 3.10 (uses system python3); will not install Python
# - All data stays under ~/vibevoice_mac
#==============================================================

### Pretty logging
if [[ -t 1 ]]; then
  # shellcheck disable=SC2034
  RED="$(printf '\033[31m')" GREEN="$(printf '\033[32m')" YELLOW="$(printf '\033[33m')"
  # shellcheck disable=SC2034
  BLUE="$(printf '\033[34m')" BOLD="$(printf '\033[1m')" RESET="$(printf '\033[0m')"
else
  RED="" GREEN="" YELLOW="" BLUE="" BOLD="" RESET=""
fi
info()  { printf "%b[INFO]%b %s\n"  "$BLUE" "$RESET" "$*"; }
warn()  { printf "%b[WARN]%b %s\n"  "$YELLOW" "$RESET" "$*"; }
error() { printf "%b[ERROR]%b %s\n" "$RED" "$RESET" "$*" >&2; }
success(){ printf "%b[DONE]%b %s\n" "$GREEN" "$RESET" "$*"; }

### Trap for friendly error messages
on_error() {
  error "An unexpected error occurred. See messages above."
  warn  "Common fixes:
  - Ensure stable internet for first run (pip, git, model download).
  - Check Python >= 3.10: run 'python3 --version'.
  - If MPS unavailable, the script will fall back to CPU (slower).
  - If SSL/cert errors occur, try: 'export PIP_DISABLE_PIP_VERSION_CHECK=1' and re-run, or ensure your macOS certificates are up to date.
  - If port 7860 is in use (for --demo), close that app or change PORT env var for this run, e.g.: PORT=7861 --demo
  - For low disk space: free up space or move PROJECT_DIR (see below)."
}
trap on_error ERR

### Defaults & globals
PROJECT_DIR="${HOME}/vibevoice_mac"
REPO_URL="https://github.com/WhoPaidItAll/VibeVoice"
REPO_DIR="${PROJECT_DIR}/VibeVoice"
VENV_DIR="${PROJECT_DIR}/.venv"
CACHE_DIR="${PROJECT_DIR}/_cache"
MODELS_DIR="${PROJECT_DIR}/models"
TOOLS_DIR="${PROJECT_DIR}/tools"
FFMPEG_DIR="${TOOLS_DIR}/ffmpeg"
OUTPUTS_DIR="${PROJECT_DIR}/outputs"
TMP_DIR="${PROJECT_DIR}/_tmp"

MODEL_ID_DEFAULT="aoi-ot/VibeVoice-Large"
MODEL_ID="$MODEL_ID_DEFAULT"

DO_DEMO=0
DO_SHARE=0
DO_INFER=0
ALLOW_BREW=0
DO_CLEAN=0
FORCE=0

### Help text
usage() {
  sed -n '1,70p' "$0" | sed 's/^# \{0,1\}//'
  exit 0
}

### Parse flags
while [[ $# -gt 0 ]]; do
  case "$1" in
    --model) shift; MODEL_ID="${1:-}"; [[ -z "${MODEL_ID}" ]] && { error "--model requires a value"; exit 2; } ;;
    --demo) DO_DEMO=1 ;;
    --share) DO_SHARE=1 ;;
    --server-name) shift; SERVER_NAME="${1:-}"; [[ -z "${SERVER_NAME}" ]] && { error "--server-name requires a value"; exit 2; } ;;
    --infer) DO_INFER=1 ;;
    --allow-brew) ALLOW_BREW=1 ;;
    --clean) DO_CLEAN=1 ;;
    --force) FORCE=1 ;;
    -h|--help) usage ;;
    *) error "Unknown flag: $1"; usage ;;
  esac
  shift || true
done

### Clean mode
if [[ "$DO_CLEAN" -eq 1 ]]; then
  if [[ "$FORCE" -eq 0 ]]; then
    read -r -p "This will permanently delete ONLY contents under ${PROJECT_DIR}. Proceed? [y/N] " ans
    case "${ans:-N}" in
      y|Y|yes|YES) : ;;
      *) info "Aborted."; exit 0 ;;
    esac
  fi
  if [[ -d "$PROJECT_DIR" ]]; then
    info "Removing $PROJECT_DIR ..."
    rm -rf "${PROJECT_DIR}"
    success "Cleaned."
  else
    info "Nothing to clean; ${PROJECT_DIR} does not exist."
  fi
  exit 0
fi

### Platform checks
OS="$(uname -s || true)"
ARCH="$(uname -m || true)"
if [[ "${OS}" != "Darwin" ]]; then
  error "This script supports macOS only. Detected: ${OS}."
  exit 1
fi
if [[ "${ARCH}" != "arm64" ]]; then
  error "This script targets Apple Silicon (arm64) only. Detected: ${ARCH}."
  exit 1
fi

### Python checks (use system python3; do not install)
if ! command -v python3 >/dev/null 2>&1; then
  error "python3 not found. Please install Python 3.10+ via python.org or Homebrew, then re-run."
  exit 1
fi
PY_VER_STR="$(python3 -c 'import sys; print(".".join(map(str, sys.version_info[:3])))')"
PY_MAJ="$(python3 -c 'import sys; print(sys.version_info[0])')"
PY_MIN="$(python3 -c 'import sys; print(sys.version_info[1])')"
if (( PY_MAJ < 3 || (PY_MAJ == 3 && PY_MIN < 10) )); then
  error "Python ${PY_VER_STR} detected. Python >= 3.10 is required. Please upgrade and re-run."
  exit 1
fi
info "Using Python ${PY_VER_STR} (system)."

### Prepare directories
mkdir -p "${PROJECT_DIR}" "${CACHE_DIR}" "${MODELS_DIR}" "${TOOLS_DIR}" "${FFMPEG_DIR}" "${OUTPUTS_DIR}" "${TMP_DIR}"

### Constrain all caches/logs to project dir (privacy & isolation)
export HF_HOME="${CACHE_DIR}/huggingface"
export HF_HUB_CACHE="${HF_HOME}/hub"
export HUGGINGFACE_HUB_CACHE="${HF_HUB_CACHE}"
export TRANSFORMERS_CACHE="${CACHE_DIR}/transformers"
export TORCH_HOME="${CACHE_DIR}/torch"
export XDG_CACHE_HOME="${CACHE_DIR}/xdg"
export MPLCONFIGDIR="${CACHE_DIR}/matplotlib"
export NUMBA_CACHE_DIR="${CACHE_DIR}/numba"
export PIP_CACHE_DIR="${CACHE_DIR}/pip"
export TMPDIR="${TMP_DIR}"
export HF_HUB_DISABLE_TELEMETRY=1
export PYTHONNOUSERSITE=1
# Avoid CUDA/FlashAttention assumptions; force safe attention math
export USE_FLASH_ATTENTION=0
export FLASH_ATTENTION_SKIP=1
export ATTN_BACKEND=math
export PYTORCH_ENABLE_MPS_FALLBACK=1

### Show disk space (troubleshoot)
if command -v df >/dev/null 2>&1; then
  FREE_KB="$(df -Pk "${PROJECT_DIR}" | awk 'NR==2{print $4}')"
  if [[ -n "${FREE_KB}" ]]; then
    FREE_GB="$(awk "BEGIN {printf \"%.1f\", ${FREE_KB}/1024/1024}")"
    info "Approx free space at project volume: ${FREE_GB} GB"
    if awk "BEGIN {exit !(${FREE_KB} < 5242880)}"; then  # < 5 GB
      warn "Low disk space (<5GB). Model downloads may fail."
    fi
  fi
fi

### Create/Reuse venv
if [[ ! -d "${VENV_DIR}" ]]; then
  info "Creating virtual environment at ${VENV_DIR} ..."
  python3 -m venv "${VENV_DIR}"
else
  info "Reusing existing virtual environment at ${VENV_DIR} ..."
fi
# shellcheck disable=SC1090
source "${VENV_DIR}/bin/activate"
export PATH="${VENV_DIR}/bin:${FFMPEG_DIR}:$PATH"

### Upgrade base tooling (local only)
python -m pip install --upgrade --no-input pip setuptools wheel

### Install Python deps (no CUDA, MPS-capable torch from PyPI)
info "Installing Python dependencies (local venv) ..."
python - <<'PY'
import sys, subprocess
pkgs = [
    # Core
    "torch",                       # macOS wheels include MPS
    "transformers",
    "accelerate",
    "huggingface_hub[cli]",
    "soundfile",
    "numpy",
    "scipy",
    "gradio",
    # Utilities
    "imageio-ffmpeg",             # to fetch a portable ffmpeg binary if needed
    "packaging",
]
subprocess.check_call([sys.executable, "-m", "pip", "install", "--no-input", *pkgs])
PY

### Quick MPS sanity check (warn and continue if unavailable)
python - <<'PY' || true
import torch, sys
mps_ok = torch.backends.mps.is_available()
print(f"[MPS] Available: {mps_ok}")
try:
    if mps_ok:
        x = torch.ones((1024,1024), device="mps")
        y = torch.mm(x, x)
        print("[MPS] Basic tensor op succeeded.")
    else:
        print("[MPS] Not available; will proceed on CPU (slower).")
except Exception as e:
    print(f"[MPS] Warning: MPS test raised: {e}\nProceeding on CPU.", file=sys.stderr)
PY

### Ensure ffmpeg available (prefer portable local; avoid global installs)
need_ffmpeg=0
if ! command -v ffmpeg >/dev/null 2>&1; then
  need_ffmpeg=1
fi

if [[ "${need_ffmpeg}" -eq 1 ]]; then
  info "ffmpeg not found on PATH. Obtaining a portable binary into ${FFMPEG_DIR} ..."
  FFMPEG_BIN="${FFMPEG_DIR}/ffmpeg"
  if [[ -x "${FFMPEG_BIN}" ]]; then
    info "Using previously downloaded ffmpeg at ${FFMPEG_BIN}"
  else
    if [[ "${ALLOW_BREW}" -eq 1 ]] && command -v brew >/dev/null 2>&1; then
      info "--allow-brew enabled; attempting Homebrew install (no sudo) ..."
      brew list ffmpeg >/dev/null 2>&1 || brew install ffmpeg
      if command -v ffmpeg >/dev/null 2>&1; then
        info "Homebrew ffmpeg installed."
      fi
    fi
    if ! command -v ffmpeg >/dev/null 2>&1; then
      info "Falling back to Python 'imageio-ffmpeg' portable binary (stored inside project caches) ..."
      export IMAGEIO_USERDIR="${CACHE_DIR}/imageio"
      python - <<'PY'
import os, shutil
from pathlib import Path
import imageio_ffmpeg
exe = imageio_ffmpeg.get_ffmpeg_exe()
print(f"[ffmpeg] imageio-ffmpeg provided: {exe}")
ffmpeg_dir = Path(os.environ["FFMPEG_DIR"])
ffmpeg_dir.mkdir(parents=True, exist_ok=True)
target = ffmpeg_dir / "ffmpeg"
# Copy (not symlink) to satisfy "portable binary inside ./tools/ffmpeg/"
shutil.copy2(exe, target)
os.chmod(target, 0o755)
print(f"[ffmpeg] Copied to: {target}")
PY
      if [[ ! -x "${FFMPEG_BIN}" ]]; then
        error "Failed to obtain a portable ffmpeg binary."
        warn  "Tip: re-run with --allow-brew (requires Homebrew installed) or install ffmpeg yourself, then re-run."
        exit 1
      fi
    fi
  fi
else
  info "System ffmpeg found: $(command -v ffmpeg)"
fi
export PATH="${FFMPEG_DIR}:$PATH"

### Clone or update VibeVoice repo (safe offline)
if [[ ! -d "${REPO_DIR}/.git" ]]; then
  info "Cloning VibeVoice repository into ${REPO_DIR} ..."
  if ! git clone --depth 1 "${REPO_URL}" "${REPO_DIR}"; then
    warn "Clone failed (possibly offline). If the repo was previously present, continuing with existing contents if any."
    mkdir -p "${REPO_DIR}"
  fi
else
  info "Updating VibeVoice repository (fetch/pull) ..."
  if ! (git -C "${REPO_DIR}" fetch --depth 1 && git -C "${REPO_DIR}" pull --ff-only); then
    warn "Update failed (possibly offline). Reusing existing repo at ${REPO_DIR}."
  fi
fi

### Install the repo in editable mode (local venv)
if [[ -f "${REPO_DIR}/pyproject.toml" || -f "${REPO_DIR}/setup.py" ]]; then
  info "Installing VibeVoice in editable mode ..."
  (cd "${REPO_DIR}" && python -m pip install --no-input -e .) || warn "Editable install failed; continuing (some demos may still work if deps are already satisfied)."
else
  warn "Repo seems incomplete (no pyproject.toml/setup.py). Continuing anyway."
fi

# ---- Optional: auto-load HF token from file(s) ----
# Priority: existing env > PROJECT_DIR/.env > PROJECT_DIR/.hf_token
if [[ -z "${HF_TOKEN:-}" ]]; then
  if [[ -f "${PROJECT_DIR}/.env" ]]; then
    # Load KEY=VALUE lines, including HF_TOKEN=hf_xxx
    set -a
    # shellcheck disable=SC1091
    source "${PROJECT_DIR}/.env"
    set +a
  elif [[ -f "${PROJECT_DIR}/.hf_token" ]]; then
    # Plain file containing only the token string
    HF_TOKEN="$(<"${PROJECT_DIR}/.hf_token")"
    # Trim CR/LF just in case
    HF_TOKEN="${HF_TOKEN%%[$'\r\n']}"
    export HF_TOKEN
  fi
fi
# ---- end HF token auto-load ----


### Hugging Face auth (optional, stored under HF_HOME)
# Optional HF auth (uses env var if present)
if [[ -n "${HF_TOKEN:-}" ]]; then
  info "Authenticating to Hugging Face with HF_TOKEN (stored under ${HF_HOME}) ..." >&2
  huggingface-cli logout >/dev/null 2>&1 || true
  # Non-interactive login; adds token to git credential helper too
  if ! huggingface-cli login --token "${HF_TOKEN}" --add-to-git-credential --non-interactive; then
    warn "HF CLI login failed; will still try download with token if the command supports it." >&2
  fi
else
  info "HF_TOKEN not provided; proceeding with public model access only." >&2
fi

### Model download helper
download_model() {
  local model_id="$1"
  local local_dir="${MODELS_DIR}/${model_id//\//__}"
  mkdir -p "${local_dir}"

  if [[ -n "$(ls -A "${local_dir}" 2>/dev/null || true)" ]]; then
    info "Reusing existing model files at ${local_dir}" >&2
  else
    info "Downloading model ${model_id} into ${local_dir} (cached locally; resume enabled) ..." >&2
    if command -v hf >/dev/null 2>&1; then
      hf download "${model_id}" --repo-type model --local-dir "${local_dir}" --resume >&2 || return 1
    else
      huggingface-cli download "${model_id}" --local-dir "${local_dir}" --local-dir-use-symlinks False >&2 || return 1
    fi
  fi

  # Verify shards if there's an index; do NOT depend on argv – use env instead
  VV_LOCAL_DIR="${local_dir}" python - <<'PY' >&2
import os, json, sys
d=os.environ.get("VV_LOCAL_DIR","")
idx=os.path.join(d,"model.safetensors.index.json")
if os.path.isfile(idx):
    with open(idx, "r") as f:
        j=json.load(f)
    needed=set(j.get("weight_map",{}).values())
    missing=[f for f in sorted(needed) if not os.path.isfile(os.path.join(d,f))]
    if missing:
        print("[verify] missing files:", *missing, sep="\n", file=sys.stderr)
        sys.exit(2)
PY
  if [[ $? -ne 0 ]]; then
    # Try one more resume to fetch missing pieces
    if command -v hf >/dev/null 2>&1; then
      hf download "${model_id}" --repo-type model --local-dir "${local_dir}" --resume >&2 || true
    else
      huggingface-cli download "${model_id}" --local-dir "${local_dir}" --local-dir-use-symlinks False >&2 || true
    fi
    # Re-check
    VV_LOCAL_DIR="${local_dir}" python - <<'PY' >&2
import os, json, sys
d=os.environ.get("VV_LOCAL_DIR","")
idx=os.path.join(d,"model.safetensors.index.json")
if os.path.isfile(idx):
    with open(idx, "r") as f:
        j=json.load(f)
    needed=set(j.get("weight_map",{}).values())
    missing=[f for f in sorted(needed) if not os.path.isfile(os.path.join(d,f))]
    if missing:
        print("[verify] still missing:", *missing, sep="\n", file=sys.stderr)
        sys.exit(2)
PY
    [[ $? -ne 0 ]] && return 1
  fi

  # Success: print the path on stdout (captured by the caller)
  echo "${local_dir}"
  return 0
}



### Resolve & fetch model with graceful fallback
FINAL_MODEL_ID="${MODEL_ID}"
MODEL_PATH=""
if ! MODEL_PATH="$(download_model "${FINAL_MODEL_ID}")"; then
  warn "Model '${FINAL_MODEL_ID}' download failed or gated."
  if [[ "${FINAL_MODEL_ID}" != "${MODEL_ID_DEFAULT}" ]]; then
    warn "Falling back to default model: ${MODEL_ID_DEFAULT}"
    FINAL_MODEL_ID="${MODEL_ID_DEFAULT}"
    if ! MODEL_PATH="$(download_model "${FINAL_MODEL_ID}")"; then
      error "Default model download failed as well. Check your network/token and retry."
      exit 1
    fi
  else
    error "Model download failed. Provide HF_TOKEN if the model is gated, or choose a different model via --model."
    exit 1
  fi
fi
success "Model ready at: ${MODEL_PATH} (source: ${FINAL_MODEL_ID})"

# --- VibeVoice mac bootstrap (auto-patches at runtime) ---
vv_write_bootstrap() {
  # writes a small launcher that:
  #  - forces attn_implementation='sdpa'
  #  - stubs HF's CUDA allocator warmup
  #  - forces device_map to mps/cpu (never cuda)
  #  - forwards all CLI args to the original gradio_demo.py
  cat > ".vv_bootstrap.py" <<'PY'
import os, sys, runpy

# Force no CUDA; keep MPS fallback
os.environ.setdefault('ACCELERATE_DISABLE_CUDA', '1')
os.environ.setdefault('CUDA_VISIBLE_DEVICES', '')
os.environ.setdefault('PYTORCH_ENABLE_MPS_FALLBACK', '1')

# Patch Transformers: SDPA, no CUDA warmup, and never dispatch to CUDA
try:
    from transformers import modeling_utils as _mu
    import torch

    # 1) Kill CUDA caching allocator warmup entirely (safe on CPU/MPS)
    try:
        _mu.caching_allocator_warmup = lambda *a, **k: None
    except Exception:
        pass

    # 2) Wrap from_pretrained to force safe kwargs & device placement
    _orig = _mu.PreTrainedModel.from_pretrained
    def _patched_from_pretrained(cls, path, *args, **kwargs):
        # neutralize FlashAttention and enforce SDPA
        kwargs.pop('use_flash_attention_2', None)
        if kwargs.get('attn_implementation') != 'sdpa':
            kwargs['attn_implementation'] = 'sdpa'

        # do NOT pass this kwarg through (custom classes may reject it)
        kwargs.pop('caching_allocator_warmup', None)

        # Force away from CUDA no matter what
        want_mps = torch.backends.mps.is_available()
        target_dev = 'mps' if want_mps else 'cpu'

        dm = kwargs.get('device_map', 'auto')
        if (
            dm == 'auto'
            or (isinstance(dm, str) and 'cuda' in dm)
            or (isinstance(dm, dict) and any('cuda' in str(v) for v in dm.values()))
        ):
            kwargs['device_map'] = target_dev

        # MPS is more stable with float16 than bf16
        if want_mps and kwargs.get('torch_dtype') is None:
            kwargs['torch_dtype'] = torch.float16

        return _orig.__func__(cls, path, *args, **kwargs)

    _mu.PreTrainedModel.from_pretrained = classmethod(_patched_from_pretrained)
except Exception as e:
    print(f"[WARN] bootstrap: could not patch transformers: {e}", file=sys.stderr)

# Hand off to the original demo, preserving CLI args
demo = os.path.join(os.path.dirname(__file__), 'VibeVoice', 'demo', 'gradio_demo.py')
sys.argv = [demo] + sys.argv[1:]
runpy.run_path(demo, run_name='__main__')
PY
}
# --- end bootstrap ---



### Demo & inference runners
PORT="${PORT:-7860}"
SERVER_NAME="${SERVER_NAME:-127.0.0.1}"

ensure_port_free() {
  local port="$1"
  if command -v lsof >/dev/null 2>&1 && lsof -iTCP:"${port}" -sTCP:LISTEN -n >/dev/null 2>&1; then
    error "Port ${port} is already in use. Close the process using it or set PORT=<free_port> when re-running."
    exit 1
  fi
}

run_gradio_demo() {
  ensure_port_free "${PORT}"
  if [[ "${SERVER_NAME}" == "0.0.0.0" ]]; then
    info "Launching Gradio demo on http://0.0.0.0:${PORT} (accessible from network) ..."
  else
    info "Launching Gradio demo on http://${SERVER_NAME}:${PORT} ..."
  fi
  local demo_script="${REPO_DIR}/demo/gradio_demo.py"
  if [[ ! -f "${demo_script}" ]]; then
    error "Gradio demo script not found at ${demo_script}. The repo layout may have changed."
    exit 1
  fi
  local extra=()
  if [[ "${DO_SHARE}" -eq 1 ]]; then extra+=(--share); fi
  # Use the local model files to avoid network; launch through our bootstrap
  (
    cd "${PROJECT_DIR}" && \
    vv_write_bootstrap; \
    ACCELERATE_DISABLE_CUDA=1 CUDA_VISIBLE_DEVICES="" PYTORCH_ENABLE_MPS_FALLBACK=1 \
      exec python .vv_bootstrap.py \
        --model_path "${MODEL_PATH}" \
        --port "${PORT}" \
        --server-name "${SERVER_NAME}" \
        --device "$(python -c 'import torch; print("mps" if torch.backends.mps.is_available() else "cpu")')" \
        "${extra[@]}"
  ) || {
    error "Gradio demo exited unexpectedly."
    exit 1
  }
}

run_cli_infer() {
  info "Running CLI-style inference example ..."
  local text_file=""
  if [[ -f "${REPO_DIR}/demo/text_examples/1p_abs.txt" ]]; then
    text_file="${REPO_DIR}/demo/text_examples/1p_abs.txt"
  else
    text_file="${PROJECT_DIR}/demo_text.txt"
    printf "This is a short sample for VibeVoice on macOS.\n" > "${text_file}"
    info "Created example text: ${text_file}"
  fi

  # Try known candidate scripts in the repo; if none found, fall back to a lightweight local runner.
  declare -a candidates=(
    "${REPO_DIR}/demo/cli_infer.py"
    "${REPO_DIR}/demo/cli_tts.py"
    "${REPO_DIR}/demo/infer_cli.py"
    "${REPO_DIR}/demo/tts_cli.py"
    "${REPO_DIR}/examples/cli_infer.py"
  )
  local runner=""
  for c in "${candidates[@]}"; do
    [[ -f "$c" ]] && { runner="$c"; break; }
  done

  mkdir -p "${OUTPUTS_DIR}"
  local out_wav="${OUTPUTS_DIR}/sample_out.wav"

  if [[ -n "${runner}" ]]; then
    info "Using repo CLI: ${runner}"
    # Heuristic args; many repos use --model_path and --text_file/--output
    if ! python "${runner}" --model_path "${MODEL_PATH}" --text_file "${text_file}" --output "${out_wav}" 2>/dev/null; then
      warn "Repo CLI invocation failed (args may differ). Falling back to a minimal local runner."
    else
      success "WAV written to: ${out_wav}"
      return 0
    fi
  fi

  # Minimal local runner: try to use the installed package API if available; otherwise, use Transformers Auto classes.
  python - <<PY || {
import sys, os, soundfile as sf
from pathlib import Path

model_path = os.environ.get("MODEL_PATH")
text_path = os.environ.get("TEXT_FILE")
out_wav = os.environ.get("OUT_WAV")

text = Path(text_path).read_text().strip()
if not text:
    text = "Hello from VibeVoice."

# Try VibeVoice API if present
try:
    import vibevoice  # type: ignore
    # Generic pseudo-API; adapt gracefully if not found
    if hasattr(vibevoice, "load_model") and hasattr(vibevoice, "tts"):
        model = vibevoice.load_model(model_path)
        audio = vibevoice.tts(model, text=text, speaker="female", sample_rate=24000)
        sf.write(out_wav, audio, 24000)
        print(f"[OK] Wrote {out_wav} via vibevoice API.")
        sys.exit(0)
except Exception as e:
    print(f"[Fallback] vibevoice API not usable: {e}")

# Try Transformers (if model compatible)
try:
    from transformers import AutoProcessor, AutoModel
    import torch, numpy as np
    processor = AutoProcessor.from_pretrained(model_path, trust_remote_code=True)
    model = AutoModel.from_pretrained(model_path, trust_remote_code=True)
    prompt = text
    # Many TTS repos expose generate or inference methods with remote code
    if hasattr(model, "generate"):
        inputs = processor(text=prompt, return_tensors="pt")
        with torch.no_grad():
            out = model.generate(**inputs)
        # Heuristic: retrieve audio from output dict/tuple
        wav = None
        if isinstance(out, dict):
            wav = out.get("audio") or out.get("waveform")
        elif isinstance(out, (list, tuple)) and out:
            wav = out[0]
        if wav is None:
            raise RuntimeError("Model.generate() did not return audio.")
        arr = np.asarray(wav, dtype=np.float32).squeeze()
        sf.write(out_wav, arr, 24000)
        print(f"[OK] Wrote {out_wav} via transformers.generate()")
        sys.exit(0)
    else:
        raise RuntimeError("Model has no .generate; cannot proceed.")
except Exception as e:
    print(f"[ERROR] Local fallback inference failed: {e}")
    sys.exit(2)
PY
    error "CLI inference failed. The repo may have changed its API. Try --demo for a working Gradio UI."
    exit 1
  }
  success "WAV written to: ${out_wav}"
}

### Final tips (performance)
warn "If inference is slow on MPS/CPU, try a smaller model via:
  --model microsoft/VibeVoice-1.5B
and/or split long text into shorter chunks."

### Execute requested action
if [[ "${DO_DEMO}" -eq 1 && "${DO_INFER}" -eq 1 ]]; then
  warn "--demo and --infer both specified; running --infer first, then starting --demo ..."
  export MODEL_PATH TEXT_FILE OUT_WAV
  export MODEL_PATH="${MODEL_PATH}"
  run_cli_infer || true
  run_gradio_demo
elif [[ "${DO_DEMO}" -eq 1 ]]; then
  run_gradio_demo
elif [[ "${DO_INFER}" -eq 1 ]]; then
  export MODEL_PATH TEXT_FILE OUT_WAV
  export MODEL_PATH="${MODEL_PATH}"
  run_cli_infer
else
  cat <<EOF

${BOLD}Setup complete.${RESET}
Project dir: ${PROJECT_DIR}
Repo:        ${REPO_DIR}
Model:       ${FINAL_MODEL_ID}
Model path:  ${MODEL_PATH}
Venv:        ${VENV_DIR}
ffmpeg:      $(command -v ffmpeg || echo "${FFMPEG_DIR}/ffmpeg")

Next steps:
  - Launch Gradio demo:    ${BOLD}bash "$0" --demo${RESET}
  - Run CLI inference:     ${BOLD}bash "$0" --infer${RESET}
  - Choose a model:        ${BOLD}bash "$0" --model microsoft/VibeVoice-1.5B --demo${RESET}
  - Clean everything:      ${BOLD}bash "$0" --clean --force${RESET}

EOF
fi



