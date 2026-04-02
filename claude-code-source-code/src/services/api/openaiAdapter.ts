/**
 * OpenAI Adapter — translates Anthropic SDK calls to OpenAI-compatible API format.
 * This is the core translation layer that makes anycode provider-agnostic.
 */

import { OpenAIStreamTranslator, type OpenAIChunk, type AnthropicStreamEvent } from './openaiStreamTranslator.js'
import { loadProviderConfig, getMaxTokensForProvider } from './providerConfig.js'

// ── Anthropic Types (subset needed for translation) ──

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
  stop_sequences?: string[]
  stream?: boolean
  [key: string]: unknown
}

// ── OpenAI Types ──

type OpenAIContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string; detail?: string } }

interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string | null | OpenAIContentPart[]
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
  max_completion_tokens?: number
  temperature?: number
  top_p?: number
  stop?: string[]
  stream?: boolean
  stream_options?: { include_usage: boolean }
}

// ── Request Translation ──

export function translateRequest(anthropicReq: AnthropicRequest): OpenAIRequest {
  const config = loadProviderConfig()
  const messages: OpenAIMessage[] = []

  // System prompt → system message
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

  // Convert messages
  for (const msg of anthropicReq.messages) {
    if (typeof msg.content === 'string') {
      messages.push({ role: msg.role, content: msg.content })
      continue
    }
    if (!Array.isArray(msg.content)) {
      messages.push({ role: msg.role, content: String(msg.content) })
      continue
    }

    if (msg.role === 'assistant') {
      const textParts: string[] = []
      const toolCalls: NonNullable<OpenAIMessage['tool_calls']> = []

      for (const block of msg.content) {
        if (block.type === 'text') {
          textParts.push((block as AnthropicTextBlock).text)
        } else if (block.type === 'tool_use') {
          const tu = block as AnthropicToolUseBlock
          toolCalls.push({
            id: tu.id,
            type: 'function',
            function: { name: tu.name, arguments: JSON.stringify(tu.input) },
          })
        }
      }

      const oaiMsg: OpenAIMessage = {
        role: 'assistant',
        content: textParts.join('') || null,
      }
      if (toolCalls.length > 0) oaiMsg.tool_calls = toolCalls
      messages.push(oaiMsg)
    } else if (msg.role === 'user') {
      const toolResults: AnthropicToolResultBlock[] = []
      const contentParts: OpenAIContentPart[] = []

      for (const block of msg.content) {
        if (block.type === 'tool_result') {
          toolResults.push(block as AnthropicToolResultBlock)
        } else if (block.type === 'text') {
          contentParts.push({ type: 'text', text: (block as AnthropicTextBlock).text })
        } else if (block.type === 'image') {
          // Anthropic image format → OpenAI image_url format
          const img = block as any
          if (img.source?.type === 'base64') {
            const dataUrl = `data:${img.source.media_type};base64,${img.source.data}`
            contentParts.push({ type: 'image_url', image_url: { url: dataUrl } })
          } else if (img.source?.type === 'url') {
            contentParts.push({ type: 'image_url', image_url: { url: img.source.url } })
          }
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
        if (tr.is_error) content = `[Error] ${content}`
        messages.push({ role: 'tool', tool_call_id: tr.tool_use_id, content })
      }

      // Emit content parts
      if (contentParts.length > 0) {
        // Use multimodal array format if there are images, plain string otherwise
        const hasImages = contentParts.some(p => p.type === 'image_url')
        if (hasImages) {
          messages.push({ role: 'user', content: contentParts })
        } else {
          messages.push({ role: 'user', content: contentParts.map(p => (p as any).text).join('\n') })
        }
      }
    }
  }

  // Convert tools
  let tools: OpenAITool[] | undefined
  if (anthropicReq.tools && anthropicReq.tools.length > 0) {
    tools = anthropicReq.tools.map(t => ({
      type: 'function' as const,
      function: { name: t.name, description: t.description, parameters: t.input_schema },
    }))
  }

  // Convert tool_choice
  let toolChoice: OpenAIRequest['tool_choice']
  if (anthropicReq.tool_choice) {
    const tc = anthropicReq.tool_choice as { type?: string; name?: string }
    if (tc.type === 'auto') toolChoice = 'auto'
    else if (tc.type === 'none') toolChoice = 'none'
    else if (tc.type === 'tool' && tc.name) {
      toolChoice = { type: 'function', function: { name: tc.name } }
    }
  }

  // Build request — cap max_tokens based on provider config
  const providerCfg = loadProviderConfig()
  const maxTokensCap = providerCfg ? getMaxTokensForProvider(providerCfg) : 8192
  const tokenLimit = Math.min(anthropicReq.max_tokens || maxTokensCap, maxTokensCap)
  const oaiReq: OpenAIRequest = {
    model: config?.model ?? anthropicReq.model,
    messages,
    // Use max_completion_tokens (new OpenAI standard, works with gpt-4o, gpt-5.1, o3, etc.)
    // Falls back to max_tokens via auto-retry if provider doesn't support it
    max_completion_tokens: tokenLimit,
  }

  if (tools) oaiReq.tools = tools
  if (toolChoice) oaiReq.tool_choice = toolChoice
  if (anthropicReq.temperature !== undefined) oaiReq.temperature = anthropicReq.temperature
  if (anthropicReq.top_p !== undefined) oaiReq.top_p = anthropicReq.top_p
  if (anthropicReq.stop_sequences) oaiReq.stop = anthropicReq.stop_sequences

  if (anthropicReq.stream) {
    oaiReq.stream = true
    // Some providers (Ollama, older APIs) don't support stream_options
    // Only add it for known-supported providers
    const providerName = providerCfg?.provider?.toLowerCase() || ''
    if (!providerName.includes('ollama')) {
      oaiReq.stream_options = { include_usage: true }
    }
  }

  return oaiReq
}

// ── Streaming HTTP Client ──

const MAX_RETRIES = 2
const REQUEST_TIMEOUT_MS = 300_000  // 5 minutes

async function fetchWithRetry(
  url: string,
  init: RequestInit,
  retries: number = MAX_RETRIES,
): Promise<Response> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
      const mergedSignal = init.signal
        ? AbortSignal.any([init.signal, controller.signal])
        : controller.signal

      const response = await fetch(url, { ...init, signal: mergedSignal })
      clearTimeout(timeoutId)

      // Retry on 429 (rate limit) and 5xx (server error)
      if ((response.status === 429 || response.status >= 500) && attempt < retries) {
        const delay = Math.min(1000 * Math.pow(2, attempt), 8000)
        await new Promise(r => setTimeout(r, delay))
        continue
      }
      return response
    } catch (e: any) {
      if (attempt < retries && !init.signal?.aborted) {
        // Retry on network errors (ECONNREFUSED, ETIMEDOUT, etc.)
        const delay = Math.min(1000 * Math.pow(2, attempt), 8000)
        await new Promise(r => setTimeout(r, delay))
        continue
      }
      // Friendly error for common network issues
      const msg = String(e?.cause?.code || e?.code || e?.message || e)
      if (msg.includes('ECONNREFUSED')) {
        throw new Error(`Connection refused at ${url}. Is the API server running?`)
      }
      if (msg.includes('ETIMEDOUT') || msg.includes('UND_ERR_CONNECT_TIMEOUT') || e.name === 'AbortError') {
        throw new Error(`Request timed out. The API at ${url} may be overloaded or unreachable.`)
      }
      if (msg.includes('ENOTFOUND') || msg.includes('getaddrinfo')) {
        throw new Error(`Cannot reach ${url}. Check your baseUrl in ~/.anycode/provider.json`)
      }
      if (msg.includes('fetch failed') || msg.includes('ECONNRESET')) {
        throw new Error(`Network error connecting to ${url}. Check your internet connection and baseUrl.`)
      }
      throw e
    }
  }
  throw new Error('Unreachable')
}

