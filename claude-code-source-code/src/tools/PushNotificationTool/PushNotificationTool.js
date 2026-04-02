// Auto-generated stub for missing feature-gated module
const noop = () => {}
const stub = new Proxy({}, { get: (_, k) => k === "default" ? noop : k === "__esModule" ? true : noop })
export default noop
export const isEnabled = () => false
export const isCoordinatorMode = () => false
export const NAME = 'PushNotificationTool'
export const TOOL_NAME = 'PushNotificationTool'
export const clearSkillIndexCache = noop
export const initBundledWorkflows = noop
export const PushNotificationTool = { name: 'PushNotificationTool', isEnabled: () => false, call: noop }
