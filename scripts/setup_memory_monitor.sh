#!/bin/bash
# Setup script for DevBob Memory Monitor

# Ensure script is run with sudo
if [ "$EUID" -ne 0 ]; then
    echo "Please run as root or with sudo"
    exit 1
fi

# Install dependencies
pip3 install psutil docker

# Create necessary directories
mkdir -p /var/log/metabob/memory_monitor
mkdir -p /etc/devbob

# Set permissions
chmod +x /opt/metabob/memory_monitor.py
chmod 755 /var/log/metabob/memory_monitor
chown -R root:root /var/log/metabob/memory_monitor

# Install systemd service
cat > /etc/systemd/system/devbob-memory-monitor.service << 'EOF'
[Unit]
Description=DevBob Memory Monitoring Service
After=docker.service
Requires=docker.service

[Service]
Type=simple
ExecStart=/usr/bin/python3 /opt/metabob/memory_monitor.py
Restart=always
RestartSec=10s

[Install]
WantedBy=multi-user.target
EOF

# Reload systemd, enable and start service
systemctl daemon-reload
systemctl enable devbob-memory-monitor
systemctl start devbob-memory-monitor

echo "DevBob Memory Monitor installed and started successfully!"
exit 0