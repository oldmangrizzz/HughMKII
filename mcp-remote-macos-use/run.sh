#!/bin/bash

# Check for MACOS_PASSWORD
if [ -z "$MACOS_PASSWORD" ]; then
    read -s -p "Enter VNC password for this Mac: " MACOS_PASSWORD
    export MACOS_PASSWORD
fi

# Start server
cd "/Users/grizzmed/workspace/mcp-remote-macos-use"
source venv/bin/activate
python3 -m src.mcp_remote_macos_use.server
