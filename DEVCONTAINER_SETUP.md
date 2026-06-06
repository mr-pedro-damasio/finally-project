# Devcontainer Setup Recommendations

## Scope

These recommendations are based on the current workspace state, not only the planned architecture described in the docs.

Current implemented surface:

- `backend/` is a Python `3.12` project managed with `uv`
- The active code is the market data subsystem plus tests and the Rich demo
- There is no committed `frontend/`, `Dockerfile`, `.devcontainer/`, `.vscode/`, or FastAPI app entrypoint yet

Planned but not yet implemented:

- Next.js frontend with TypeScript and Tailwind CSS
- Full single-container Docker workflow
- Playwright E2E test setup
- LiteLLM/OpenRouter integration
- SQLite-backed application state beyond planning docs

## Recommendation Summary

Use a Python-first devcontainer now, with Node included as a secondary runtime for future frontend work.

Best base image:

- `mcr.microsoft.com/devcontainers/python:3.12-bookworm`

Why this image:

- Matches the hard requirement in `backend/pyproject.toml` (`requires-python = ">=3.12"`)
- Fits the only implemented runtime in the repo today
- Avoids unnecessary weight from the universal image
- Uses Debian Bookworm, which is a safer default than Alpine for `numpy` and future Python tooling
- Leaves room to layer Node without making Node the primary base

## Why Not Another Image

Avoid starting from a Node image because the committed workspace does not yet contain a frontend project.

Avoid the universal devcontainer image unless you want a broad preloaded environment at the cost of startup time and image size.

Avoid Alpine-based images because Python scientific and server packages tend to be less friction-free there.

## Recommended Features

Primary devcontainer features:

- `ghcr.io/devcontainers/features/node:1` with version `20`
- `ghcr.io/devcontainers/features/docker-outside-of-docker:1`

Optional features:

- `ghcr.io/devcontainers/features/github-cli:1`

Why these features:

- `node:1` prepares for the planned Next.js frontend without forcing a Node-first base image
- `docker-outside-of-docker:1` is useful once you add the planned Dockerfile and want to build/test containers from inside the devcontainer
- `github-cli:1` is useful but not required for local development

## Tools To Install In The Container

Install these explicitly during container setup:

- `uv`
- `sqlite3`
- `git` if not already present in the image
- `curl` for bootstrapping `uv`

Why:

- `uv` is the documented backend workflow and is not currently available on the host environment used during the scan
- `sqlite3` will help once the planned database layer lands
- `curl` is the simplest path for installing `uv`

## Recommended Ports

Forward these ports:

- `8000` for the future FastAPI app container/runtime
- `3000` for the future Next.js dev server

Note:

The current repo does not yet expose a FastAPI app entrypoint, so forwarding `8000` is future-ready rather than immediately required.

## Recommended VS Code Extensions

Install these in the devcontainer:

- `ms-python.python`
- `ms-python.vscode-pylance`
- `charliermarsh.ruff`
- `ms-azuretools.vscode-docker`
- `qwtel.sqlite-viewer`
- `ms-playwright.playwright`

Extension rationale:

- Python + Pylance support the current backend codebase
- Ruff matches the existing lint/format tooling
- Docker is useful for the planned containerized workflow
- SQLite Viewer will be useful for the planned database file
- Playwright is future-facing for the planned E2E layer

## Recommended VS Code Settings

Suggested settings inside the devcontainer:

```json
{
  "python.testing.pytestEnabled": true,
  "python.testing.pytestArgs": ["backend/tests"],
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.organizeImports.ruff": "explicit",
    "source.fixAll.ruff": "explicit"
  }
}
```

## Recommended Environment

Set these container environment values:

```json
{
  "PYTHONUNBUFFERED": "1"
}
```

This keeps Python logs unbuffered, which is useful for tests, demos, and future app startup logs.

## Recommended Post-Create Workflow

Run this after the container is created:

```bash
sudo apt-get update \
  && sudo apt-get install -y sqlite3 \
  && curl -LsSf https://astral.sh/uv/install.sh | sh \
  && export PATH="$HOME/.local/bin:$PATH" \
  && cd backend \
  && uv sync --extra dev
```

Why this is the right bootstrap sequence:

- Installs `sqlite3` once at container setup time
- Installs `uv` inside the container instead of relying on the host machine
- Syncs the backend using the existing `uv.lock`
- Installs dev tools required for tests and Ruff

## Starter devcontainer.json

This is the recommended starting point:

```json
{
  "name": "finally",
  "image": "mcr.microsoft.com/devcontainers/python:3.12-bookworm",
  "features": {
    "ghcr.io/devcontainers/features/node:1": {
      "version": "20"
    },
    "ghcr.io/devcontainers/features/docker-outside-of-docker:1": {}
  },
  "forwardPorts": [8000, 3000],
  "remoteEnv": {
    "PYTHONUNBUFFERED": "1"
  },
  "customizations": {
    "vscode": {
      "extensions": [
        "ms-python.python",
        "ms-python.vscode-pylance",
        "charliermarsh.ruff",
        "ms-azuretools.vscode-docker",
        "qwtel.sqlite-viewer",
        "ms-playwright.playwright"
      ],
      "settings": {
        "python.testing.pytestEnabled": true,
        "python.testing.pytestArgs": ["backend/tests"],
        "editor.formatOnSave": true,
        "editor.codeActionsOnSave": {
          "source.organizeImports.ruff": "explicit",
          "source.fixAll.ruff": "explicit"
        }
      }
    }
  },
  "postCreateCommand": "bash -lc 'sudo apt-get update && sudo apt-get install -y sqlite3 && curl -LsSf https://astral.sh/uv/install.sh | sh && export PATH=\"$HOME/.local/bin:$PATH\" && cd backend && uv sync --extra dev'"
}
```

## Alternative If You Want More Future-Proofing

If you expect to scaffold the frontend immediately, you can still keep the same Python base image and add Node as a feature. That is preferable to moving to a Node-first image.

If you want all tooling preinstalled rather than using `postCreateCommand`, use a `.devcontainer/Dockerfile` that:

- starts from `mcr.microsoft.com/devcontainers/python:3.12-bookworm`
- installs `sqlite3`
- installs `uv`

That will make container startup more predictable and reduce post-create drift.

## Important Repo Mismatches To Keep In Mind

These affect devcontainer design:

- `README.md` and `planning/PLAN.md` describe a Next.js frontend that is not committed yet
- The repo currently has no `frontend/` directory
- The repo currently has no `Dockerfile`
- The repo currently has no `.env.example`
- The repo currently has no `test/` Playwright setup
- The repo currently has no FastAPI application entrypoint, only the market subsystem and tests

Because of that, the devcontainer should be optimized for backend library and test development first, while remaining ready for the planned full-stack shape.

## Recommended Next Step

Create these files when you are ready to operationalize this:

- `.devcontainer/devcontainer.json`
- optionally `.devcontainer/Dockerfile` if you want `uv` and `sqlite3` baked into the image instead of installed at post-create time
