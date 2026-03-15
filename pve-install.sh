#!/bin/bash

# All-in-One Local AI LXC Installer for Proxmox
# Github: https://github.com/Pxl-Box/Local-AI-LXC
# Run this on your Proxmox Host shell.

set -e

echo "=========================================================="
echo "   PROXMOX LOCAL AI LXC - ALL-IN-ONE INSTALLER"
echo "=========================================================="

# 1. Host Environment Check
if ! command -v pct &> /dev/null; then
    echo "Error: This script must be run on a Proxmox host (pct command not found)."
    exit 1
fi

# 2. Resource Configuration
read -p "Choose mode: [Q]uick (Defaults) or [C]ustom? (q/c): " MODE
MODE=${MODE:-q}

# Defaults
CTID=$(pvesh get /cluster/nextid)
HOSTNAME="local-ai-lxc"
CORES=4
RAM=8192
DISK=50
BRIDGE="vmbr0"
PASSWORD="localai-passwd-123"

if [[ "$MODE" =~ ^[Cc]$ ]]; then
    read -p "Enter Container ID [$CTID]: " input_ctid
    CTID=${input_ctid:-$CTID}
    read -p "Enter Hostname [$HOSTNAME]: " input_hostname
    HOSTNAME=${input_hostname:-$HOSTNAME}
    read -p "Enter CPU Cores [$CORES]: " input_cores
    CORES=${input_cores:-$CORES}
    read -p "Enter RAM in MB [$RAM]: " input_ram
    RAM=${input_ram:-$RAM}
    read -p "Enter Storage in GB [$DISK]: " input_disk
    DISK=${input_disk:-$DISK}
    read -p "Enter Bridge [$BRIDGE]: " input_bridge
    BRIDGE=${input_bridge:-$BRIDGE}
    read -s -p "Enter Root Password: " input_pass
    echo ""
    PASSWORD=${input_pass:-$PASSWORD}
fi

echo -e "\nSummary:\n  ID: $CTID\n  Name: $HOSTNAME\n  Cores: $CORES\n  RAM: $RAM MB\n  Disk: $DISK GB\n"
read -p "Proceed? (y/n): " CONFIRM
if [[ ! "$CONFIRM" =~ ^[Yy]$ ]]; then echo "Aborted."; exit 0; fi

# 3. Container Creation
echo "Creating container $CTID..."
# Note: Using Debian 12 template as default
pct create $CTID local:vztmpl/debian-12-standard_12.2-1_amd64.tar.zst \
    --hostname $HOSTNAME \
    --password "$PASSWORD" \
    --net0 name=eth0,bridge=$BRIDGE,ip=dhcp \
    --storage local-lvm \
    --rootfs local-lvm:$DISK \
    --cores $CORES \
    --memory $RAM \
    --swap 2048 \
    --unprivileged 1 \
    --features nesting=1

echo "Starting container $CTID..."
pct start $CTID
sleep 5 # Wait for network init

# 4. Guest Provisioning (via pct exec)
echo "Provisioning guest system (this may take a few minutes)..."

pct exec $CTID -- bash -c "
    apt-get update && apt-get upgrade -y
    apt-get install -y curl git build-essential
    
    # Install Node.js
    echo 'Installing Node.js...'
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
    
    # Install Ollama
    echo 'Installing Ollama...'
    curl -fsSL https://ollama.com/install.sh | sh
    
    # Clone Web UI
    echo 'Cloning Web UI...'
    mkdir -p /opt/local-ai-lxc
    cd /opt/local-ai-lxc
    git clone https://github.com/Pxl-Box/Local-AI-LXC.git .
    
    # Install Dependencies
    npm install
    
    # Setup Systemd Service
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

    systemctl daemon-reload
    systemctl enable local-ai-lxc
    systemctl start local-ai-lxc
"

echo "=========================================================="
echo "   INSTALLATION COMPLETE!"
echo "=========================================================="
echo "Access your Web UI at: http://<LXC_IP>:3000"
echo "LXC ID: $CTID | Username: root"
echo "=========================================================="