async function* streamOpenAIResponse(
  baseUrl: string,
  apiKey: string,
  body: OpenAIRequest,
  signal?: AbortSignal,
): AsyncGenerator<AnthropicStreamEvent> {
  const url = `${baseUrl.replace(/\/+$/, '')}/chat/completions`

  // Auto-retry with lower max_tokens on 400 errors
  let currentBody = body
  let response: Response | null = null
  for (let tokenRetry = 0; tokenRetry < 3; tokenRetry++) {
    response = await fetchWithRetry(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(currentBody),
      signal,
    })

    if (response.status === 400) {
      const errorBody = await response.text().catch(() => '')
      // Handle token parameter incompatibility between providers
      if (errorBody.includes('max_completion_tokens') && (currentBody as any).max_completion_tokens) {
        // Provider doesn't support max_completion_tokens → switch to max_tokens
        const tokens = (currentBody as any).max_completion_tokens
        const { max_completion_tokens: _, ...rest } = currentBody as any
        currentBody = { ...rest, max_tokens: tokens } as any
        continue
      }
      if (errorBody.includes('max_tokens') && errorBody.includes('unsupported') && (currentBody as any).max_tokens) {
        // Provider doesn't support max_tokens → switch to max_completion_tokens
        const tokens = (currentBody as any).max_tokens
        const { max_tokens: _, ...rest } = currentBody as any
        currentBody = { ...rest, max_completion_tokens: tokens } as any
        continue
      }
      if (errorBody.includes('max_tokens') && currentBody.max_tokens && currentBody.max_tokens > 1024) {
        currentBody = { ...currentBody, max_tokens: Math.floor(currentBody.max_tokens / 2) }
        continue
      }
      if (errorBody.includes('max_completion_tokens') && (currentBody as any).max_completion_tokens > 1024) {
        (currentBody as any).max_completion_tokens = Math.floor((currentBody as any).max_completion_tokens / 2)
        continue
      }
      const error: any = new Error(`API error 400: ${errorBody}`)
      error.status = 400
      throw error
    }
    break
  }

  if (!response!.ok) {
    const errorBody = await response!.text().catch(() => '')
    let message = `API error ${response!.status}: ${errorBody}`
    if (response!.status === 401) {
      message = `Authentication failed (${response!.status}). Check your API key in ~/.anycode/provider.json`
    } else if (response!.status === 429) {
      message = `Rate limited (${response!.status}). Wait a moment and try again.`
    } else if (response!.status === 404) {
      message = `Model or endpoint not found (${response!.status}). Check baseUrl and model in ~/.anycode/provider.json`
    }
    const error: any = new Error(message)
    error.status = response!.status
    throw error
  }

  const translator = new OpenAIStreamTranslator()

  if (!body.stream) {
    // Non-streaming: translate full response
    const data = await response.json() as any
    const fakeChunk: OpenAIChunk = {
      id: data.id,
      object: data.object,
      model: data.model,
      choices: data.choices?.map((c: any) => ({
        index: c.index,
        delta: c.message,
        finish_reason: c.finish_reason,
      })),
      usage: data.usage,
    }
    for (const event of translator.processChunk(fakeChunk)) yield event
    return
  }

  // Streaming: parse SSE
  const reader = response.body!.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop()!

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed || trimmed === 'data: [DONE]') continue
      if (!trimmed.startsWith('data: ')) continue

      try {
        const chunk = JSON.parse(trimmed.slice(6)) as OpenAIChunk
        for (const event of translator.processChunk(chunk)) yield event
      } catch {
        // Skip malformed chunks
      }
    }
  }

  // Flush remaining buffer
  if (buffer.trim() && buffer.trim() !== 'data: [DONE]' && buffer.trim().startsWith('data: ')) {
    try {
      const chunk = JSON.parse(buffer.trim().slice(6)) as OpenAIChunk
      for (const event of translator.processChunk(chunk)) yield event
    } catch {
      // Skip
    }
  }
}

