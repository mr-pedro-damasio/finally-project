#!/usr/bin/env bash
set -euo pipefail

curl -fsSL https://antigravity.google/cli/install.sh | bash

npm install -g \
  opencode-ai

