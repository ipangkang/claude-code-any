# anycode

A universal coding agent for your terminal — use **any OpenAI-compatible LLM** as your AI pair programmer.

## Install

```bash
pip install anycode-ai
```

**Requires:** Node.js >= 18 ([install](https://nodejs.org))

## Quick Start

```bash
# First run — interactive setup
anycode

# Configure provider
anycode auth

# Non-interactive mode
anycode -p "Explain this codebase"

# Test connection
anycode --test

# Show current config
anycode provider-info
```

## Supported Providers

| Provider | Models |
|----------|--------|
| **OpenAI** | gpt-4o, gpt-4o-mini, gpt-5.1, o1, o3 |
| **DeepSeek** | deepseek-chat, deepseek-reasoner |
| **Qwen (DashScope)** | qwen-max, qwen-plus |
| **MiniMax** | MiniMax-Text-01 |
| **GLM (Zhipu)** | glm-4-plus |
| **Kimi (Moonshot)** | moonshot-v1-auto |
| **SiliconFlow** | DeepSeek-V3, Qwen2.5 |
| **Ollama (Local)** | llama3, codellama, mistral |
| **Any OpenAI-compatible API** | Any model |

## Configuration

```bash
# Environment variables (CI/CD friendly)
export ANYCODE_API_KEY="sk-..."
export ANYCODE_MODEL="gpt-4o"
anycode -p "fix this bug"

# Quick provider switch
anycode --provider deepseek -p "hello"

# Or use config file: ~/.anycode/provider.json
anycode provider-info  # show current config
```

## Tools

anycode has full coding agent capabilities:

- **Bash** — Run terminal commands
- **Read / Write / Edit** — File operations
- **Grep / Glob** — Search files
- **Agent** — Spawn sub-agents for parallel work
- **WebFetch / WebSearch** — Web access
- **CronCreate** — Schedule recurring tasks (`/loop`)

## Slash Commands

`/auth` `/switch` `/provider` `/buddy-rollout` `/loop` `/fork` `/init` `/compact` `/config` `/help`

## GitHub

[github.com/ipangkang/anycode](https://github.com/ipangkang/anycode)
