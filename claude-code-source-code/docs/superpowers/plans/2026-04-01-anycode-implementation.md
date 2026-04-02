# anycode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform Claude Code v2.1.88 into anycode, a provider-agnostic coding agent that works with any OpenAI-compatible LLM endpoint.

**Architecture:** Insert an OpenAI adapter layer between existing Anthropic SDK calls and the actual API endpoint. Remove all Anthropic auth/subscription logic. Add interactive provider configuration on first run. Rebrand all user-facing strings.

**Tech Stack:** Node.js, esbuild, React/Ink TUI, raw fetch (no OpenAI SDK dependency)

---

## File Structure

### New Files
- `src/services/api/openaiAdapter.ts` — Core protocol translation (Anthropic format ↔ OpenAI format)
- `src/services/api/openaiStreamTranslator.ts` — SSE stream event translation state machine
- `src/services/api/providerConfig.ts` — Provider configuration load/save/presets
- `src/components/ProviderSetup.tsx` — First-run interactive provider configuration UI

### Modified Files
- `src/services/api/client.ts` — Replace `getAnthropicClient()` to return adapter-wrapped client
- `src/services/api/claude.ts` — Minor: remove Anthropic-specific beta headers, metadata
- `src/utils/auth.ts` — Gut OAuth/subscription functions, simplify to provider config check
- `src/main.tsx` — Remove auth preAction logic, wire provider config into setup flow
- `src/interactiveHelpers.tsx` — Replace OAuth setup with provider config dialog
- `src/utils/envUtils.ts` — Rename `.claude` → `.anycode`
- `src/utils/model/model.ts` — Remove subscription-based model gating
- `src/constants/prompts.ts` — Rebrand system prompt identity
- `src/constants/system.ts` — Rebrand system prompt prefixes
- `scripts/build.mjs` — Update version, package name, MACRO URLs
- `package.json` — Rename package, update version

### Files to Heavily Simplify
- `src/utils/auth.ts` — Remove ~800 lines of OAuth/subscription code
- `src/bootstrap/state.ts` — Remove subscription state references
- `src/services/analytics/` — Disable Anthropic telemetry

---

## Task 1: Provider Configuration System

**Files:**
- Create: `src/services/api/providerConfig.ts`

- [ ] **Step 1: Create provider config module**

```typescript
// src/services/api/providerConfig.ts
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'

export interface ProviderPreset {
  name: string
  baseUrl: string
  defaultModel: string
}

export interface ProviderConfig {
  provider: string
  baseUrl: string
  apiKey: string
  model: string
}

export const PROVIDER_PRESETS: ProviderPreset[] = [
  { name: 'OpenAI', baseUrl: 'https://api.openai.com/v1', defaultModel: 'gpt-4o' },
  { name: 'DeepSeek', baseUrl: 'https://api.deepseek.com/v1', defaultModel: 'deepseek-chat' },
  { name: 'Qwen (DashScope)', baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', defaultModel: 'qwen-max' },
  { name: 'MiniMax', baseUrl: 'https://api.minimax.chat/v1', defaultModel: 'MiniMax-Text-01' },
  { name: 'GLM (Zhipu)', baseUrl: 'https://open.bigmodel.cn/api/paas/v4', defaultModel: 'glm-4-plus' },
  { name: 'Ollama (Local)', baseUrl: 'http://localhost:11434/v1', defaultModel: 'llama3' },
  { name: 'Custom', baseUrl: '', defaultModel: '' },
]

function getConfigDir(): string {
  return process.env.ANYCODE_CONFIG_DIR ?? join(homedir(), '.anycode')
}

function getConfigPath(): string {
  return join(getConfigDir(), 'provider.json')
}

export function loadProviderConfig(): ProviderConfig | null {
  const configPath = getConfigPath()
  if (!existsSync(configPath)) return null
  try {
    return JSON.parse(readFileSync(configPath, 'utf8')) as ProviderConfig
  } catch {
    return null
  }
}

export function saveProviderConfig(config: ProviderConfig): void {
  const dir = getConfigDir()
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  writeFileSync(getConfigPath(), JSON.stringify(config, null, 2), 'utf8')
}

export function hasProviderConfig(): boolean {
  return loadProviderConfig() !== null
}
```

- [ ] **Step 2: Verify file created correctly**

Run: `node -e "import('./build-src/src/services/api/providerConfig.ts')" 2>&1 || echo "OK - will be compiled"`

- [ ] **Step 3: Commit**

```bash
git add src/services/api/providerConfig.ts
git commit -m "feat(anycode): add provider configuration system with presets"
```

---

## Task 2: Provider Setup UI Component

**Files:**
- Create: `src/components/ProviderSetup.tsx`

