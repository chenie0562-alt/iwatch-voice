#!/bin/zsh
set -euo pipefail

cd /Users/chenie/Documents/project/iwatch-voice
mkdir -p runtime

exec /opt/homebrew/bin/node /Users/chenie/Documents/project/iwatch-voice/dist/src/cli.js watch
