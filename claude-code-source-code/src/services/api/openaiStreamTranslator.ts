/**
 * Translates OpenAI SSE stream chunks into Anthropic SSE stream events.
 * Maintains state to track active content blocks (text, tool_use).
 */

export interface OpenAIChunk {
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
      // DeepSeek-R1 style: separate reasoning_content field
      reasoning_content?: string | null
    }
    finish_reason: string | null
  }>
  usage?: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
}

export interface AnthropicStreamEvent {
  type: string
  [key: string]: unknown
}

export class OpenAIStreamTranslator {
  private messageId: string = ''
  private model: string = ''
  private textBlockStarted: boolean = false
  private textBlockIndex: number = 0
  private isThinkingBlock: boolean = false
  private toolCallBlocks: Map<number, { id: string; name: string; index: number; argBuffer: string }> = new Map()
  private nextBlockIndex: number = 0
  private inputTokens: number = 0
  private outputTokens: number = 0

  // State for parsing <think>...</think> tags in content (MiniMax style)
  private inThinkTag: boolean = false
  private thinkTagBuffer: string = ''  // buffer for detecting partial tags

  processChunk(chunk: OpenAIChunk): AnthropicStreamEvent[] {
    const events: AnthropicStreamEvent[] = []

    // First chunk: emit message_start
    if (!this.messageId) {
      this.messageId = chunk.id || `msg_${Date.now()}`
      this.model = chunk.model || 'unknown'
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
      // Usage-only chunk (stream_options.include_usage final chunk)
      if (chunk.usage) {
        this.inputTokens = chunk.usage.prompt_tokens
        this.outputTokens = chunk.usage.completion_tokens
      }
      return events
    }

    const delta = choice.delta as any

    // --- Reasoning content (DeepSeek-R1, QwQ, etc.) ---
    // These models return reasoning_content as a separate field before the final answer.
    if (delta.reasoning_content) {
      if (!this.textBlockStarted) {
        this.textBlockIndex = this.nextBlockIndex++
        this.textBlockStarted = true
        this.isThinkingBlock = true
        events.push({
          type: 'content_block_start',
          index: this.textBlockIndex,
          content_block: { type: 'thinking', thinking: '' },
        })
      }
      events.push({
        type: 'content_block_delta',
        index: this.textBlockIndex,
        delta: { type: 'thinking_delta', thinking: delta.reasoning_content },
      })
    }

    // --- Text content (may contain <think> tags for MiniMax) ---
    if (delta.content) {
      const processed = this._processContentWithThinkTags(delta.content, events)
      // processed contains text segments to emit (already handled in the method)
    }

    // --- Tool calls ---
    if (delta.tool_calls) {
      // Close text block if transitioning from text to tool
      if (this.textBlockStarted && !delta.content) {
        events.push({ type: 'content_block_stop', index: this.textBlockIndex })
        this.textBlockStarted = false
      }

      for (const tc of delta.tool_calls) {
        const tcIndex = tc.index

        if (!this.toolCallBlocks.has(tcIndex)) {
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
      // Flush any remaining think tag buffer as text
      if (this.thinkTagBuffer) {
        this._emitText(this.thinkTagBuffer, events)
        this.thinkTagBuffer = ''
      }

      // Close open text block
      if (this.textBlockStarted) {
        events.push({ type: 'content_block_stop', index: this.textBlockIndex })
        this.textBlockStarted = false
      }

      // Close open tool call blocks
      for (const [, block] of this.toolCallBlocks) {
        events.push({ type: 'content_block_stop', index: block.index })
      }

      if (chunk.usage) {
        this.inputTokens = chunk.usage.prompt_tokens
        this.outputTokens = chunk.usage.completion_tokens
      }

      const stopReason = choice.finish_reason === 'tool_calls' ? 'tool_use'
        : choice.finish_reason === 'stop' ? 'end_turn'
        : choice.finish_reason === 'length' ? 'max_tokens'
        : 'end_turn'

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
   * Process content that may contain <think>...</think> tags (MiniMax style).
   * Splits content into thinking blocks and text blocks.
   */
  private _processContentWithThinkTags(content: string, events: AnthropicStreamEvent[]): void {
    // Append to buffer for tag detection
    let text = this.thinkTagBuffer + content
    this.thinkTagBuffer = ''

    while (text.length > 0) {
      if (this.inThinkTag) {
        // Inside a <think> block — look for closing </think>
        const closeIdx = text.indexOf('</think>')
        if (closeIdx !== -1) {
          // Emit thinking content before the close tag
          const thinkContent = text.slice(0, closeIdx)
          if (thinkContent) {
            this._emitThinking(thinkContent, events)
          }
          // Close thinking block, switch out of think mode
          this.inThinkTag = false
          if (this.textBlockStarted && this.isThinkingBlock) {
            events.push({ type: 'content_block_stop', index: this.textBlockIndex })
            this.textBlockStarted = false
            this.isThinkingBlock = false
          }
          text = text.slice(closeIdx + '</think>'.length)
          // Skip leading newlines after </think>
          text = text.replace(/^\n+/, '')
        } else {
          // No close tag yet — check for partial "</think" at the end
          const partialClose = this._findPartialTag(text, '</think>')
          if (partialClose > 0) {
            // Emit everything before the potential partial tag as thinking
            const safe = text.slice(0, text.length - partialClose)
            if (safe) this._emitThinking(safe, events)
            this.thinkTagBuffer = text.slice(text.length - partialClose)
          } else {
            // No partial — all is thinking content
            this._emitThinking(text, events)
          }
          text = ''
        }
      } else {
        // Outside <think> — look for opening <think>
        const openIdx = text.indexOf('<think>')
        if (openIdx !== -1) {
          // Emit text before the <think> tag
          const before = text.slice(0, openIdx)
          if (before) this._emitText(before, events)
          // Enter think mode
          this.inThinkTag = true
          text = text.slice(openIdx + '<think>'.length)
          // Skip leading newline after <think>
          text = text.replace(/^\n/, '')
        } else {
          // No <think> tag — check for partial "<think" at the end
          const partialOpen = this._findPartialTag(text, '<think>')
          if (partialOpen > 0) {
            // Emit everything before the potential partial tag as text
            const safe = text.slice(0, text.length - partialOpen)
            if (safe) this._emitText(safe, events)
            this.thinkTagBuffer = text.slice(text.length - partialOpen)
          } else {
            // No partial — all is regular text
            this._emitText(text, events)
          }
          text = ''
        }
      }
    }
  }

  /** Find how many chars at the end of `text` could be a partial `tag` */
  private _findPartialTag(text: string, tag: string): number {
    for (let len = Math.min(tag.length - 1, text.length); len > 0; len--) {
      if (text.endsWith(tag.slice(0, len))) return len
    }
    return 0
  }

  /** Emit text as a thinking block delta */
  private _emitThinking(content: string, events: AnthropicStreamEvent[]): void {
    if (!content) return
    // Start thinking block if needed
    if (!this.textBlockStarted || !this.isThinkingBlock) {
      if (this.textBlockStarted) {
        events.push({ type: 'content_block_stop', index: this.textBlockIndex })
      }
      this.textBlockIndex = this.nextBlockIndex++
      this.textBlockStarted = true
      this.isThinkingBlock = true
      events.push({
        type: 'content_block_start',
        index: this.textBlockIndex,
        content_block: { type: 'thinking', thinking: '' },
      })
    }
    events.push({
      type: 'content_block_delta',
      index: this.textBlockIndex,
      delta: { type: 'thinking_delta', thinking: content },
    })
  }

  /** Emit text as a regular text block delta */
  private _emitText(content: string, events: AnthropicStreamEvent[]): void {
    if (!content) return
    // If we were in a thinking block, close it and start a text block
    if (this.textBlockStarted && this.isThinkingBlock) {
      events.push({ type: 'content_block_stop', index: this.textBlockIndex })
      this.textBlockStarted = false
      this.isThinkingBlock = false
    }
    if (!this.textBlockStarted) {
      this.textBlockIndex = this.nextBlockIndex++
      this.textBlockStarted = true
      this.isThinkingBlock = false
      events.push({
        type: 'content_block_start',
        index: this.textBlockIndex,
        content_block: { type: 'text', text: '' },
      })
    }
    events.push({
      type: 'content_block_delta',
      index: this.textBlockIndex,
      delta: { type: 'text_delta', text: content },
    })
  }
}