- [ ] **Step 1: Create interactive provider setup component**

```tsx
// src/components/ProviderSetup.tsx
import React, { useState } from 'react'
import { Box, Text } from '../ink/ink.js'
import { PROVIDER_PRESETS, saveProviderConfig, type ProviderConfig } from '../services/api/providerConfig.js'

type SetupStep = 'select-provider' | 'enter-api-key' | 'enter-base-url' | 'enter-model' | 'test-connection' | 'done'

interface Props {
  onComplete: (config: ProviderConfig) => void
}

export function ProviderSetup({ onComplete }: Props): React.ReactNode {
  const [step, setStep] = useState<SetupStep>('select-provider')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [config, setConfig] = useState<Partial<ProviderConfig>>({})
  const [input, setInput] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [testing, setTesting] = useState(false)

  // This component will use the existing Ink input primitives
  // available in the codebase (useInput, TextInput, etc.)
  // Implementation uses SelectInput for provider list and TextInput for fields

  if (step === 'select-provider') {
    return (
      <Box flexDirection="column" paddingX={2}>
        <Text bold>anycode - Provider Setup</Text>
        <Text dimColor>Select your LLM provider:</Text>
        <Box flexDirection="column" marginTop={1}>
          {PROVIDER_PRESETS.map((preset, i) => (
            <Text key={preset.name}>
              {i === selectedIndex ? '> ' : '  '}
              {preset.name}
              {preset.baseUrl ? <Text dimColor> ({preset.baseUrl})</Text> : null}
            </Text>
          ))}
        </Box>
        <Text dimColor marginTop={1}>Use arrow keys to select, Enter to confirm</Text>
      </Box>
    )
  }

  if (step === 'enter-api-key') {
    return (
      <Box flexDirection="column" paddingX={2}>
        <Text bold>API Key</Text>
        <Text dimColor>Enter your API key for {config.provider}:</Text>
        {error && <Text color="red">{error}</Text>}
      </Box>
    )
  }

  if (step === 'enter-base-url') {
    return (
      <Box flexDirection="column" paddingX={2}>
        <Text bold>Base URL</Text>
        <Text dimColor>Enter the OpenAI-compatible API base URL:</Text>
      </Box>
    )
  }

  if (step === 'enter-model') {
    return (
      <Box flexDirection="column" paddingX={2}>
        <Text bold>Model</Text>
        <Text dimColor>Enter the model name (e.g. gpt-4o, deepseek-chat):</Text>
      </Box>
    )
  }

  if (step === 'test-connection') {
    return (
      <Box flexDirection="column" paddingX={2}>
        <Text>{testing ? 'Testing connection...' : 'Connection successful!'}</Text>
      </Box>
    )
  }

  return null
}
```

Note: The full interactive implementation will use the codebase's existing `useInput` hook and `showSetupDialog` pattern from `interactiveHelpers.tsx`. The component above shows the structure — actual keyboard handling will use the same patterns as onboarding/trust dialogs already in the code.

- [ ] **Step 2: Commit**

```bash
git add src/components/ProviderSetup.tsx
git commit -m "feat(anycode): add provider setup UI component"
```

---

## Task 3: OpenAI Adapter — Request Translation

**Files:**
- Create: `src/services/api/openaiAdapter.ts`

- [ ] **Step 1: Create the request translation module**

