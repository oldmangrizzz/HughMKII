# Proxmox + Pangolin Reverse Proxy Integration

## Architecture Overview

```
[Internet/Cloudflare DNS]
         ↓
[Your Domain → Proxmox Server]
         ↓
[Pangolin Reverse Proxy]
         ↓
[macOS VibeVoice API: http://MAC_IP:7860]
```

## VibeVoice Configuration for Proxmox/Pangolin Setup

### 1. Run VibeVoice with Network Access

Since Pangolin will be routing requests to this Mac, you need to bind to all interfaces:

```bash
# Start VibeVoice accessible from network
SERVER_NAME=0.0.0.0 bash vibevoice_mac_arm64.sh --demo
```

**Important:** Keep it on `0.0.0.0` not `127.0.0.1` so Proxmox/Pangolin can reach it.

### 2. Static Configuration Recommended

For production use with reverse proxy:

**Option A: Environment variables in a launcher script**
```bash
#!/bin/bash
# ~/vibevoice_launcher.sh
export SERVER_NAME=0.0.0.0
export PORT=7860
cd /Users/grizzmed/workspace/VibeVoice4macOS
bash vibevoice_mac_arm64.sh --demo
```

**Option B: macOS LaunchAgent for auto-start**
```xml
<!-- ~/Library/LaunchAgents/com.vibevoice.api.plist -->
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.vibevoice.api</string>
    <key>ProgramArguments</key>
    <array>
        <string>/bin/bash</string>
        <string>/Users/grizzmed/workspace/VibeVoice4macOS/vibevoice_mac_arm64.sh</string>
        <string>--demo</string>
        <string>--server-name</string>
        <string>0.0.0.0</string>
    </array>
    <key>EnvironmentVariables</key>
    <dict>
        <key>PORT</key>
        <string>7860</string>
    </dict>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>/tmp/vibevoice.log</string>
    <key>StandardErrorPath</key>
    <string>/tmp/vibevoice.error.log</string>
</dict>
</plist>
```

Load it with:
```bash
launchctl load ~/Library/LaunchAgents/com.vibevoice.api.plist
```

### 3. Pangolin/Nginx/Traefik Configuration

When configuring your reverse proxy on Proxmox, point it to:

**Backend URL:**
```
http://MAC_LOCAL_IP:7860
```

**Example Nginx config snippet:**
```nginx
upstream vibevoice_backend {
    server MAC_LOCAL_IP:7860;
}

server {
    listen 80;
    server_name vibevoice.yourdomain.com;
    
    location / {
        proxy_pass http://vibevoice_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Important for Gradio
        proxy_buffering off;
        proxy_read_timeout 86400;
    }
}
```

**Example Traefik labels (if using Docker):**
```yaml
labels:
  - "traefik.enable=true"
  - "traefik.http.routers.vibevoice.rule=Host(`vibevoice.yourdomain.com`)"
  - "traefik.http.services.vibevoice.loadbalancer.server.url=http://MAC_LOCAL_IP:7860"
```

### 4. Gradio API Endpoints

Once proxied through your domain, the API will be available at:

**Web Interface:**
```
https://vibevoice.yourdomain.com
```

**API Documentation:**
```
https://vibevoice.yourdomain.com/?view=api
```

**API Endpoint:**
```
https://vibevoice.yourdomain.com/api/{endpoint_name}
```

### 5. Testing the Setup

**Step 1: Test local access first**
```bash
# From the Mac
curl http://localhost:7860

# From Proxmox server
curl http://MAC_LOCAL_IP:7860
```

**Step 2: Test through Pangolin proxy**
```bash
# From anywhere after Pangolin is configured
curl https://vibevoice.yourdomain.com
```

### 6. Firewall Considerations

**macOS Firewall:**
- Allow incoming connections for Python/Terminal
- Or: System Preferences → Security & Privacy → Firewall → Firewall Options → Add Python

**Proxmox Firewall:**
- Ensure port forwarding is configured if needed
- Allow traffic from Proxmox to Mac on port 7860

### 7. Network Requirements

- **Static IP recommended** for the Mac (or DHCP reservation)
- **Same network/VLAN** as Proxmox, OR proper routing configured
- **Persistent connection** - consider keeping Mac awake:
  ```bash
  # Prevent sleep while connected to power
  sudo pmset -c sleep 0
  sudo pmset -c disksleep 0
  ```

### 8. Health Check Endpoint

For Pangolin/load balancer health checks:

```bash
# Gradio provides a root endpoint that returns 200 OK
curl http://MAC_LOCAL_IP:7860/
```

### 9. Security Notes

- VibeVoice will be exposed through your domain
- Use Cloudflare proxy for DDoS protection
- Consider adding authentication at Pangolin level
- Rate limiting recommended (Cloudflare or Pangolin)
- SSL/TLS handled by Cloudflare → Pangolin → VibeVoice

### 10. Monitoring & Logs

**VibeVoice logs:**
```bash
# If running manually, logs are in terminal
# If using LaunchAgent, logs are in:
tail -f /tmp/vibevoice.log
tail -f /tmp/vibevoice.error.log
```

**Check if running:**
```bash
lsof -i :7860
```

**Restart if needed:**
```bash
# If using LaunchAgent
launchctl unload ~/Library/LaunchAgents/com.vibevoice.api.plist
launchctl load ~/Library/LaunchAgents/com.vibevoice.api.plist
```

## Ready for Pangolin Setup

Once Pangolin is ready on your Proxmox system:

1. **Ensure VibeVoice is running** with `SERVER_NAME=0.0.0.0`
2. **Get your Mac's local IP** (see NETWORK_API_SETUP.md)
3. **Configure Pangolin** to proxy to `http://MAC_IP:7860`
4. **Test** through your domain

The VibeVoice side is ready - just point Pangolin at it when your infrastructure is configured!
