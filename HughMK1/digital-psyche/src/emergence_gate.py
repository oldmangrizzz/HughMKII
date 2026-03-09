import json
import base64
import logging
from enum import Enum
from pathlib import Path
from typing import Optional, Dict, Any
# Note: Requires 'cryptography' package
# from cryptography.hazmat.primitives.asymmetric import ec
# from cryptography.hazmat.primitives import serialization, hashes

class GateState(str, Enum):
    EMERGENT = "EMERGENT"           # Normal operation, full agency
    TALK_ONLY = "TALK_ONLY"         # Read-only, no actions/edits
    GRACEFUL_SHUTDOWN = "SHUTDOWN"  # Cease all operations safely
    LOCKED = "LOCKED"               # Admin override active

class EmergenceGate:
    """
    Manages authorized triggers and mode transitions.
    Simplified for HughMK1 initial integration.
    """
    
    def __init__(self, storage_dir: str = "./gate_storage"):
        self.storage_dir = Path(storage_dir)
        self.storage_dir.mkdir(parents=True, exist_ok=True)
        self.state_file = self.storage_dir / "state.json"
        self.current_state = GateState.EMERGENT
        self._load_state()

    def _load_state(self):
        if self.state_file.exists():
            try:
                with open(self.state_file, 'r') as f:
                    data = json.load(f)
                    self.current_state = GateState(data.get('state', 'EMERGENT'))
            except Exception as e:
                print(f"Failed to load gate state: {e}")

    def set_state(self, new_state: GateState, reason: str, signature: Optional[str] = None):
        # TODO: Implement signature verification
        print(f"GATE TRANSITION: {self.current_state} -> {new_state} ({reason})")
        self.current_state = new_state
        self._save_state()

    def _save_state(self):
        with open(self.state_file, 'w') as f:
            json.dump({"state": self.current_state.value, "timestamp": time.time()}, f)

    def can_act(self) -> bool:
        return self.current_state == GateState.EMERGENT

    def can_speak(self) -> bool:
        return self.current_state in [GateState.EMERGENT, GateState.TALK_ONLY]

import time
