import { feature } from 'bun:bundle'
import type { Command } from '../../commands.js'

const buddy = {
  type: 'local',
  name: 'buddy',
  description: 'Toggle your companion buddy',
  isEnabled: () => feature('BUDDY'),
  isHidden: true,
  supportsNonInteractive: false,
  load: async () => ({
    call: async () => ({ type: 'text' as const, value: 'Buddy toggled!' }),
  }),
} satisfies Command

export default buddy
