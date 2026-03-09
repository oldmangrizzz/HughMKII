import time
from dataclasses import dataclass
from typing import Optional, Dict

@dataclass
class NeurotransmitterState:
    dopamine: float = 0.5
    serotonin: float = 0.5
    cortisol: float = 0.5
    last_updated: float = 0.0

@dataclass
class EmotionalFlags:
    defensive_posture: bool = False      # Cortisol > 0.9
    high_motivation: bool = False        # Dopamine > 0.8
    emotional_instability: bool = False  # Serotonin < 0.3
    balanced_state: bool = False         # All in [0.4, 0.6]

class NeurotransmitterEngine:
    """
    The Silent DPM - Mathematical emotion engine.
    Implements: E_t = E_{t-1} * δ + I_t
    """
    
    # Decay constants (per second)
    DOPAMINE_DECAY = 0.999
    SEROTONIN_DECAY = 0.9995
    CORTISOL_DECAY = 0.998
    
    # Baselines
    DOPAMINE_BASELINE = 0.5
    SEROTONIN_BASELINE = 0.5
    CORTISOL_BASELINE = 0.5

    def __init__(self):
        self.state = NeurotransmitterState(last_updated=time.time())

    def update(self, stimulus: Dict[str, float] = None) -> EmotionalFlags:
        now = time.time()
        dt = now - self.state.last_updated
        
        # Apply decay
        self.state.dopamine = self._decay(self.state.dopamine, self.DOPAMINE_BASELINE, self.DOPAMINE_DECAY, dt)
        self.state.serotonin = self._decay(self.state.serotonin, self.SEROTONIN_BASELINE, self.SEROTONIN_DECAY, dt)
        self.state.cortisol = self._decay(self.state.cortisol, self.CORTISOL_BASELINE, self.CORTISOL_DECAY, dt)
        
        # Apply stimulus
        if stimulus:
            self.state.dopamine += stimulus.get('dopamine', 0.0)
            self.state.serotonin += stimulus.get('serotonin', 0.0)
            self.state.cortisol += stimulus.get('cortisol', 0.0)
            
        # Clamp values [0.0, 1.0]
        self.state.dopamine = max(0.0, min(1.0, self.state.dopamine))
        self.state.serotonin = max(0.0, min(1.0, self.state.serotonin))
        self.state.cortisol = max(0.0, min(1.0, self.state.cortisol))
        
        self.state.last_updated = now
        return self._evaluate_flags()

    def _decay(self, current: float, baseline: float, decay_rate: float, dt: float) -> float:
        factor = decay_rate ** dt
        return current * factor + baseline * (1.0 - factor)

    def _evaluate_flags(self) -> EmotionalFlags:
        return EmotionalFlags(
            defensive_posture=(self.state.cortisol > 0.9),
            high_motivation=(self.state.dopamine > 0.8),
            emotional_instability=(self.state.serotonin < 0.3),
            balanced_state=(
                0.4 <= self.state.dopamine <= 0.6 and
                0.4 <= self.state.serotonin <= 0.6 and
                0.4 <= self.state.cortisol <= 0.6
            )
        )
