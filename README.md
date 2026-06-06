# Zero Config Devcontainer

> A language-agnostic GitHub Template Repository with a fully configured dev container, GitHub Codespaces support, and AI coding assistants (Claude Code, GitHub Copilot, Gemini) ready out of the box.

[![Open in GitHub Codespaces](https://github.com/codespaces/badge.svg)](https://codespaces.new/mr-pedro-damasio/zero-config-devcontainer)

---

## Overview

This template provides a zero-configuration starting point for any new project. The development environment runs identically in GitHub Codespaces and in a local VS Code dev container. Language runtimes, frameworks, and project-specific tooling are intentionally left out — they are added after the project is created from this template.

---

## What's Included

- **Dev Container**: Ubuntu-based container with Node.js LTS and GitHub CLI
- **AI Assistants**: Claude Code, GitHub Copilot, Gemini CLI, opencode — all pre-installed
- **Agent Instructions**: Structured guidance for AI tools via `CLAUDE.md` → `AGENTS.md` → `.github/copilot-instructions.md`
- **VS Code Config**: Recommended extensions — GitHub Copilot, GitHub Copilot Chat, Claude Code, Gemini Code Assist, GitHub Codespaces, Dev Containers, RemoteHub
- **Git Configuration**: `.gitignore` for env files, OS artifacts, and editor files

---

## Getting Started

### Creating a new repository from this template

Click **"Use this template"** at the top of the [GitHub repository page](https://github.com/mr-pedro-damasio/zero-config-devcontainer), or use the GitHub CLI:

```bash
gh repo create my-project --template mr-pedro-damasio/zero-config-devcontainer
```

Then follow one of the options below to open your new project.

### Option 1 — GitHub Codespaces (recommended)

1. Click **Open in GitHub Codespaces** above, or go to **Code → Codespaces → New codespace**.
2. Wait for the environment to build (first run takes a few minutes).
3. Copy `.env.example` to `.env` and fill in the required values.
4. You're ready to develop.

### Option 2 — Dev Container (local)

**Prerequisites:** [Docker Desktop](https://www.docker.com/products/docker-desktop) and the [Dev Containers extension](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-containers) for VS Code.

1. Clone the repository.
2. Open the project in VS Code.
3. When prompted, click **Reopen in Container** (or run `Dev Containers: Reopen in Container` from the command palette).
4. Copy `.env.example` to `.env` and fill in the required values.
5. You're ready to develop.

---

## Environment Variables

All configuration is managed via environment variables. See `.env.example` for the full list with descriptions.

```bash
cp .env.example .env
# Edit .env with your values
```

> **Never commit `.env` to version control.**

---

## AI Tools

The following AI coding assistants are pre-installed and available in this environment:

| Tool | CLI | VS Code Extension |
|------|-----|-------------------|
| [Claude Code](https://claude.ai/code) | `claude` | Anthropic Claude Code |
| [GitHub Copilot](https://github.com/features/copilot) | — | GitHub Copilot |
| [Gemini CLI](https://github.com/google-gemini/gemini-cli) | `gemini` | Gemini Code Assist |
| [opencode](https://opencode.ai) | `opencode` | — |

---

## Development

This template is intentionally stack-agnostic. After creating a project from it:

1. Choose your language/runtime and add it as a devcontainer feature in `.devcontainer/devcontainer.json`, or create a custom `.devcontainer/Dockerfile` and reference it from `devcontainer.json`.
2. Install project dependencies (e.g., `npm install`, `pip install`, `cargo build`).
3. Copy `.env.example` to `.env` and configure environment variables.
4. Update `README.md` with project-specific instructions.
5. Update `AGENTS.md` with project-specific conventions.

---

## Contributing

Contributions to this template are welcome! Please open an issue or pull request on [GitHub](https://github.com/mr-pedro-damasio/zero-config-devcontainer).

When contributing:
- Keep the template language-agnostic (do not add stack-specific tooling to the base config).
- Test changes in both GitHub Codespaces and local dev containers.
- Update documentation (README, AGENTS.md) to reflect any changes.

## License

[MIT](LICENSE) © 2026 mr-pedro-damasio