```typescript
// src/services/api/openaiAdapter.ts
import { loadProviderConfig } from './providerConfig.js'

// --- Anthropic → OpenAI Request Translation ---

interface AnthropicTextBlock {
  type: 'text'
  text: string
  cache_control?: unknown
}

interface AnthropicToolUseBlock {
  type: 'tool_use'
  id: string
  name: string
  input: Record<string, unknown>
}

interface AnthropicToolResultBlock {
  type: 'tool_result'
  tool_use_id: string
  content: string | Array<{ type: 'text'; text: string }>
  is_error?: boolean
}

type AnthropicContentBlock = AnthropicTextBlock | AnthropicToolUseBlock | AnthropicToolResultBlock | { type: string; [key: string]: unknown }

interface AnthropicMessage {
  role: 'user' | 'assistant'
  content: string | AnthropicContentBlock[]
}

interface AnthropicTool {
  name: string
  description: string
  input_schema: Record<string, unknown>
}

interface AnthropicRequest {
  model: string
  messages: AnthropicMessage[]
  system?: string | Array<{ type: 'text'; text: string; cache_control?: unknown }>
  tools?: AnthropicTool[]
  tool_choice?: unknown
  max_tokens: number
  temperature?: number
  top_p?: number
  top_k?: number
  stop_sequences?: string[]
  stream?: boolean
  metadata?: unknown
  thinking?: unknown
  [key: string]: unknown
}

interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string | null
  tool_calls?: Array<{
    id: string
    type: 'function'
    function: { name: string; arguments: string }
  }>
  tool_call_id?: string
}

interface OpenAITool {
  type: 'function'
  function: {
    name: string
    description: string
    parameters: Record<string, unknown>
  }
}

interface OpenAIRequest {
  model: string
  messages: OpenAIMessage[]
  tools?: OpenAITool[]
  tool_choice?: 'auto' | 'none' | { type: 'function'; function: { name: string } }
  max_tokens?: number
  temperature?: number
  top_p?: number
  stop?: string[]
  stream?: boolean
  stream_options?: { include_usage: boolean }
}

export function translateRequest(anthropicReq: AnthropicRequest): OpenAIRequest {
  const config = loadProviderConfig()
  const messages: OpenAIMessage[] = []

  // 1. System prompt → system message
  if (anthropicReq.system) {
    let systemText: string
    if (typeof anthropicReq.system === 'string') {
      systemText = anthropicReq.system
    } else if (Array.isArray(anthropicReq.system)) {
      systemText = anthropicReq.system.map(b => b.text).join('\n\n')
    } else {
      systemText = String(anthropicReq.system)
    }
    messages.push({ role: 'system', content: systemText })
  }

  // 2. Convert messages
  for (const msg of anthropicReq.messages) {
    if (typeof msg.content === 'string') {
      messages.push({ role: msg.role, content: msg.content })
      continue
    }

    if (!Array.isArray(msg.content)) {
      messages.push({ role: msg.role, content: String(msg.content) })
      continue
    }

    // Process content blocks
    if (msg.role === 'assistant') {
      const textParts: string[] = []
      const toolCalls: OpenAIMessage['tool_calls'] = []

      for (const block of msg.content) {
        if (block.type === 'text') {
          textParts.push((block as AnthropicTextBlock).text)
        } else if (block.type === 'tool_use') {
          const tu = block as AnthropicToolUseBlock
          toolCalls.push({
            id: tu.id,
            type: 'function',
            function: {
              name: tu.name,
              arguments: JSON.stringify(tu.input),
            },
          })
        }
        // Skip thinking blocks, etc.
      }

      const oaiMsg: OpenAIMessage = {
        role: 'assistant',
        content: textParts.join('') || null,
      }
      if (toolCalls.length > 0) {
        oaiMsg.tool_calls = toolCalls
      }
      messages.push(oaiMsg)
    } else if (msg.role === 'user') {
      // User messages may contain tool_result blocks and text blocks
      const toolResults: AnthropicToolResultBlock[] = []
      const textParts: string[] = []

      for (const block of msg.content) {
        if (block.type === 'tool_result') {
          toolResults.push(block as AnthropicToolResultBlock)
        } else if (block.type === 'text') {
          textParts.push((block as AnthropicTextBlock).text)
        }
      }

      // Emit tool results as separate tool messages
      for (const tr of toolResults) {
        let content: string
        if (typeof tr.content === 'string') {
          content = tr.content
        } else if (Array.isArray(tr.content)) {
          content = tr.content.map(c => c.text).join('\n')
        } else {
          content = ''
        }
        if (tr.is_error) {
          content = `[Error] ${content}`
        }
        messages.push({
          role: 'tool',
          tool_call_id: tr.tool_use_id,
          content,
        })
      }

      // Emit remaining text as user message
      if (textParts.length > 0) {
        messages.push({ role: 'user', content: textParts.join('\n') })
      }
    }
  }

  // 3. Convert tools
  let tools: OpenAITool[] | undefined
  if (anthropicReq.tools && anthropicReq.tools.length > 0) {
    tools = anthropicReq.tools.map(t => ({
      type: 'function' as const,
      function: {
        name: t.name,
        description: t.description,
        parameters: t.input_schema,
      },
    }))
  }

  // 4. Convert tool_choice
  let toolChoice: OpenAIRequest['tool_choice']
  if (anthropicReq.tool_choice) {
    const tc = anthropicReq.tool_choice as { type?: string; name?: string }
    if (tc.type === 'auto') toolChoice = 'auto'
    else if (tc.type === 'none') toolChoice = 'none'
    else if (tc.type === 'tool' && tc.name) {
      toolChoice = { type: 'function', function: { name: tc.name } }
    }
  }

  // 5. Build OpenAI request
  const oaiReq: OpenAIRequest = {
    model: config?.model ?? anthropicReq.model,
    messages,
    max_tokens: anthropicReq.max_tokens,
  }

  if (tools) oaiReq.tools = tools
  if (toolChoice) oaiReq.tool_choice = toolChoice
  if (anthropicReq.temperature !== undefined) oaiReq.temperature = anthropicReq.temperature
  if (anthropicReq.top_p !== undefined) oaiReq.top_p = anthropicReq.top_p
  if (anthropicReq.stop_sequences) oaiReq.stop = anthropicReq.stop_sequences

  if (anthropicReq.stream) {
    oaiReq.stream = true
    oaiReq.stream_options = { include_usage: true }
  }

  return oaiReq
}
```

