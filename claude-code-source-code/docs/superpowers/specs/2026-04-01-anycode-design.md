# anycode - Universal Coding Agent

> Fork of Claude Code v2.1.88, rebuilt as a provider-agnostic coding agent powered by any OpenAI-compatible LLM.

## 1. Goals

- **Provider-agnostic**: Works with any OpenAI-compatible API (Qwen, DeepSeek, MiniMax, GPT, local models, etc.)
- **Zero Anthropic dependency**: No OAuth, no subscription checks, no Anthropic-specific auth
- **Full agent capability**: All tools (Bash, Read, Write, Edit, Grep, Glob, etc.), MCP, permissions preserved
- **Streaming**: Real-time token streaming, same UX as original
- **Simple setup**: Interactive first-run config, fill API key and go

## 2. Architecture

```
┌──────────────────────────────────┐
│  anycode TUI                     │
│  (REPL, Tools, Permissions, MCP) │  ← Unchanged
├──────────────────────────────────┤
│  Existing Anthropic SDK calls    │
│  messages.create(stream: true)   │  ← Unchanged
├──────────────────────────────────┤
│  ★ OpenAI Adapter Layer          │  ← NEW
│  ┌────────────────────────────┐  │
│  │ Request:  Anthropic → OAPI │  │
│  │ Stream:   OAPI SSE → Anth  │  │
│  │ Tools:    tool_use ↔ calls │  │
│  └────────────────────────────┘  │
├──────────────────────────────────┤
│  Any OpenAI-compatible endpoint  │
│  /v1/chat/completions            │
└──────────────────────────────────┘
```

The adapter layer intercepts all `messages.create()` calls from the Anthropic SDK, translates to OpenAI format, sends to the configured endpoint, and translates the streaming response back. Upper layers see no difference.

## 3. Module Breakdown

### 3.1 Remove Anthropic Auth System

**What to remove:**
- OAuth login flow (token exchange, refresh, profile fetch)
- `isClaudeAISubscriber()`, `isAnthropicAuthEnabled()` gate checks
- API key format validation (`sk-ant-*` prefix)
- Bedrock / Vertex / Foundry provider-specific logic
- Subscription-based model gating (Max → Opus, others → Sonnet)
- GrowthBook feature flag fetching
- Remote managed settings / policy limits
- MDM settings prefetch, keychain prefetch
- Analytics/telemetry to Anthropic endpoints

**What to keep:**
- Onboarding theme selection (first-run UX)
- Workspace trust dialog (security)
- Permission system (tool approval)
- MCP server approval

**Key files:**
- `src/utils/auth.ts` — gut OAuth/profile/subscriber logic
- `src/services/api/client.ts` — replace `getAnthropicClient()` 
- `src/main.tsx` — remove auth-dependent preAction logic
- `src/interactiveHelpers.tsx` — strip OAuth setup from `showSetupScreens()`
- `src/bootstrap/state.ts` — remove subscription/plan state
- `src/services/analytics/` — disable Anthropic telemetry

### 3.2 Provider Configuration System

**Config file:** `~/.anycode/provider.json`

```json
{
  "provider": "deepseek",
  "baseUrl": "https://api.deepseek.com/v1",
  "apiKey": "sk-...",
  "model": "deepseek-chat"
}
```

**Preset providers** (with default baseUrl and model):

| Provider | baseUrl | Default Model |
|----------|---------|---------------|
| OpenAI | `https://api.openai.com/v1` | `gpt-4o` |
| DeepSeek | `https://api.deepseek.com/v1` | `deepseek-chat` |
| Qwen (DashScope) | `https://dashscope.aliyuncs.com/compatible-mode/v1` | `qwen-max` |
| MiniMax | `https://api.minimax.chat/v1` | `MiniMax-Text-01` |
| GLM (Zhipu) | `https://open.bigmodel.cn/api/paas/v4` | `glm-4-plus` |
| Custom | User-provided | User-provided |

**First-run interactive config:**
1. Show provider list (arrow key selection)
2. User picks provider (or "Custom")
3. Prompt for API Key
4. If custom: prompt for base_url and model
5. Test connection with a minimal request
6. Save to `~/.anycode/provider.json`

**Runtime config commands:**
- `/config` — re-run provider configuration
- `/model <name>` — switch model within current provider

### 3.3 OpenAI Adapter Layer

**New file:** `src/services/api/openaiAdapter.ts`

This is the core translation layer. It wraps a fake Anthropic client object that the existing code calls normally, but internally translates everything to OpenAI format.

#### 3.3.1 Request Translation (Anthropic → OpenAI)

**Messages:**

| Anthropic | OpenAI |
|-----------|--------|
| `system: "You are..."` (top-level param) | `{role: "system", content: "You are..."}` as messages[0] |
| `{role: "user", content: "text"}` | `{role: "user", content: "text"}` |
| `{role: "user", content: [{type: "text", text: "..."}]}` | `{role: "user", content: "..."}` (flatten) |
| `{role: "assistant", content: [{type: "text"}, {type: "tool_use", id, name, input}]}` | `{role: "assistant", content: "...", tool_calls: [{id, type: "function", function: {name, arguments: JSON}}]}` |
| `{role: "user", content: [{type: "tool_result", tool_use_id, content}]}` | `{role: "tool", tool_call_id, content: "..."}` |

**Tools:**

| Anthropic `tools[]` | OpenAI `tools[]` |
|---------------------|------------------|
| `{name, description, input_schema}` | `{type: "function", function: {name, description, parameters: input_schema}}` |

