import * as React from 'react'
import { ProviderSetup } from '../../components/ProviderSetup.js'
import type { LocalJSXCommandCall } from '../../types/command.js'

export const call: LocalJSXCommandCall = async (onDone) => {
  return <ProviderSetup onDone={() => onDone('Provider updated. Restart anycode to apply.', { display: 'system' })} />
}