// ── Public: Adapter Client Factory ──

/**
 * Creates a fake Anthropic-compatible client object that internally
 * translates all requests to OpenAI format and back.
 */
export function createOpenAIAdapterClient(config: { baseUrl: string; apiKey: string; model: string }) {
  function doCreate(params: any, options?: any): any {
    const anthropicReq = params as AnthropicRequest
    const oaiReq = translateRequest(anthropicReq)
    oaiReq.model = config.model

    const signal = options?.signal as AbortSignal | undefined

    if (anthropicReq.stream) {
      // Return async iterable mimicking Anthropic Stream with .withResponse()
      const eventStream = streamOpenAIResponse(config.baseUrl, config.apiKey, oaiReq, signal)
      const streamObj: any = {
        [Symbol.asyncIterator]: () => eventStream,
        controller: new AbortController(),
        // Anthropic SDK: .withResponse() returns { data: Stream, response, request_id }
        withResponse() {
          return Promise.resolve({
            data: streamObj,
            response: new Response(),
            request_id: `req_${Date.now()}`,
          })
        },
      }
      return streamObj
    }

    // Non-streaming: return Promise<Message> with .withResponse()
    const promise: any = (async () => {
      const nonStreamReq = { ...oaiReq, stream: false } as OpenAIRequest
      delete (nonStreamReq as any).stream_options
      const events: AnthropicStreamEvent[] = []
      for await (const event of streamOpenAIResponse(config.baseUrl, config.apiKey, nonStreamReq, signal)) {
        events.push(event)
      }
      return buildMessageFromEvents(events, config.model)
    })()
    promise.withResponse = () => promise.then((msg: any) => ({
      data: msg,
      response: new Response(),
      request_id: `req_${Date.now()}`,
    }))
    return promise
  }

  const client = {
    beta: {
      messages: {
        create: doCreate,
      },
    },
    messages: {
      create: doCreate,
    },
  }
  return client
}

function buildMessageFromEvents(events: AnthropicStreamEvent[], model: string): Record<string, unknown> {
  const msgStart = events.find(e => e.type === 'message_start') as any
  const contentBlocks: any[] = []
  const blockStarts = events.filter(e => e.type === 'content_block_start')

  for (const bs of blockStarts as any[]) {
    const idx = bs.index
    const deltas = events.filter(e => e.type === 'content_block_delta' && (e as any).index === idx)
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

  const msgDelta = events.find(e => e.type === 'message_delta') as any
  return {
    id: msgStart?.message?.id || `msg_${Date.now()}`,
    type: 'message',
    role: 'assistant',
    content: contentBlocks,
    model,
    stop_reason: msgDelta?.delta?.stop_reason || 'end_turn',
    stop_sequence: null,
    usage: {
      input_tokens: msgDelta?.usage?.input_tokens || 0,
      output_tokens: msgDelta?.usage?.output_tokens || 0,
    },
  }
}
