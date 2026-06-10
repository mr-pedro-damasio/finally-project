#!/usr/bin/env bash
set -e

IMAGE="finally"
CONTAINER="finally-app"
PORT=8000

# Parse --build flag
BUILD=false
for arg in "$@"; do
  [[ "$arg" == "--build" ]] && BUILD=true
done

# Build if requested or image doesn't exist
if $BUILD || ! docker image inspect "$IMAGE" &>/dev/null; then
  echo "Building Docker image..."
  docker build -t "$IMAGE" "$(dirname "$0")/.."
fi

# Stop existing container if running
docker rm -f "$CONTAINER" 2>/dev/null || true

# Run container with volume and env file
docker run -d \
  --name "$CONTAINER" \
  -p "$PORT:8000" \
  -v finally-data:/app/db \
  --env-file "$(dirname "$0")/../.env" \
  "$IMAGE"

echo ""
echo "FinAlly is running at http://localhost:$PORT"
echo "Stop with: ./scripts/stop_mac.sh"
