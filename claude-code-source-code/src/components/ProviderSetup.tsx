import React, { useState, useCallback } from 'react'
import { Box, Text } from '../ink.js'
import useInput from '../ink/hooks/use-input.js'
import { PROVIDER_PRESETS, saveProviderConfig, type ProviderConfig, type ProviderPreset } from '../services/api/providerConfig.js'
import { Select } from './CustomSelect/select.js'

type Step = 'provider' | 'apikey' | 'baseurl' | 'model' | 'done'

type Props = {
  onDone: () => void
}

function SimpleInput({ label, value, onChange, onSubmit, masked }: {
  label: string
  value: string
  onChange: (v: string) => void
  onSubmit: () => void
  masked?: boolean
}) {
  useInput((input, key) => {
    if (key.return) {
      onSubmit()
    } else if (key.backspace || key.delete) {
      onChange(value.slice(0, -1))
    } else if (input && !key.ctrl && !key.meta) {
      onChange(value + input)
    }
  })

  const display = masked && value.length > 4
    ? '*'.repeat(value.length - 4) + value.slice(-4)
    : masked ? '*'.repeat(value.length) : value

  return (
    <Box>
      <Text>{label}: </Text>
      <Text color="green">{display}</Text>
      <Text color="gray">|</Text>
    </Box>
  )
}

export function ProviderSetup({ onDone }: Props): React.ReactNode {
  const [step, setStep] = useState<Step>('provider')
  const [preset, setPreset] = useState<ProviderPreset | null>(null)
  const [apiKey, setApiKey] = useState('')
  const [baseUrl, setBaseUrl] = useState('')
  const [model, setModel] = useState('')

  const providerOptions = PROVIDER_PRESETS.map(p => ({
    label: p.baseUrl ? `${p.name}  (${p.baseUrl})` : p.name,
    value: p.name,
  }))

  function handleProviderSelect(value: string) {
    const selected = PROVIDER_PRESETS.find(p => p.name === value)!
    setPreset(selected)
    if (selected.baseUrl) {
      setBaseUrl(selected.baseUrl)
      setModel(selected.defaultModel)
      setStep('apikey')
    } else {
      setStep('baseurl')
    }
  }

  function finishSetup() {
    if (apiKey.length < 3) return
    const config: ProviderConfig = {
      provider: preset?.name || 'Custom',
      baseUrl,
      apiKey,
      model,
    }
    saveProviderConfig(config)
    ;(globalThis as any).__anycode_has_provider = true
    ;(globalThis as any).__anycode_provider_model = model
    ;(globalThis as any).__anycode_provider_name = config.provider
    setStep('done')
    setTimeout(onDone, 600)
  }

  if (step === 'provider') {
    return (
      <Box flexDirection="column" paddingX={2} paddingY={1}>
        <Text bold color="cyan">anycode - Provider Setup</Text>
        <Text dimColor>Select your LLM provider (arrow keys + Enter):</Text>
        <Box marginTop={1}>
          <Select options={providerOptions} onChange={handleProviderSelect} />
        </Box>
      </Box>
    )
  }

  if (step === 'baseurl') {
    return (
      <Box flexDirection="column" paddingX={2} paddingY={1}>
        <Text bold color="cyan">Custom Provider - Base URL</Text>
        <Text dimColor>Enter the OpenAI-compatible API base URL:</Text>
        <Box marginTop={1}>
          <SimpleInput
            label="URL"
            value={baseUrl}
            onChange={setBaseUrl}
            onSubmit={() => { if (baseUrl.length > 5) setStep('model') }}
          />
        </Box>
      </Box>
    )
  }

  if (step === 'model') {
    return (
      <Box flexDirection="column" paddingX={2} paddingY={1}>
        <Text bold color="cyan">Custom Provider - Model Name</Text>
        <Text dimColor>Enter the model name (e.g. gpt-4o, deepseek-chat):</Text>
        <Box marginTop={1}>
          <SimpleInput
            label="Model"
            value={model}
            onChange={setModel}
            onSubmit={() => { if (model.length > 0) setStep('apikey') }}
          />
        </Box>
      </Box>
    )
  }

  if (step === 'apikey') {
    return (
      <Box flexDirection="column" paddingX={2} paddingY={1}>
        <Text bold color="cyan">{preset?.name || 'Custom'} - API Key</Text>
        <Text dimColor>Enter your API key for {preset?.name || baseUrl}:</Text>
        <Box marginTop={1}>
          <SimpleInput
            label="Key"
            value={apiKey}
            onChange={setApiKey}
            onSubmit={finishSetup}
            masked
          />
        </Box>
        <Text dimColor marginTop={1}>Press Enter when done</Text>
      </Box>
    )
  }

  if (step === 'done') {
    return (
      <Box flexDirection="column" paddingX={2} paddingY={1}>
        <Text color="green" bold>Provider configured!</Text>
        <Text dimColor>{preset?.name || 'Custom'} - {model}</Text>
        <Text dimColor>Saved to ~/.anycode/provider.json</Text>
      </Box>
    )
  }

  return null
}
