import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'

export interface ProviderPreset {
  name: string
  baseUrl: string
  defaultModel: string
  models?: string[]       // All available models for this provider
  maxTokens?: number
  contextWindow?: number  // Total context window size in tokens
  supportsImages?: boolean // Whether the provider supports image/vision input
}

export interface ProviderConfig {
  provider: string
  baseUrl: string
  apiKey: string
  model: string
  maxTokens?: number
  contextWindow?: number
}

export const PROVIDER_PRESETS: ProviderPreset[] = [
  { name: 'OpenAI', baseUrl: 'https://api.openai.com/v1', defaultModel: 'gpt-4o', maxTokens: 16384, contextWindow: 128000, supportsImages: true },
  { name: 'DeepSeek', baseUrl: 'https://api.deepseek.com/v1', defaultModel: 'deepseek-chat', maxTokens: 8192, contextWindow: 64000, supportsImages: false },
  { name: 'Qwen (DashScope)', baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', defaultModel: 'qwen-max', maxTokens: 8192, contextWindow: 32000, supportsImages: true },
  { name: 'MiniMax', baseUrl: 'https://api.minimax.io/v1', defaultModel: 'MiniMax-M2.7', maxTokens: 16384, contextWindow: 204800, supportsImages: false },
  { name: 'GLM (Zhipu)', baseUrl: 'https://open.bigmodel.cn/api/paas/v4', defaultModel: 'glm-4-plus', maxTokens: 8192, contextWindow: 128000, supportsImages: true },
  { name: 'SiliconFlow', baseUrl: 'https://api.siliconflow.cn/v1', defaultModel: 'deepseek-ai/DeepSeek-V3', maxTokens: 8192, contextWindow: 64000, supportsImages: false },
  { name: 'Kimi (Moonshot)', baseUrl: 'https://api.moonshot.cn/v1', defaultModel: 'moonshot-v1-auto', maxTokens: 8192, contextWindow: 128000, supportsImages: true },
  { name: 'Ollama (Local)', baseUrl: 'http://localhost:11434/v1', defaultModel: 'llama3', maxTokens: 4096, contextWindow: 8000, supportsImages: false },
  { name: 'Custom', baseUrl: '', defaultModel: '', contextWindow: 32000, supportsImages: true },
]

function getConfigDir(): string {
  return process.env.ANYCODE_CONFIG_DIR ?? join(homedir(), '.anycode')
}

function getConfigPath(): string {
  return join(getConfigDir(), 'provider.json')
}

export function loadProviderConfig(): ProviderConfig | null {
  // Environment variables take priority (useful for CI/CD, quick testing)
  if (process.env.ANYCODE_API_KEY) {
    return {
      provider: 'env',
      baseUrl: process.env.ANYCODE_BASE_URL || 'https://api.openai.com/v1',
      apiKey: process.env.ANYCODE_API_KEY,
      model: process.env.ANYCODE_MODEL || 'gpt-4o',
      maxTokens: process.env.ANYCODE_MAX_TOKENS ? parseInt(process.env.ANYCODE_MAX_TOKENS) : undefined,
    }
  }
  // Fall back to config file
  const configPath = getConfigPath()
  if (!existsSync(configPath)) return null
  try {
    return JSON.parse(readFileSync(configPath, 'utf8')) as ProviderConfig
  } catch {
    return null
  }
}

export function saveProviderConfig(config: ProviderConfig): void {
  const dir = getConfigDir()
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  writeFileSync(getConfigPath(), JSON.stringify(config, null, 2), 'utf8')
}

export function hasProviderConfig(): boolean {
  return loadProviderConfig() !== null
}

// Global cache for synchronous access from non-async code
let _cachedConfig: ProviderConfig | null | undefined = undefined

export function getCachedProviderConfig(): ProviderConfig | null {
  if (_cachedConfig === undefined) {
    _cachedConfig = loadProviderConfig()
  }
  return _cachedConfig
}

export function hasCachedProviderConfig(): boolean {
  return getCachedProviderConfig() !== null
}

function findPreset(providerName: string): ProviderPreset | undefined {
  // Case-insensitive, partial match
  const lower = providerName.toLowerCase()
  return PROVIDER_PRESETS.find(p => p.name.toLowerCase() === lower || p.name.toLowerCase().includes(lower))
}

export function getMaxTokensForProvider(config: ProviderConfig): number {
  if (config.maxTokens) return config.maxTokens
  return findPreset(config.provider)?.maxTokens || 8192
}

export function getContextWindowForProvider(config: ProviderConfig): number {
  if (config.contextWindow) return config.contextWindow
  return findPreset(config.provider)?.contextWindow || 32000
}

export function providerSupportsImages(config: ProviderConfig): boolean {
  const preset = findPreset(config.provider)
  // Default to true for unknown providers (Custom, env, etc.)
  return preset?.supportsImages ?? true
}

/**
 * Fetch available models from the provider's /v1/models endpoint.
 * Returns empty array if the endpoint is not supported.
 */
export async function fetchAvailableModels(config: ProviderConfig): Promise<string[]> {
  try {
    const url = `${config.baseUrl.replace(/\/+$/, '')}/models`
    const response = await fetch(url, {
      headers: { 'Authorization': `Bearer ${config.apiKey}` },
      signal: AbortSignal.timeout(5000),
    })
    if (!response.ok) return []
    const data = await response.json() as any
    const models = (data.data || [])
      .map((m: any) => m.id as string)
      .filter((id: string) => id && !id.includes('embed') && !id.includes('whisper') && !id.includes('tts') && !id.includes('dall-e'))
      .sort()
    return models
  } catch {
    return []
  }
}
