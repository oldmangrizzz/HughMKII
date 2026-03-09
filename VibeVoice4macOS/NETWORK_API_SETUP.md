# Network API Setup Guide

## Quick Start for Network Access

To run VibeVoice so it's accessible from other systems on your local network:

### 1. Basic Network Setup

```bash
# Run with network access enabled (binds to all interfaces)
SERVER_NAME=0.0.0.0 bash vibevoice_mac_arm64.sh --demo
```

Or using the flag:

```bash
bash vibevoice_mac_arm64.sh --demo --server-name 0.0.0.0
```

### 2. Custom Port (if 7860 is in use)

```bash
PORT=8080 SERVER_NAME=0.0.0.0 bash vibevoice_mac_arm64.sh --demo
```

### 3. Find Your Mac's IP Address

```bash
# Get your local network IP
ifconfig | grep "inet " | grep -v 127.0.0.1
```

The API will be accessible at: `http://YOUR_IP:7860`

### 4. Using the API from Another System

Once running, other systems on your network can access:

**Web Interface:**
```
http://YOUR_MAC_IP:7860
```

**API Endpoint (for programmatic access):**
```
http://YOUR_MAC_IP:7860/api
```

Gradio provides automatic API endpoints. View API documentation at:
```
http://YOUR_MAC_IP:7860/?view=api
```

### 5. Example Python Client (from another machine)

```python
from gradio_client import Client

client = Client("http://YOUR_MAC_IP:7860")
result = client.predict(
    text="Your text here",
    api_name="/predict"  # Check API docs for exact endpoint name
)
```

### Security Notes

- **Firewall**: Ensure macOS firewall allows incoming connections on the chosen port
- **Network Only**: Binding to `0.0.0.0` exposes the service to your local network only (not the internet)
- **For Internet Access**: Use `--share` flag instead (creates temporary Gradio public URL)

### Troubleshooting

**Connection Refused:**
- Check macOS Firewall: System Preferences → Security & Privacy → Firewall
- Verify the service is running: `lsof -i :7860`
- Confirm both machines are on the same network

**Can't Find IP:**
```bash
# More detailed network info
ifconfig en0  # Usually WiFi
ifconfig en1  # Usually Ethernet
```

**Test Local Access First:**
```bash
# From the Mac running the service
curl http://localhost:7860
```

Then test from another machine:
```bash
curl http://YOUR_MAC_IP:7860
```