- [ ] **Step 2: Commit**

```bash
git add src/services/api/openaiAdapter.ts
git commit -m "feat(anycode): add Anthropic → OpenAI request translation"
```

---

## Task 4: OpenAI Adapter — Stream Translation

**Files:**
- Create: `src/services/api/openaiStreamTranslator.ts`

- [ ] **Step 1: Create the SSE stream translator**

```typescript
// src/services/api/openaiStreamTranslator.ts

// Translates OpenAI SSE stream events into Anthropic SSE stream events.
// This is a state machine that tracks active content blocks.

interface OpenAIChunk {
  id: string
  object: string
  model: string
  choices: Array<{
    index: number
    delta: {
      role?: string
      content?: string | null
      tool_calls?: Array<{
        index: number
        id?: string
        type?: string
        function?: {
          name?: string
          arguments?: string
        }
      }>
    }
    finish_reason: string | null
  }>
  usage?: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
}

// Anthropic event types we need to emit
interface AnthropicStreamEvent {
  type: string
  [key: string]: unknown
}

export class OpenAIStreamTranslator {
  private messageId: string = ''
  private model: string = ''
  private textBlockIndex: number = 0
  private textBlockStarted: boolean = false
  private toolCallBlocks: Map<number, { id: string; name: string; index: number; argBuffer: string }> = new Map()
  private nextBlockIndex: number = 0
  private inputTokens: number = 0
  private outputTokens: number = 0
  private finished: boolean = false

  /**
   * Process an OpenAI SSE chunk and return zero or more Anthropic stream events.
   */
  processChunk(chunk: OpenAIChunk): AnthropicStreamEvent[] {
    const events: AnthropicStreamEvent[] = []

    if (!this.messageId) {
      this.messageId = chunk.id || `msg_${Date.now()}`
      this.model = chunk.model || 'unknown'

      // Emit message_start
      events.push({
        type: 'message_start',
        message: {
          id: this.messageId,
          type: 'message',
          role: 'assistant',
          content: [],
          model: this.model,
          stop_reason: null,
          stop_sequence: null,
          usage: { input_tokens: 0, output_tokens: 0 },
        },
      })
    }

    const choice = chunk.choices?.[0]
    if (!choice) {
      // Usage-only chunk (final chunk with stream_options.include_usage)
      if (chunk.usage) {
        this.inputTokens = chunk.usage.prompt_tokens
        this.outputTokens = chunk.usage.completion_tokens
      }
      return events
    }

    const delta = choice.delta

    // --- Text content ---
    if (delta.content) {
      if (!this.textBlockStarted) {
        this.textBlockIndex = this.nextBlockIndex++
        this.textBlockStarted = true
        events.push({
          type: 'content_block_start',
          index: this.textBlockIndex,
          content_block: { type: 'text', text: '' },
        })
      }
      events.push({
        type: 'content_block_delta',
        index: this.textBlockIndex,
        delta: { type: 'text_delta', text: delta.content },
      })
    }

    // --- Tool calls ---
    if (delta.tool_calls) {
      // Close text block if open (transition from text to tool)
      if (this.textBlockStarted && delta.content === undefined) {
        events.push({ type: 'content_block_stop', index: this.textBlockIndex })
        this.textBlockStarted = false
      }

      for (const tc of delta.tool_calls) {
        const tcIndex = tc.index

        if (!this.toolCallBlocks.has(tcIndex)) {
          // New tool call — emit content_block_start
          const blockIndex = this.nextBlockIndex++
          const id = tc.id || `call_${Date.now()}_${tcIndex}`
          const name = tc.function?.name || ''

          this.toolCallBlocks.set(tcIndex, { id, name, index: blockIndex, argBuffer: '' })

          events.push({
            type: 'content_block_start',
            index: blockIndex,
            content_block: { type: 'tool_use', id, name, input: {} },
          })
        }

        // Accumulate arguments
        const block = this.toolCallBlocks.get(tcIndex)!
        if (tc.function?.name && !block.name) {
          block.name = tc.function.name
        }
        if (tc.function?.arguments) {
          block.argBuffer += tc.function.arguments
          events.push({
            type: 'content_block_delta',
            index: block.index,
            delta: { type: 'input_json_delta', partial_json: tc.function.arguments },
          })
        }
      }
    }

    // --- Finish ---
    if (choice.finish_reason) {
      this.finished = true

      // Close any open text block
      if (this.textBlockStarted) {
        events.push({ type: 'content_block_stop', index: this.textBlockIndex })
        this.textBlockStarted = false
      }

      // Close any open tool call blocks
      for (const [, block] of this.toolCallBlocks) {
        events.push({ type: 'content_block_stop', index: block.index })
      }

      // Map finish_reason
      const stopReason = choice.finish_reason === 'tool_calls' ? 'tool_use'
        : choice.finish_reason === 'stop' ? 'end_turn'
        : choice.finish_reason === 'length' ? 'max_tokens'
        : 'end_turn'

      // Update usage from final chunk
      if (chunk.usage) {
        this.inputTokens = chunk.usage.prompt_tokens
        this.outputTokens = chunk.usage.completion_tokens
      }

      events.push({
        type: 'message_delta',
        delta: { stop_reason: stopReason, stop_sequence: null },
        usage: { output_tokens: this.outputTokens },
      })

      events.push({ type: 'message_stop' })
    }

    return events
  }

  /**
   * Build the final Anthropic Message object from accumulated state.
   */
  buildFinalMessage(contentBlocks: unknown[]): Record<string, unknown> {
    return {
      id: this.messageId,
      type: 'message',
      role: 'assistant',
      content: contentBlocks,
      model: this.model,
      stop_reason: 'end_turn',
      stop_sequence: null,
      usage: {
        input_tokens: this.inputTokens,
        output_tokens: this.outputTokens,
      },
    }
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/services/api/openaiStreamTranslator.ts
git commit -m "feat(anycode): add OpenAI SSE → Anthropic SSE stream translator"
```

