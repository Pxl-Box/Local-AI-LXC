#!/bin/bash

# Configuration Helper for Local AI LXC on Proxmox
# Run this on your Proxmox Host

set -e

echo "==========================================="
echo "   Local AI LXC Creator for Proxmox"
echo "==========================================="

# Check if running on Proxmox
if ! command -v pct &> /dev/null; then
    echo "Error: This script must be run on a Proxmox host (pct command not found)."
    exit 1
fi

# Quick or Custom Mode
read -p "Choose mode: [Q]uick (Defaults) or [C]ustom? (q/c): " MODE
MODE=${MODE:-q}

# Default Values
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

echo ""
echo "Summary:"
echo "ID: $CTID"
echo "Name: $HOSTNAME"
echo "Cores: $CORES"
echo "RAM: $RAM MB"
echo "Storage: $DISK GB"
echo "Bridge: $BRIDGE"
echo ""

read -p "Proceed with creation? (y/n): " CONFIRM
if [[ ! "$CONFIRM" =~ ^[Yy]$ ]]; then
    echo "Aborted."
    exit 0
fi

# Create Container
echo "Creating LXC container $CTID..."
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

# Start Container
echo "Starting container $CTID..."
pct start $CTID

# Wait for network
echo "Waiting for network..."
sleep 5

# Create internal setup script invitation
echo "==========================================="
echo "LXC Container $CTID ($HOSTNAME) Created!"
echo "==========================================="
echo "To finish setup, run this command INSIDE the container:"
echo ""
echo "bash <(curl -s https://raw.githubusercontent.com/Pxl-Box/Local-AI-LXC/main/setup-lxc-internal.sh)"
echo ""
echo "Or use pct exec to run it from here:"
echo "pct exec $CTID -- bash -c \"curl -s https://raw.githubusercontent.com/Pxl-Box/Local-AI-LXC/main/setup-lxc-internal.sh | bash\""
