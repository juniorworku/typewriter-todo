#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
command -v node >/dev/null || { echo 'Install Node.js 22.12+ first.'; exit 1; }
node -e 'const [major, minor] = process.versions.node.split(".").map(Number); if (major < 22 || (major === 22 && minor < 12)) { console.error("Node.js 22.12+ is required."); process.exit(1); }'
if [ ! -d node_modules ]; then npm ci; fi
npm run build
exec npm start
