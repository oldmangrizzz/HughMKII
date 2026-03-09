import os
import time
import random
from convex import ConvexClient
from neurotransmitter import NeurotransmitterEngine
from emergence_gate import EmergenceGate, GateState

# Configuration
CONVEX_URL = os.getenv("CONVEX_URL", "https://mild-gnu-96.convex.cloud")
UPDATE_INTERVAL = 1.0  # Seconds
MAX_MUTATION_RETRIES = 5  # retry attempts for server errors


def main():
    print(f"Initializing Digital Psyche Middleware...")
    print(f"Connecting to Convex: {CONVEX_URL}")
    
    client = ConvexClient(CONVEX_URL)
    # Quick health check
    try:
        res = client.query("psyche:getState")
        print("Convex test query result:", res)
    except Exception as e:
        import traceback
        print("Convex test query failed:")
        print(repr(e))
        traceback.print_exc()

    # Helper: retry mutations with exponential backoff
    def send_mutation_with_retry(client, name, args, max_retries=MAX_MUTATION_RETRIES):
        delay = 0.5
        for attempt in range(1, max_retries + 1):
            try:
                client.mutation(name, args)
                return True
            except Exception as exc:
                print(f"Mutation {name} attempt {attempt} failed: {repr(exc)}")
                if attempt == max_retries:
                    import traceback
                    traceback.print_exc()
                    return False
                time.sleep(delay)
                delay = min(8.0, delay * 2)

    # Initialize Engines
    psyche = NeurotransmitterEngine()
    gate = EmergenceGate()
    
    print("Engines Online. Starting Heartbeat Loop...")
    
    try:
        while True:
            # 1. Calculate Next State (Decay/Processing)
            # Occasional random thought/stimulus
            stimulus_map = {}
            if random.random() < 0.1:
                # Map abstract concepts to neurotransmitters
                # Novelty -> Dopamine
                # Success -> Serotonin + Dopamine
                # Stress -> Cortisol
                
                if random.random() > 0.5: # Success/Novelty
                    stimulus_map['dopamine'] = random.uniform(0, 0.1)
                    stimulus_map['serotonin'] = random.uniform(0, 0.05)
                
                if random.random() > 0.8: # Stress
                    stimulus_map['cortisol'] = random.uniform(0, 0.1)
                
                flags = psyche.update(stimulus_map)
            else:
                # Just decay
                flags = psyche.update({})
            
            # Access current state
            current_state = {
                'dopamine': psyche.state.dopamine,
                'serotonin': psyche.state.serotonin,
                'cortisol': psyche.state.cortisol,
                'flags': {
                    'defensive_posture': flags.defensive_posture,
                    'high_motivation': flags.high_motivation,
                    'emotional_instability': flags.emotional_instability,
                    'balanced_state': flags.balanced_state
                }
            }
            
            # 2. Check Gate - simple policy: lock on high cortisol, unlock on calm
            try:
                if current_state['cortisol'] > 0.8 and gate.current_state != GateState.LOCKED:
                    gate.set_state(GateState.LOCKED, "Cortisol Overload - System Unstable")
                elif gate.current_state == GateState.LOCKED and current_state['cortisol'] < 0.4:
                    gate.set_state(GateState.EMERGENT, "System Stabilized")
            except Exception as e:
                print(f"Gate check failed: {e}")
                
            gate_status_str = gate.current_state.value
            
            # 3. Push to Convex (best-effort, errors logged)
            success = send_mutation_with_retry(client, "psyche:updateState", {
                "dopamine": current_state['dopamine'],
                "serotonin": current_state['serotonin'],
                "cortisol": current_state['cortisol'],
                "flags": current_state['flags'],
            })
            if not success:
                print("Failed to send psyche state after retries")
            
            # Push Gate State (use retry helper)
            success = send_mutation_with_retry(client, "gate:setGateState", {
                "state": gate_status_str,
                "reason": "Routine Check",
                "signature": None
            })
            if not success:
                print("Failed to send gate state after retries")
            
            # Log heartbeat
            print(f"HEARTBEAT | D:{current_state['dopamine']:.2f} S:{current_state['serotonin']:.2f} C:{current_state['cortisol']:.2f} | GATE: {gate_status_str}")
            
            time.sleep(UPDATE_INTERVAL)
            
    except KeyboardInterrupt:
        print("\nShutting down Digital Psyche...")

if __name__ == "__main__":
    main()
