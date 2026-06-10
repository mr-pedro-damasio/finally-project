param(
    [switch]$Build
)

$IMAGE = "finally"
$CONTAINER = "finally-app"
$PORT = 8000

# Build if requested or image doesn't exist
if ($Build) {
    Write-Host "Building Docker image..."
    docker build -t $IMAGE $(Split-Path -Parent $PSCommandPath)/..
} else {
    try {
        docker image inspect $IMAGE | Out-Null
    } catch {
        Write-Host "Building Docker image..."
        docker build -t $IMAGE $(Split-Path -Parent $PSCommandPath)/..
    }
}

# Stop existing container if running
docker rm -f $CONTAINER 2>$null
if ($LASTEXITCODE -eq 0) {
    Write-Host "Removed existing container."
}

# Run container with volume and env file
$projectRoot = Split-Path -Parent (Split-Path -Parent $PSCommandPath)
docker run -d `
  --name $CONTAINER `
  -p "$($PORT):8000" `
  -v finally-data:/app/db `
  --env-file "$projectRoot\.env" `
  $IMAGE

Write-Host ""
Write-Host "FinAlly is running at http://localhost:$PORT"
Write-Host "Stop with: .\scripts\stop_windows.ps1"
