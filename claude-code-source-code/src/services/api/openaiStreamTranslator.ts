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
    // These models return reasoning_content before the final answer.
    // We emit it as a thinking block for display.
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

    // --- Text content ---
    if (delta.content) {
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
        delta: { type: 'text_delta', text: delta.content },
      })
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
}