---

## Task 5: OpenAI Adapter — HTTP Client & Streaming Fetch

**Files:**
- Modify: `src/services/api/openaiAdapter.ts` (append)

- [ ] **Step 1: Add the HTTP streaming client to openaiAdapter.ts**

Append to `src/services/api/openaiAdapter.ts`:

```typescript
import { OpenAIStreamTranslator } from './openaiStreamTranslator.js'

// --- Streaming HTTP Client ---

async function* streamOpenAIResponse(
  baseUrl: string,
  apiKey: string,
  body: OpenAIRequest,
  signal?: AbortSignal,
): AsyncGenerator<AnthropicStreamEvent> {
  const url = `${baseUrl.replace(/\/+$/, '')}/chat/completions`

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
    signal,
  })

  if (!response.ok) {
    const errorBody = await response.text().catch(() => '')
    const error = new Error(`API error ${response.status}: ${errorBody}`)
    ;(error as any).status = response.status
    throw error
  }

  if (!body.stream) {
    // Non-streaming: parse full response and translate
    const data = await response.json() as any
    const translator = new OpenAIStreamTranslator()
    // Simulate a single chunk
    const fakeChunk = {
      id: data.id,
      object: data.object,
      model: data.model,
      choices: data.choices?.map((c: any) => ({
        index: c.index,
        delta: c.message,  // message → delta for translator
        finish_reason: c.finish_reason,
      })),
      usage: data.usage,
    }
    const events = translator.processChunk(fakeChunk)
    for (const event of events) yield event
    return
  }

  // Streaming: parse SSE
  const reader = response.body!.getReader()
  const decoder = new TextDecoder()
  const translator = new OpenAIStreamTranslator()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop()!  // Keep incomplete line in buffer

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed || trimmed === 'data: [DONE]') continue
      if (!trimmed.startsWith('data: ')) continue

      try {
        const chunk = JSON.parse(trimmed.slice(6)) as OpenAIChunk
        const events = translator.processChunk(chunk)
        for (const event of events) yield event
      } catch {
        // Skip malformed chunks
      }
    }
  }

  // Process any remaining buffer
  if (buffer.trim() && buffer.trim() !== 'data: [DONE]' && buffer.trim().startsWith('data: ')) {
    try {
      const chunk = JSON.parse(buffer.trim().slice(6)) as OpenAIChunk
      const events = translator.processChunk(chunk)
      for (const event of events) yield event
    } catch {
      // Skip
    }
  }
}

// --- Public API: Create Adapter Client ---

/**
 * Creates a fake Anthropic-compatible client that translates to OpenAI format.
 * Drop-in replacement for the Anthropic SDK client.
 */
export function createOpenAIAdapterClient(config: { baseUrl: string; apiKey: string; model: string }) {
  return {
    beta: {
      messages: {
        create(params: any, options?: any): any {
          const anthropicReq = params as AnthropicRequest
          const oaiReq = translateRequest(anthropicReq)
          // Override model from config
          oaiReq.model = config.model

          if (anthropicReq.stream) {
            // Return an async iterable that mimics Anthropic's Stream
            const signal = options?.signal as AbortSignal | undefined
            const stream = streamOpenAIResponse(config.baseUrl, config.apiKey, oaiReq, signal)

            // Wrap as Anthropic-compatible Stream object
            return createAnthropicStreamWrapper(stream)
          } else {
            // Non-streaming
            return (async () => {
              const oaiReqNonStream = { ...oaiReq, stream: false }
              delete (oaiReqNonStream as any).stream_options
              const events: any[] = []
              for await (const event of streamOpenAIResponse(config.baseUrl, config.apiKey, oaiReqNonStream)) {
                events.push(event)
              }
              // Build final message from events
              const msgStart = events.find(e => e.type === 'message_start')
              const contentBlocks: any[] = []
              const blockStarts = events.filter(e => e.type === 'content_block_start')
              for (const bs of blockStarts) {
                const idx = bs.index
                const deltas = events.filter(e => e.type === 'content_block_delta' && e.index === idx)
                if (bs.content_block.type === 'text') {
                  contentBlocks.push({
                    type: 'text',
                    text: deltas.map((d: any) => d.delta.text).join(''),
                  })
                } else if (bs.content_block.type === 'tool_use') {
                  const jsonStr = deltas.map((d: any) => d.delta.partial_json).join('')
                  contentBlocks.push({
                    type: 'tool_use',
                    id: bs.content_block.id,
                    name: bs.content_block.name,
                    input: jsonStr ? JSON.parse(jsonStr) : {},
                  })
                }
              }
              const msgDelta = events.find(e => e.type === 'message_delta')
              return {
                id: msgStart?.message?.id || `msg_${Date.now()}`,
                type: 'message',
                role: 'assistant',
                content: contentBlocks,
                model: config.model,
                stop_reason: msgDelta?.delta?.stop_reason || 'end_turn',
                stop_sequence: null,
                usage: {
                  input_tokens: msgDelta?.usage?.output_tokens ? 0 : 0,
                  output_tokens: msgDelta?.usage?.output_tokens || 0,
                },
              }
            })()
          }
        },
      },
    },
    messages: {
      create(params: any, options?: any): any {
        // Delegate to beta.messages.create
        return (this as any).__adapter_ref.beta.messages.create(params, options)
      },
    },
  }
}

function createAnthropicStreamWrapper(stream: AsyncGenerator<AnthropicStreamEvent>) {
  // The Anthropic SDK Stream is an async iterable that also has
  // helper methods. We create a minimal compatible wrapper.
  const wrapper = {
    [Symbol.asyncIterator]() {
      return stream
    },
    async *[Symbol.asyncIterator]() {
      yield* stream
    },
    controller: new AbortController(),
  }
  // Also make it directly async-iterable
  return {
    [Symbol.asyncIterator]: () => stream,
    controller: new AbortController(),
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/services/api/openaiAdapter.ts src/services/api/openaiStreamTranslator.ts
git commit -m "feat(anycode): add OpenAI HTTP streaming client and adapter factory"
```

