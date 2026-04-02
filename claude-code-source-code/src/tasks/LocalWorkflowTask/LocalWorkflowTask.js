// Auto-generated stub for missing feature-gated module
const noop = () => {}
const stub = new Proxy({}, { get: (_, k) => k === "default" ? noop : k === "__esModule" ? true : noop })
export default noop
export const isEnabled = () => false
export const isCoordinatorMode = () => false
export const NAME = 'LocalWorkflowTask'
export const TOOL_NAME = 'LocalWorkflowTask'
export const clearSkillIndexCache = noop
export const initBundledWorkflows = noop
export const LocalWorkflowTask = { name: 'LocalWorkflowTask', isEnabled: () => false, call: noop }