**Parameters:**

| Anthropic | OpenAI |
|-----------|--------|
| `max_tokens` | `max_tokens` |
| `temperature` | `temperature` |
| `top_p` | `top_p` |
| `stop_sequences` | `stop` |
| `stream: true` | `stream: true, stream_options: {include_usage: true}` |

**Ignored Anthropic params** (no OpenAI equivalent):
- `top_k` — drop silently
- `metadata` — drop silently
- `thinking` — drop silently (model-specific)

#### 3.3.2 Streaming Response Translation (OpenAI → Anthropic)

OpenAI stream events → Anthropic stream events:

```
[First chunk with role: "assistant"]
  → message_start {type: "message", id, model, role: "assistant", ...}
  → content_block_start {type: "content_block_start", index: 0, content_block: {type: "text", text: ""}}

[Chunks with delta.content]
  → content_block_delta {type: "content_block_delta", index: 0, delta: {type: "text_delta", text: "..."}}

[Chunks with delta.tool_calls]
  → content_block_start {type: "content_block_start", index: N, content_block: {type: "tool_use", id, name, input: ""}}
  → content_block_delta {index: N, delta: {type: "input_json_delta", partial_json: "..."}}
  → content_block_stop {index: N}

[Chunk with finish_reason: "stop" | "tool_calls"]
  → content_block_stop (for last text block)
  → message_delta {delta: {stop_reason: "end_turn" | "tool_use"}, usage: {...}}
  → message_stop
```

**State machine** for stream translation:
- Track active content blocks (text blocks, tool_call blocks)
- Buffer tool_call arguments JSON fragments
- Emit `content_block_start` on first appearance of each block
- Emit `content_block_stop` + new `content_block_start` on block transitions
- Map `finish_reason`: `"stop"` → `"end_turn"`, `"tool_calls"` → `"tool_use"`

#### 3.3.3 Non-streaming Response Translation

For completeness (used in some internal calls):

```
OpenAI ChatCompletion → Anthropic Message {
  id: response.id,
  type: "message",
  role: "assistant",
  model: response.model,
  content: [
    ...text blocks from choices[0].message.content,
    ...tool_use blocks from choices[0].message.tool_calls
  ],
  stop_reason: map(finish_reason),
  usage: { input_tokens, output_tokens }
}
```

### 3.4 Branding

**Replace throughout codebase:**

| Original | Replacement |
|----------|-------------|
| `Claude Code` | `anycode` |
| `claude` (CLI command) | `anycode` |
| `Claude` (assistant name in prompts) | `anycode` |
| `@anthropic-ai/claude-code` | `anycode` |
| Anthropic feedback URLs | Remove or replace |
| `~/.claude/` | `~/.anycode/` |
| Version `2.1.88 (Claude Code)` | `1.0.0 (anycode)` |
| Copyright Anthropic PBC | Remove |

**System prompt adjustments:**
- Remove "You are Claude" identity references
- Replace with "You are anycode, a universal coding agent"
- Keep all tool instructions, permissions, coding guidelines intact

### 3.5 Build System

Keep the existing esbuild pipeline with the fixes already applied:
- `src-alias` plugin (deduplicate src/ vs build-src/)
- Multi-line `feature()` → `false` replacement
- Commander `-d2e` fix

Additional build changes:
- Package name: `anycode`
- Binary name: `anycode`
- Remove `@anthropic-ai/sdk` from runtime dependencies (keep as build-time for types only)
- Add `openai` or raw `fetch` for API calls (prefer raw fetch to minimize dependencies)

## 4. Config File Locations

| File | Purpose |
|------|---------|
| `~/.anycode/provider.json` | Provider config (baseUrl, apiKey, model) |
| `~/.anycode/settings.json` | User preferences (theme, permissions, etc.) |
| `~/.anycode/projects/` | Per-project trust state |
| `.anycode.md` | Project-level instructions (replaces CLAUDE.md) |

## 5. What Stays Unchanged

- **All tools**: Bash, Read, Write, Edit, Grep, Glob, Agent, etc.
- **Permission system**: Tool approval, dangerously-skip-permissions
- **MCP protocol**: Server connections, tool discovery
- **Session management**: Conversation history, resume/continue
- **Ink TUI**: React-based terminal rendering
- **Workspace trust dialog**: Security boundary
- **Onboarding**: Theme selection

## 6. What Gets Removed

- OAuth login/token/refresh/profile
- Anthropic subscription checks (Max/Pro/Free tier gating)
- Model allowlist enforcement based on subscription
- Bedrock/Vertex/Foundry provider code
- GrowthBook feature flags
- Remote managed settings / policy limits
- Anthropic telemetry/analytics
- MDM settings, keychain prefetch
- Auto-updater (checks Anthropic npm registry)
- Claude.ai Chrome integration

## 7. Requirements

- Models must support OpenAI-compatible `/v1/chat/completions` endpoint
- Models must support `tools` / `tool_calls` (function calling)
- Models must support streaming (`stream: true`)
- Node.js >= 18

## 8. Risk & Mitigation

| Risk | Mitigation |
|------|------------|
| Models return malformed tool_calls JSON | Adapter validates + retries with error message |
| Providers have different tool_calls format quirks | Provider preset includes format hints; adapter handles known variations |
| Streaming chunk boundaries differ between providers | State machine handles partial/split chunks robustly |
| Some models weak at following tool schemas | System prompt includes explicit tool-use instructions; adapter validates tool names |
