// Auto-generated stub for missing feature-gated module
const noop = () => {}
const stub = new Proxy({}, { get: (_, k) => k === "default" ? noop : k === "__esModule" ? true : noop })
export default noop
export const isEnabled = () => false
export const isCoordinatorMode = () => false
export const NAME = 'coreTypes_generated'
export const TOOL_NAME = 'coreTypes_generated'
export const clearSkillIndexCache = noop
export const initBundledWorkflows = noop
export const coreTypes_generated = { name: 'coreTypes_generated', isEnabled: () => false, call: noop }
