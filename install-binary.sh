#!/bin/bash
cp repos/metabob-opencode/packages/opencode/dist/opencode-linux-x64/bin/opencode ~/.local/bin/opencode
echo "Binary updated: $(stat -c '%y' ~/.local/bin/opencode)"
