#!/bin/bash

# Internal Setup Script for Local AI LXC
# This script runs inside the LXC container to install Ollama, Node.js, and the Web UI.

set -e

echo "==========================================="
echo "   Provisioning Local AI LXC..."
echo "==========================================="

# Update System
apt-get update && apt-get upgrade -y
apt-get install -y curl git build-essential

# Install Node.js (LTS)
echo "Installing Node.js..."
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs

# Install Ollama
echo "Installing Ollama..."
curl -fsSL https://ollama.com/install.sh | sh

# Clone the Repository
echo "Cloning Web UI from GitHub..."
mkdir -p /opt/local-ai-lxc
cd /opt/local-ai-lxc
git clone https://github.com/Pxl-Box/Local-AI-LXC.git .

# Install Dependencies
echo "Installing Node.js dependencies..."
npm install

# Setup Systemd Service for the Backend
echo "Configuring systemd service..."
cat <<EOF > /etc/systemd/system/local-ai-lxc.service
[Unit]
Description=Local AI LXC Web Interface
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/local-ai-lxc
ExecStart=/usr/bin/npm start
Restart=always
Environment=PORT=3000
Environment=OLLAMA_URL=http://localhost:11434

[Install]
WantedBy=multi-user.target
EOF

# Reload and Start Services
systemctl daemon-reload
systemctl enable local-ai-lxc
systemctl start local-ai-lxc

echo "==========================================="
echo "   Setup Complete!"
echo "==========================================="
echo "The Web Interface is running on port 3000."
echo "You can access it at: http://<lxc-ip>:3000"
echo ""
echo "Ollama is also running as a background service."
echo "You can now start pulling models via the web interface!"
