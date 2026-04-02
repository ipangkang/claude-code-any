// Auto-generated stub for missing feature-gated module
const noop = () => {}
const stub = new Proxy({}, { get: (_, k) => k === "default" ? noop : k === "__esModule" ? true : noop })
export default noop
export const isEnabled = () => false
export const isCoordinatorMode = () => false
export const NAME = 'VerifyPlanExecutionTool'
export const TOOL_NAME = 'VerifyPlanExecutionTool'
export const clearSkillIndexCache = noop
export const initBundledWorkflows = noop
export const VerifyPlanExecutionTool = { name: 'VerifyPlanExecutionTool', isEnabled: () => false, call: noop }
