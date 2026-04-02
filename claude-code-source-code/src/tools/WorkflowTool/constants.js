// Auto-generated stub for missing feature-gated module
const noop = () => {}
const stub = new Proxy({}, { get: (_, k) => k === "default" ? noop : k === "__esModule" ? true : noop })
export default noop
export const isEnabled = () => false
export const isCoordinatorMode = () => false
export const NAME = 'constants'
export const TOOL_NAME = 'constants'
export const clearSkillIndexCache = noop
export const initBundledWorkflows = noop
export const constants = { name: 'constants', isEnabled: () => false, call: noop }
export const WORKFLOW_TOOL_NAME = 'WorkflowTool'
