import os
from convex import ConvexClient

CONVEX_URL = os.getenv("CONVEX_URL", "https://mild-gnu-96.convex.cloud")

client = ConvexClient(CONVEX_URL)

print("Running Convex smoke test against:", CONVEX_URL)

# Test psyche mutation
try:
    client.mutation("psyche:updateState", {
        'dopamine': 0.42,
        'serotonin': 0.43,
        'cortisol': 0.10,
        'flags': {
            'defensive_posture': False,
            'high_motivation': False,
            'emotional_instability': False,
            'balanced_state': True,
        }
    })
    print("psyche:updateState OK")
    print("psyche:getState ->", client.query('psyche:getState'))
except Exception as e:
    print("psyche mutation failed:", repr(e))

# Test gate mutation
try:
    client.mutation("gate:setGateState", {'state': 'EMERGENT', 'reason': 'smoke test'})
    print("gate:setGateState OK")
    print("gate:getGateState ->", client.query('gate:getGateState'))
except Exception as e:
    print("gate mutation failed:", repr(e))
