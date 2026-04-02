import type { Command } from '../../commands.js'

const provider = {
  type: 'local-jsx',
  name: 'provider',
  description: 'Configure LLM provider (model, API key, endpoint)',
  load: () => import('./provider.js'),
} satisfies Command

export default provider
