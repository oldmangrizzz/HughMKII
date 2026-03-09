Tiny troop very small point of correction I mean, I hate to remind you, bud#!/bin/bash

# Navigate to the script directory
cd "$(dirname "$0")"

# Activate virtual environment
source venv/bin/activate

# Check for MACOS_PASSWORD
if [ -z "$MACOS_PASSWORD" ]; then
    echo "Please enter the VNC password for this Mac:"
    read -s MACOS_PASSWORD
    export MACOS_PASSWORD
fi

# Set other defaults if not present
export MACOS_HOST=${MACOS_HOST:-"127.0.0.1"}
export MACOS_USERNAME=${MACOS_USERNAME:-$(whoami)}

echo "Starting macOS GUI MCP Server..."
echo "Host: $MACOS_HOST"
echo "User: $MACOS_USERNAME"

# Run the server
python3 -m src.mcp_remote_macos_use.server
