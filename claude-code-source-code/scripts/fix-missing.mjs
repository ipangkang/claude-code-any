#!/usr/bin/env node
/**
 * fix-missing.mjs — Create stubs for ALL missing modules by resolving
 * relative paths from the importing file.
 */

import { execSync } from 'node:child_process'
import { mkdir, writeFile, stat } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')

async function exists(p) {
  try { await stat(p); return true } catch { return false }
}

// Run esbuild and capture errors
let output
try {
  execSync([
    'npx esbuild',
    'build-src/entry.ts',
    '--bundle --platform=node --packages=external',
    "--external:'bun:*'",
    '--log-level=error --log-limit=0',
    '--outfile=/dev/null',
  ].join(' '), { cwd: ROOT, stdio: ['pipe', 'pipe', 'pipe'], shell: true })
  console.log('✅ No missing modules!')
  process.exit(0)
} catch (e) {
  output = (e.stderr?.toString() || '') + (e.stdout?.toString() || '')
}

// Parse: module path + importer file
// Format: Could not resolve "X"\n\n    path/to/importer.ts:line:col:
const errorBlocks = output.split('✘ [ERROR] ')
let created = 0
const resolved = new Set()

for (const block of errorBlocks) {
  const moduleMatch = block.match(/Could not resolve "([^"]+)"/)
  if (!moduleMatch) continue
  const modulePath = moduleMatch[1]

  // Skip node: and bun: builtins
  if (modulePath.startsWith('node:') || modulePath.startsWith('bun:')) continue

  // Find the importing file
  const importerMatch = block.match(/\n\s+((?:build-src|src)\/[^\s:]+):\d+:\d+:/)
  if (!importerMatch) continue

  let importerFile = importerMatch[1]

  // Resolve from the ACTUAL importer path (could be src/ or build-src/)
  const importerDir = dirname(join(ROOT, importerFile))
  let targetPath = resolve(importerDir, modulePath)

  // If it doesn't end in a known extension, try .ts/.js
  if (!/\.[a-z]+$/i.test(targetPath)) {
    targetPath += '.js'
  }

  // Convert .js to .ts for stub creation if .ts doesn't exist
  const tsPath = targetPath.replace(/\.js$/, '.ts')

  const key = targetPath
  if (resolved.has(key)) continue
  resolved.add(key)

  // Check if file already exists
  if (await exists(targetPath) || await exists(tsPath)) continue

  await mkdir(dirname(targetPath), { recursive: true })

  // Generate appropriate stub based on file type
  if (/\.(txt|md)$/.test(targetPath)) {
    await writeFile(targetPath, '', 'utf8')
  } else if (/\.json$/.test(targetPath)) {
    await writeFile(targetPath, '{}', 'utf8')
  } else {
    // JS/TS stub — export empty defaults
    const baseName = targetPath.split('/').pop().replace(/\.[^.]+$/, '')
    const safeName = baseName.replace(/[^a-zA-Z0-9_$]/g, '_') || 'stub'
    // Use Proxy-based stub: any named export resolves to a no-op
    await writeFile(targetPath, [
      '// Auto-generated stub for missing feature-gated module',
      'const noop = () => {}',
      'const stub = new Proxy({}, { get: (_, k) => k === "default" ? noop : k === "__esModule" ? true : noop })',
      'export default noop',
      // Export common names used in the codebase
      'export const isEnabled = () => false',
      'export const isCoordinatorMode = () => false',
      `export const NAME = '${safeName}'`,
      `export const TOOL_NAME = '${safeName}'`,
      'export const clearSkillIndexCache = noop',
      'export const initBundledWorkflows = noop',
      // Export the PascalCase name (for Tool classes like BashTool, etc.)
      `export const ${safeName} = { name: '${safeName}', isEnabled: () => false, call: noop }`,
      '',
    ].join('\n'), 'utf8')
  }
  created++
  console.log(`  📝 ${targetPath.replace(ROOT + '/', '')}`)
}

console.log(`\n✅ Created ${created} stubs from ${resolved.size} unique missing modules`)
