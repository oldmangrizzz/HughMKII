# VibeVoice4macOS — VibeVoice on Apple Silicon (macOS)

This fork adds a **one-file, self-contained setup & runner** for the full VibeVoice-Large [VibeVoice](https://github.com/WhoPaidItAll/VibeVoice) so you can launch the Gradio demo or do simple CLI inference **locally on macOS Apple Silicon**—no CUDA, no sudo, no global installs.

> ✅ Apple Silicon (arm64) + Python ≥ 3.10

> ✅ Everything sandboxed under `~/vibevoice_mac`

> ✅ Uses PyTorch **MPS** when available (otherwise CPU)

> ✅ Resumes & verifies large sharded model downloads

> ✅ Optional Hugging Face token auto-loaded from `~/vibevoice_mac/.env` or `.hf_token`

---
<img width="1517" height="932" alt="image" src="https://github.com/user-attachments/assets/3e4aa10e-8b36-4eb4-b72c-f761ab0fbfd7" />

---

## What’s included in this fork

* `vibevoice_mac_arm64.sh` — the all-in-one installer/runner for macOS:

  * Creates a local venv
  * Clones the upstream repo
  * Downloads the chosen model with resume & shard verification
  * Provides a portable `ffmpeg` if needed (or `--allow-brew`)
  * Runs the **official** Gradio demo via a bootstrap that:

    * forces **SDPA** attention (avoids FlashAttention)
    * **never** dispatches to CUDA
    * prefers **MPS** on Apple GPUs

> Upstream model code, demos, and assets remain under their original directories; this script only orchestrates a Mac-friendly setup.

---

## Requirements

* macOS on **Apple Silicon** (`arm64`)
* **Python 3.10+** available as `python3`
* Internet for first run (pip, git, model download)
* Several GB of free disk (models can be large)

---

## Quick start

```bash
# 1) Clone your fork (this repo)
git clone https://github.com/<your-username>/vi-voice4mac.git
cd vi-voice4mac

# 2) Make the script executable
chmod +x vibevoice_mac_arm64.sh

# 3) (Recommended) Add your Hugging Face token once
mkdir -p ~/vibevoice_mac
printf 'HF_TOKEN=hf_your_token_here\n' > ~/vibevoice_mac/.env

# 4) Run the Gradio demo (default model; local UI on port 7860)
bash vibevoice_mac_arm64.sh --demo

# 5) Share the demo publicly (Gradio share URL)
bash vibevoice_mac_arm64.sh --demo --share

# 6) Try a smaller model if the Large one is heavy
bash vibevoice_mac_arm64.sh --model microsoft/VibeVoice-1.5B --demo
```

---

## Hugging Face token (for gated/private models)

The script automatically picks a token from:

1. Existing env (`HF_TOKEN`)
2. `~/vibevoice_mac/.env` (e.g. `HF_TOKEN=hf_xxx`)
3. `~/vibevoice_mac/.hf_token` (file containing only the token string)

Examples:

```bash
# One-time setup (preferred)
mkdir -p ~/vibevoice_mac
cat > ~/vibevoice_mac/.env <<'EOF'
HF_TOKEN=hf_your_token_here
EOF

# Or pass inline per run
HF_TOKEN=hf_your_token_here bash vibevoice_mac_arm64.sh --demo
```

> **Never commit your token.** It lives outside the repo by default.

---

## Basic usage

### Launch Gradio demo

```bash
# Default model: aoi-ot/VibeVoice-Large
bash vibevoice_mac_arm64.sh --demo

# Public sharing
bash vibevoice_mac_arm64.sh --demo --share

# Different model
bash vibevoice_mac_arm64.sh --model microsoft/VibeVoice-1.5B --demo
```

### CLI-style inference

```bash
bash vibevoice_mac_arm64.sh --infer
# Output: ~/vibevoice_mac/outputs/sample_out.wav
```

### Clean everything

```bash
bash vibevoice_mac_arm64.sh --clean --force
```

### Useful env/flags

```bash
# Change the demo port
PORT=7861 bash vibevoice_mac_arm64.sh --demo

# Allow Homebrew ffmpeg (if missing)
bash vibevoice_mac_arm64.sh --allow-brew --demo
```

---

## Models (quick guide)

| Model               | Context | Generation | Link                                                                                                 |
| ------------------- | ------: | ---------: | ---------------------------------------------------------------------------------------------------- |
| **VibeVoice-1.5B**  |     64K |   \~90 min | [https://huggingface.co/microsoft/VibeVoice-1.5B](https://huggingface.co/microsoft/VibeVoice-1.5B)   |
| **VibeVoice-Large** |     32K |   \~45 min | [https://huggingface.co/microsoft/VibeVoice-Large](https://huggingface.co/microsoft/VibeVoice-Large) |

* Default in this script: `aoi-ot/VibeVoice-Large` (change via `--model ...`)
* Some models are **gated/private** → you’ll need a valid **HF token**

---

## What the script does (under the hood)

* Creates **`~/vibevoice_mac`** with:

  * `.venv/` (local Python virtualenv)
  * `_cache/` (HF/Torch/Transformers caches)
  * `models/` (downloaded model files)
  * `tools/ffmpeg/ffmpeg` (portable binary if needed)
  * `VibeVoice/` (upstream repo)
  * `outputs/` (audio from CLI path)
* Pins all HF caches inside the project folder (no global cache usage).
* Verifies shard completeness from `model.safetensors.index.json` and **resumes** if any pieces are missing.
* Bootstraps the demo to **force SDPA** and **avoid CUDA** on macOS.

---

## Troubleshooting

* **401 / “Repository Not Found” / gated model**
  Add a valid **HF token** (see token section above) and make sure the model grants your account access.

* **Missing shard error (e.g., `model-00002-of-00010.safetensors`)**
  Re-run the script; downloads resume and shards are re-verified. Also check you have enough free disk space.

* **“Torch not compiled with CUDA enabled”**
  Expected on macOS. The script never tries CUDA and forces SDPA/MPS/CPU.

* **Port already in use**
  `PORT=7861 bash vibevoice_mac_arm64.sh --demo`

* **ffmpeg not found**
  Script provides a portable `ffmpeg`; or pass `--allow-brew` to install via Homebrew.

---

## Notes & tips

* **Performance**: MPS is faster than CPU, but still slower than high-end NVIDIA GPUs. For smoother UX, try `--model microsoft/VibeVoice-1.5B`.
* **Attention backend**: The demo code prefers FlashAttention on CUDA; this fork **forces SDPA** (safe on MPS/CPU). Audio quality may differ from CUDA+FA2 runs.

---

## Responsible use (risks & limitations)

High-quality synthetic speech can be misused (impersonation, fraud, disinformation). Use responsibly and comply with all applicable laws and policies. Disclose AI-generated content where appropriate.

Other known limitations (from upstream notes):

* English/Chinese are the strongest languages; others may be unstable.
* Cross-lingual transfer can be inconsistent.
* Spontaneous music/background sounds may appear depending on prompts.
* No explicit support for overlapping speech.

This project is intended for research & experimentation.

---

## Acknowledgements

* **Upstream**: [WhoPaidItAll/VibeVoice](https://github.com/WhoPaidItAll/VibeVoice)
* Hugging Face ecosystem (transformers, accelerate, huggingface\_hub)
* PyTorch MPS on Apple Silicon

---

## License

* The **vibevoice\_mac\_arm64.sh** helper script in this fork: MIT (or match upstream—add a `LICENSE` file accordingly).
* **VibeVoice** code/models: their respective upstream licenses & model cards apply.

---

### Repository layout

```
.
├─ vibevoice_mac_arm64.sh    # ← this script (macOS setup & runner)
├─ VibeVoice/                # upstream repo code (cloned by the script at runtime)
└─ README.md                 # this file
```

> The runtime sandbox (`~/vibevoice_mac/`) is created on first run and contains your venv, caches, models, token files, etc. It’s outside the repo so you don’t accidentally commit huge files or secrets.
