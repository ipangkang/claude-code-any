# anycode

A universal coding agent for your terminal — use **any OpenAI-compatible LLM** as your AI pair programmer.

Built on Claude Code v2.1.88 source, rebuilt as a provider-agnostic coding agent.

## Install

```bash
pip install anycode-ai
```

Or from source:

```bash
git clone <your-repo-url>
cd claude-code-source-code
npm install
npm run build
npm link
```

**Requires:** Node.js >= 18

## Quick Start

```bash
# First run — interactive setup guides you through provider selection
anycode

# Non-interactive mode
anycode -p "Explain this codebase"

# Test connection
anycode --test

# Show current config
anycode provider-info
```

## Supported Providers

| Provider | Base URL | Default Model |
|----------|----------|---------------|
| **OpenAI** | `api.openai.com/v1` | gpt-4o |
| **DeepSeek** | `api.deepseek.com/v1` | deepseek-chat |
| **Qwen (DashScope)** | `dashscope.aliyuncs.com/compatible-mode/v1` | qwen-max |
| **MiniMax** | `api.minimax.chat/v1` | MiniMax-Text-01 |
| **GLM (Zhipu)** | `open.bigmodel.cn/api/paas/v4` | glm-4-plus |
| **Kimi (Moonshot)** | `api.moonshot.cn/v1` | moonshot-v1-auto |
| **SiliconFlow** | `api.siliconflow.cn/v1` | deepseek-ai/DeepSeek-V3 |
| **Ollama (Local)** | `localhost:11434/v1` | llama3 |
| **Any OpenAI-compatible** | Your endpoint | Your model |

## Configuration

### Config File (`~/.anycode/provider.json`)

```json
{
  "provider": "openai",
  "baseUrl": "https://api.openai.com/v1",
  "apiKey": "sk-...",
  "model": "gpt-4o"
}
```

### Environment Variables

```bash
export ANYCODE_API_KEY="sk-..."
export ANYCODE_BASE_URL="https://api.openai.com/v1"
export ANYCODE_MODEL="gpt-4o"
anycode -p "fix the bug"
```

### CLI Options

```bash
anycode --provider deepseek -p "hello"   # Quick provider switch
anycode --test                            # Verify API connection
anycode provider-info                     # Show current config
anycode setup                             # Interactive setup wizard
```

## Tools

| Tool | Description |
|------|-------------|
| **Bash** | Run terminal commands |
| **Read** | Read files |
| **Write** | Create files |
| **Edit** | Modify files (surgical edits) |
| **Grep** | Search file contents |
| **Glob** | Find files by pattern |
| **Agent** | Spawn sub-agents for parallel work |
| **WebFetch/WebSearch** | Fetch/search the web |
| **CronCreate** | Schedule recurring tasks (`/loop`) |

## Slash Commands

`/provider` `/config` `/model` `/init` `/loop` `/fork` `/rc` `/compact` `/help`

## Project Instructions

Create `.anycode.md` (or `CLAUDE.md`) in your project root to give the agent context.

## What Changed from Claude Code

- **OpenAI adapter layer** — translates Anthropic SDK → OpenAI `/v1/chat/completions` (request, streaming SSE, tool calls)
- **9 provider presets** — OpenAI, DeepSeek, Qwen, MiniMax, GLM, Kimi, SiliconFlow, Ollama, Custom
- **28 feature gates enabled** — /loop, /fork, /rc, auto permissions, memory extraction, etc.
- **Auth bypass** — `isClaudeAISubscriber()` returns true, all GrowthBook gates bypassed
- **Branding** — CLI `anycode`, config `~/.anycode/`, project file `.anycode.md`
- **DeepSeek-R1 reasoning** — `reasoning_content` mapped to thinking blocks
- **Node 22 compat** — `createRequire` injection, force-bundled ESM-incompatible packages
- **pip package** — `pip install anycode-ai` with bundled Node.js runtime deps
- **Error handling** — retry on 429/5xx, friendly messages for auth/DNS/timeout errors
- **Context windows** — per-provider limits (128K OpenAI, 64K DeepSeek, 8K Ollama)

## Requirements

- Node.js >= 18
- ripgrep (`brew install ripgrep`)
- A model with function calling support

## License

MIT
