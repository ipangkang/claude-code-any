// Auto-generated stub for missing feature-gated module
const noop = () => {}
const stub = new Proxy({}, { get: (_, k) => k === "default" ? noop : k === "__esModule" ? true : noop })
export default noop
export const isEnabled = () => false
export const isCoordinatorMode = () => false
export const NAME = 'WebBrowserTool'
export const TOOL_NAME = 'WebBrowserTool'
export const clearSkillIndexCache = noop
export const initBundledWorkflows = noop
export const WebBrowserTool = { name: 'WebBrowserTool', isEnabled: () => false, call: noop }
