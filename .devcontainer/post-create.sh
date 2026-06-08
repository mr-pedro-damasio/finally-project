set -euo pipefail

curl -LsSf https://astral.sh/uv/install.sh | sh
export PATH="$HOME/.local/bin:$PATH"

curl -fsSL https://antigravity.google/cli/install.sh | bash

npm install -g opencode-ai

npm install -g @openai/codex

(cd backend && uv sync --extra dev)