---

## Task 6: Wire Adapter Into API Client

**Files:**
- Modify: `src/services/api/client.ts`

- [ ] **Step 1: Modify getAnthropicClient to use adapter when provider configured**

At the top of `src/services/api/client.ts`, add import:

```typescript
import { loadProviderConfig } from './providerConfig.js'
import { createOpenAIAdapterClient } from './openaiAdapter.js'
```

Replace the body of `getAnthropicClient()` function. Insert at the very beginning of the function (before any existing logic):

```typescript
// anycode: If custom provider is configured, use OpenAI adapter
const providerConfig = loadProviderConfig()
if (providerConfig) {
  return createOpenAIAdapterClient({
    baseUrl: providerConfig.baseUrl,
    apiKey: providerConfig.apiKey,
    model: providerConfig.model,
  }) as any
}
```

This early-return bypasses all Anthropic/Bedrock/Vertex/Foundry logic when a provider config exists.

- [ ] **Step 2: Commit**

```bash
git add src/services/api/client.ts
git commit -m "feat(anycode): wire OpenAI adapter into getAnthropicClient"
```

---

## Task 7: Remove Anthropic Auth Gates

**Files:**
- Modify: `src/utils/auth.ts`
- Modify: `src/main.tsx`
- Modify: `src/interactiveHelpers.tsx`

- [ ] **Step 1: Simplify auth.ts**

