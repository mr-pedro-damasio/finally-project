# FinAlly — AI Trading Workstation

> An AI-powered trading workstation that streams live market data, simulates portfolio trading, and integrates an LLM assistant that can analyze positions and execute trades via natural language. Built entirely by coding agents as a capstone project for an agentic AI coding course.

[![Open in GitHub Codespaces](https://github.com/codespaces/badge.svg)](https://codespaces.new/mr-pedro-damasio/finally-project)

---

## Features

- **Live price streaming** via SSE with green/red flash animations and sparkline mini-charts
- **Simulated portfolio** — $10k virtual cash, market orders, instant fills, no fees
- **Portfolio visualizations** — treemap heatmap, P&L chart, positions table
- **AI chat assistant** — analyzes holdings, suggests and auto-executes trades via natural language
- **Watchlist management** — add/remove tickers manually or through the AI
- **Dark terminal aesthetic** — Bloomberg-inspired, data-dense layout

---

## Architecture

Single Docker container on port 8000:

```
┌─────────────────────────────────────────┐
│  Docker Container (port 8000)           │
│                                         │
│  FastAPI (Python/uv)                    │
│  ├── /api/*         REST endpoints      │
│  ├── /api/stream/*  SSE streaming       │
│  └── /*             Next.js static files│
│                                         │
│  SQLite (volume-mounted)                │
│  Background: market data + snapshots    │
└─────────────────────────────────────────┘
```

| Layer | Stack |
|---|---|
| Frontend | Next.js static export, TypeScript, Tailwind CSS |
| Backend | FastAPI, Python 3.12, managed with `uv` |
| Database | SQLite with lazy initialization |
| AI | LiteLLM → OpenRouter (Cerebras inference), structured outputs |
| Market data | Built-in GBM simulator (default) or Massive/Polygon.io API (optional) |

---

## Quick Start

### Option 1 — GitHub Codespaces

1. Click **Open in GitHub Codespaces** above, or go to **Code → Codespaces → New codespace**.
2. Wait for the environment to build (first run takes a few minutes).
3. Copy `.env.example` to `.env` and add your `OPENROUTER_API_KEY`.
4. Run the app with Docker (see below).

### Option 2 — Local Dev Container

**Prerequisites:** [Docker Desktop](https://www.docker.com/products/docker-desktop) and the [Dev Containers extension](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-containers) for VS Code.

1. Clone the repository.
2. Open the project in VS Code.
3. When prompted, click **Reopen in Container** (or run `Dev Containers: Reopen in Container` from the command palette).
4. Copy `.env.example` to `.env` and add your `OPENROUTER_API_KEY`.

### Running the App

```bash
cp .env.example .env
# Edit .env — set OPENROUTER_API_KEY at minimum

docker build -t finally .
docker run -v finally-data:/app/db -p 8000:8000 --env-file .env finally
```

Open [http://localhost:8000](http://localhost:8000).

**Start/stop scripts** are provided for convenience:

```bash
./scripts/start_mac.sh       # macOS/Linux — builds if needed, runs, opens browser
./scripts/stop_mac.sh        # stops and removes the container (data volume is kept)
```

PowerShell equivalents are in `scripts/start_windows.ps1` and `scripts/stop_windows.ps1`.

---

## Environment Variables

```bash
cp .env.example .env
```

| Variable | Required | Description |
|---|---|---|
| `OPENROUTER_API_KEY` | Yes | OpenRouter API key for the AI chat assistant |
| `MASSIVE_API_KEY` | No | Polygon.io key for real market data; omit to use the built-in simulator |
| `LLM_MOCK` | No | Set `true` for deterministic mock LLM responses (used in E2E tests) |

> **Never commit `.env` to version control.**

---

## Project Structure

```
finally/
├── frontend/    # Next.js TypeScript project (static export)
├── backend/     # FastAPI uv project (Python 3.12)
│   └── db/      # Schema definitions and seed logic
├── planning/    # Project documentation and agent contracts
├── test/        # Playwright E2E tests + docker-compose.test.yml
├── db/          # SQLite volume mount target (runtime only)
├── scripts/     # Start/stop helpers (macOS/Linux and Windows)
├── Dockerfile   # Multi-stage build (Node → Python)
├── .env.example # Environment variable reference
└── .gitignore
```

---

## Development

Backend tests:

```bash
cd backend
uv sync --extra dev
uv run pytest
```

E2E tests (requires Docker):

```bash
cd test
docker compose -f docker-compose.test.yml up --abort-on-container-exit
```

---

## License

[MIT](LICENSE) © 2026 mr-pedro-damasio
