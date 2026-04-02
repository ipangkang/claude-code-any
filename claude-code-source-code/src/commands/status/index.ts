import type { Command } from '../../commands.js'

const status = {
  type: 'local-jsx',
  name: 'status',
  description:
    'Show anycode status including version, provider, model, and connectivity',
  immediate: true,
  load: () => import('./status.js'),
} satisfies Command

export default status