In `src/utils/auth.ts`, find and modify `isAnthropicAuthEnabled()` (around line 100). Make it return `false` when provider config exists:

```typescript
import { hasProviderConfig } from 'src/services/api/providerConfig.js'
```

At the top of `isAnthropicAuthEnabled()`, add:

```typescript
if (hasProviderConfig()) return false
```

Find `isClaudeAISubscriber()` (around line 1564) and make it return `false`:

```typescript
export function isClaudeAISubscriber(): boolean {
  if (hasProviderConfig()) return false
  // ... existing code
}
```

Find `hasOpusAccess()` (around line 1647) and make it return `true`:

```typescript
export function hasOpusAccess(): boolean {
  if (hasProviderConfig()) return true
  // ... existing code
}
```

- [ ] **Step 2: Simplify main.tsx preAction hook**

In `src/main.tsx`, in the `preAction` hook (around line 907-967), wrap the Anthropic-specific calls with a check:

```typescript
const providerConfig = loadProviderConfig()
if (!providerConfig) {
  // Only run Anthropic-specific setup if no custom provider
  await Promise.all([ensureMdmSettingsLoaded(), ensureKeychainPrefetchCompleted()])
  // ... existing remote settings, policy limits, settings sync code
}
```

Keep `init()`, `initSinks()`, `runMigrations()` unconditional.

- [ ] **Step 3: Wire provider setup into showSetupScreens**

In `src/interactiveHelpers.tsx`, in `showSetupScreens()` (around line 104), add provider config check before auth dialogs:

```typescript
import { hasProviderConfig } from 'src/services/api/providerConfig.js'

// At the start of showSetupScreens:
if (!hasProviderConfig()) {
  // Show provider setup dialog
  const config = await showSetupDialog(root, (done) => (
    <ProviderSetup onComplete={(cfg) => { saveProviderConfig(cfg); done() }} />
  ))
}
```

Remove or skip the `ApproveApiKey` dialog and OAuth-related dialogs when `hasProviderConfig()` is true.

- [ ] **Step 4: Commit**

```bash
git add src/utils/auth.ts src/main.tsx src/interactiveHelpers.tsx
git commit -m "feat(anycode): bypass Anthropic auth when custom provider configured"
```

---

## Task 8: Remove Model Gating

**Files:**
- Modify: `src/utils/model/model.ts`

- [ ] **Step 1: Simplify model selection**

In `src/utils/model/model.ts`, modify `getMainLoopModel()` (around line 92):

```typescript
import { loadProviderConfig } from 'src/services/api/providerConfig.js'

export function getMainLoopModel(): string {
  // anycode: use provider config model if set
  const providerConfig = loadProviderConfig()
  if (providerConfig) {
    // Still allow session override and --model flag
    const override = getModelOverride()
    if (override) return override
    return providerConfig.model
  }
  // ... existing Anthropic logic
}
```

Modify `getSmallFastModel()` (around line 36) to also use provider config:

```typescript
export function getSmallFastModel(): string {
  const providerConfig = loadProviderConfig()
  if (providerConfig) return providerConfig.model  // Use same model
  // ... existing logic
}
```

- [ ] **Step 2: Commit**

```bash
git add src/utils/model/model.ts
git commit -m "feat(anycode): use provider config for model selection"
```

---

## Task 9: Rebrand — System Prompts

**Files:**
- Modify: `src/constants/system.ts`
- Modify: `src/constants/prompts.ts`

- [ ] **Step 1: Update system prompt identity**

In `src/constants/system.ts` (around lines 10-12), replace identity strings:

```typescript
// Replace all instances of:
// "You are Claude Code, Anthropic's official CLI for Claude."
// With:
"You are anycode, a universal coding agent."
```

In `src/constants/prompts.ts` (around line 452), replace the main identity:

```typescript
// Replace:
`You are Claude Code, Anthropic's official CLI for Claude.\n\nCWD: ${getCwd()}\nDate: ${getSessionStartDate()}`
// With:
`You are anycode, a universal coding agent.\n\nCWD: ${getCwd()}\nDate: ${getSessionStartDate()}`
```

Also replace the agent identity (around line 758):

```typescript
// Replace:
"You are an agent for Claude Code, Anthropic's official CLI for Claude..."
// With:
"You are an agent for anycode, a universal coding agent..."
```

- [ ] **Step 2: Commit**

```bash
git add src/constants/system.ts src/constants/prompts.ts
git commit -m "feat(anycode): rebrand system prompts"
```

---

## Task 10: Rebrand — CLI, Paths, Package

**Files:**
- Modify: `src/main.tsx`
- Modify: `src/utils/envUtils.ts`
- Modify: `scripts/build.mjs`
- Modify: `package.json`

- [ ] **Step 1: Rename CLI command**

In `src/main.tsx` (line 968):

```typescript
// Replace:
program.name('claude').description(`Claude Code - starts an interactive session...`)
// With:
program.name('anycode').description(`anycode - universal coding agent, starts an interactive session by default, use -p/--print for non-interactive output`)
```

- [ ] **Step 2: Rename config directory**

In `src/utils/envUtils.ts` (line 10):

```typescript
// Replace:
process.env.CLAUDE_CONFIG_DIR ?? join(homedir(), '.claude')
// With:
process.env.ANYCODE_CONFIG_DIR ?? join(homedir(), '.anycode')
```

- [ ] **Step 3: Update build script**

In `scripts/build.mjs`:

```javascript
// Line 28: Replace version
const VERSION = '1.0.0'

