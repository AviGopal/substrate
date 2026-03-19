#!/bin/bash
# Fix /etc/hosts syntax for minibob domains
# Removes commas and uses proper space-separated format

echo "🔧 Fixing /etc/hosts for activity dashboard..."

# Check current entry
echo ""
echo "Current /etc/hosts entry:"
grep "127.0.0.1.*minibob" /etc/hosts

echo ""
echo "Proposed fix:"
echo "127.0.0.1  api.metabob.local app.metabob.local devbob.metabob.local dashboard.minibob.local api.minibob.local"

echo ""
read -p "Apply fix? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]
then
    sudo sed -i.bak 's/127.0.0.1.*minibob.*/127.0.0.1  api.metabob.local app.metabob.local devbob.metabob.local dashboard.minibob.local api.minibob.local/' /etc/hosts
    echo "✅ Fixed! Backup saved to /etc/hosts.bak"
    echo ""
    echo "New entry:"
    grep "127.0.0.1.*minibob" /etc/hosts
    echo ""
    echo "Testing connectivity..."
    echo -n "API: "
    curl -s -o /dev/null -w "%{http_code}\n" http://api.minibob.local/health
    echo -n "Dashboard: "
    curl -s -o /dev/null -w "%{http_code}\n" http://dashboard.minibob.local/ || echo "Check dashboard health endpoint"
else
    echo "Skipped. You can manually edit /etc/hosts with: sudo nano /etc/hosts"
fi
