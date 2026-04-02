import type { Command } from '../../commands.js'

const switchProvider = {
  type: 'local-jsx',
  name: 'switch',
  aliases: ['auth'],
  description: 'Switch LLM provider (model, API key, endpoint)',
  immediate: true,
  load: () => import('./switch.js'),
} satisfies Command

export default switchProvider