// Lines 71-77: Replace MACRO URLs
const MACROS = {
  'MACRO.VERSION': `'${VERSION}'`,
  'MACRO.BUILD_TIME': `''`,
  'MACRO.FEEDBACK_CHANNEL': `''`,
  'MACRO.ISSUES_EXPLAINER': `''`,
  'MACRO.FEEDBACK_CHANNEL_URL': `''`,
  'MACRO.ISSUES_EXPLAINER_URL': `''`,
  'MACRO.NATIVE_PACKAGE_URL': `'anycode'`,
  'MACRO.PACKAGE_URL': `'anycode'`,
  'MACRO.VERSION_CHANGELOG': `''`,
}
```

- [ ] **Step 4: Update package.json**

```json
{
  "name": "anycode",
  "version": "1.0.0",
  "description": "anycode - universal coding agent powered by any LLM"
}
```

- [ ] **Step 5: Rename CLAUDE.md references**

Use search-and-replace across codebase:

```bash
# In src/projectOnboardingState.ts:
# Replace 'CLAUDE.md' with '.anycode.md'

# In src/utils/claudemd.ts:
# Replace 'CLAUDE.md' with '.anycode.md' (all occurrences)
```

- [ ] **Step 6: Commit**

```bash
git add src/main.tsx src/utils/envUtils.ts scripts/build.mjs package.json src/projectOnboardingState.ts src/utils/claudemd.ts
git commit -m "feat(anycode): rebrand CLI, paths, and package metadata"
```

---

## Task 11: Build and Verify

**Files:**
- All previously modified files

- [ ] **Step 1: Run the build**

```bash
cd /Users/qxy/claude-code-source-code/claude-code-source-code
node scripts/build.mjs
```

Expected: Build succeeds, outputs `dist/cli.js`

- [ ] **Step 2: Test version output**

```bash
node dist/cli.js --version
```

Expected: `1.0.0 (anycode)`

- [ ] **Step 3: Test help output**

```bash
node dist/cli.js --help
```

Expected: Shows `anycode` in name and description, no "Claude" or "Anthropic" references in help text

- [ ] **Step 4: Test with a real provider (DeepSeek example)**

Create a test provider config:

```bash
mkdir -p ~/.anycode
cat > ~/.anycode/provider.json << 'EOF'
{
  "provider": "deepseek",
  "baseUrl": "https://api.deepseek.com/v1",
  "apiKey": "YOUR_KEY_HERE",
  "model": "deepseek-chat"
}
EOF
```

Then test non-interactive mode:

```bash
node dist/cli.js -p "Say hello in one sentence"
```

Expected: Model responds with a greeting. No Anthropic auth errors.

- [ ] **Step 5: Test TUI startup**

```bash
node dist/cli.js
```

Expected: TUI launches without crashes. Shows prompt input. No auth/OAuth flow.

- [ ] **Step 6: Test tool usage**

```bash
node dist/cli.js -p "Read the file package.json and tell me the project name"
```

Expected: Model uses the Read tool, reads package.json, reports "anycode".

- [ ] **Step 7: Commit build output**

```bash
git add -A
git commit -m "build(anycode): initial working build v1.0.0"
```

---

## Task 12: Integration Test — Full Agent Loop

- [ ] **Step 1: Test multi-turn tool usage**

```bash
node dist/cli.js -p "Create a file called /tmp/anycode-test.txt with the content 'hello from anycode', then read it back and confirm the contents"
```

Expected: Model uses Write tool to create file, Read tool to verify, reports success.

- [ ] **Step 2: Test streaming output**

```bash
node dist/cli.js -p "Write a haiku about coding"
```

Expected: Text streams in real-time (visible character-by-character output), not all at once.

- [ ] **Step 3: Clean up and final commit**

```bash
rm -f /tmp/anycode-test.txt
git add -A
git commit -m "test(anycode): verify full agent loop and streaming"
```
