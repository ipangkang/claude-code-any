// Auto-generated stub for missing feature-gated module
const noop = () => {}
const stub = new Proxy({}, { get: (_, k) => k === "default" ? noop : k === "__esModule" ? true : noop })
export default noop
export const isEnabled = () => false
export const isCoordinatorMode = () => false
export const NAME = 'featureCheck'
export const TOOL_NAME = 'featureCheck'
export const clearSkillIndexCache = noop
export const initBundledWorkflows = noop
export const featureCheck = { name: 'featureCheck', isEnabled: () => false, call: noop }
