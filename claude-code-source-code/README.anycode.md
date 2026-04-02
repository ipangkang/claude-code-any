# anycode

A universal coding agent for your terminal. Use any OpenAI-compatible LLM as your AI pair programmer.

## Quick Start

```bash
# Install
cd /path/to/anycode
npm install
npm run build
npm link

# Run
anycode
```

On first launch, anycode will guide you through selecting a provider and entering your API key.

## Supported Providers

| Provider | Models | Endpoint |
|----------|--------|----------|
| **OpenAI** | gpt-4o, gpt-4o-mini, o1, o3 | api.openai.com |
| **DeepSeek** | deepseek-chat, deepseek-reasoner | api.deepseek.com |
| **Qwen (DashScope)** | qwen-max, qwen-plus, qwen-turbo | dashscope.aliyuncs.com |
| **MiniMax** | MiniMax-Text-01, abab6.5 | api.minimax.chat |
| **GLM (Zhipu)** | glm-4-plus, glm-4 | open.bigmodel.cn |
| **SiliconFlow** | DeepSeek-V3, Qwen2.5, Yi | api.siliconflow.cn |
| **Ollama** | llama3, codellama, mistral | localhost:11434 |
| **Any OpenAI-compatible API** | Any model | Any endpoint |

## Configuration

Config file: `~/.anycode/provider.json`

```json
{
  "provider": "openai",
  "baseUrl": "https://api.openai.com/v1",
  "apiKey": "sk-...",
  "model": "gpt-4o",
  "maxTokens": 16384
}
```

Switch provider anytime by editing this file or running `/provider` in the TUI.

## Usage

```bash
# Interactive TUI mode
anycode

# Non-interactive mode (for scripts/pipes)
anycode -p "Explain this codebase"

# Read a file and ask about it
anycode -p "Read main.py and find bugs"

# One-shot with output
anycode -p "Write a hello world in Python" > hello.py
```

## Slash Commands

| Command | Description |
|---------|-------------|
| `/provider` | Configure LLM provider |
| `/config` | Open settings panel |
| `/model` | Switch model |
| `/help` | Show all commands |
| `/init` | Create .anycode.md project file |
| `/compact` | Compress conversation context |

## Tools

anycode has full agent capabilities:

- **Bash** — Run terminal commands
- **Read** — Read files
- **Write** — Create files
- **Edit** — Modify files (surgical edits)
- **Grep** — Search file contents
- **Glob** — Find files by pattern
- **Agent** — Spawn sub-agents for parallel work

## Project Instructions

Create `.anycode.md` in your project root to give anycode context about your codebase:

```markdown
# Project: My App

## Tech Stack
- Python 3.12, FastAPI, PostgreSQL

## Conventions
- Use type hints everywhere
- Tests in tests/ directory
- Run `pytest` to test
```

## Requirements

- Node.js >= 18
- A model with tool/function calling support
