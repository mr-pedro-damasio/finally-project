# Multi-stage build: Node (frontend) + Python (backend)

# Stage 1: Build frontend with Node
FROM node:20-slim AS frontend-builder
WORKDIR /workspace

# Copy frontend package files and install dependencies
COPY frontend/package*.json ./frontend/
RUN cd frontend && npm ci

# Copy full frontend source and build static export
COPY frontend/ ./frontend/
RUN cd frontend && npm run build

# Output is at /workspace/frontend/out/

# Stage 2: Python backend + serve static files
FROM python:3.12-slim AS final
WORKDIR /app

# Install uv (fast Python package manager)
RUN pip install uv --no-cache-dir

# Copy backend project files
COPY backend/pyproject.toml backend/uv.lock backend/README.md ./backend/
RUN cd backend && uv sync --frozen --no-dev

# Copy backend application code
COPY backend/ ./backend/

# Copy frontend static export from stage 1
COPY --from=frontend-builder /workspace/frontend/out ./static/

# Create directory for SQLite database
RUN mkdir -p /app/db

# Expose port 8000
EXPOSE 8000

# Health check: ensure FastAPI is responding
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/api/health')" || exit 1

# Set environment variables for backend
ENV STATIC_DIR=/app/static
ENV DB_PATH=/app/db/finally.db

# Run FastAPI with uvicorn
CMD ["uv", "run", "--directory", "backend", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
