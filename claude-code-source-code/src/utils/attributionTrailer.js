// Auto-generated stub for missing feature-gated module
const noop = () => {}
const stub = new Proxy({}, { get: (_, k) => k === "default" ? noop : k === "__esModule" ? true : noop })
export default noop
export const isEnabled = () => false
export const isCoordinatorMode = () => false
export const NAME = 'attributionTrailer'
export const TOOL_NAME = 'attributionTrailer'
export const clearSkillIndexCache = noop
export const initBundledWorkflows = noop
export const attributionTrailer = { name: 'attributionTrailer', isEnabled: () => false, call: noop }
