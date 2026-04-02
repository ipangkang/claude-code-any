import type { Command } from '../../commands.js'
const assistant = { type: 'local', name: 'assistant', description: 'Assistant mode (stub)', supportsNonInteractive: false, load: async () => ({ call: async () => ({ type: 'skip' as const }) }) } satisfies Command
export default assistant
