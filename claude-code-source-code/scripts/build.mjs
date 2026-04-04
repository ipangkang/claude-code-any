#!/usr/bin/env node
/**
 * build.mjs — Best-effort build of Claude Code v2.1.88 from source
 *
 * ⚠️  IMPORTANT: A complete rebuild requires the Bun runtime's compile-time
 *     intrinsics (feature(), MACRO, bun:bundle). This script provides a
 *     best-effort build using esbuild. See KNOWN_ISSUES.md for details.
 *
 * What this script does:
 *   1. Copy src/ → build-src/ (original untouched)
 *   2. Replace `feature('X')` → `false`  (compile-time → runtime)
 *   3. Replace `MACRO.VERSION` etc → string literals
 *   4. Replace `import from 'bun:bundle'` → stub
 *   5. Create stubs for missing feature-gated modules
 *   6. Bundle with esbuild → dist/cli.js
 *
 * Requirements: Node.js >= 18, npm
 * Usage:       node scripts/build.mjs
 */

import { readdir, readFile, writeFile, mkdir, cp, rm, stat } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { execSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const VERSION = '1.3.0'
const BUILD = join(ROOT, 'build-src')
const ENTRY = join(BUILD, 'entry.ts')

// ── Helpers ────────────────────────────────────────────────────────────────

async function* walk(dir) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name)
    if (e.isDirectory() && e.name !== 'node_modules') yield* walk(p)
    else yield p
  }
}

async function exists(p) { try { await stat(p); return true } catch { return false } }

async function ensureEsbuild() {
  try { execSync('npx esbuild --version', { stdio: 'pipe' }) }
  catch {
    console.log('📦 Installing esbuild...')
    execSync('npm install --save-dev esbuild', { cwd: ROOT, stdio: 'inherit' })
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// PHASE 1: Copy source
// ══════════════════════════════════════════════════════════════════════════════

await rm(BUILD, { recursive: true, force: true })
await mkdir(BUILD, { recursive: true })
await cp(join(ROOT, 'src'), join(BUILD, 'src'), { recursive: true })
console.log('✅ Phase 1: Copied src/ → build-src/')

// ══════════════════════════════════════════════════════════════════════════════
// PHASE 2: Transform source
// ══════════════════════════════════════════════════════════════════════════════

let transformCount = 0

// MACRO replacements
const MACROS = {
  'MACRO.VERSION': `'${VERSION}'`,
  'MACRO.BUILD_TIME': `''`,
  'MACRO.FEEDBACK_CHANNEL': `''`,
  'MACRO.ISSUES_EXPLAINER': `''`,
  'MACRO.FEEDBACK_CHANNEL_URL': `''`,
  'MACRO.ISSUES_EXPLAINER_URL': `''`,
  'MACRO.NATIVE_PACKAGE_URL': `'anycode'`,
  'MACRO.PACKAGE_URL': `'anycode'`,
  'MACRO.VERSION_CHANGELOG': `''`,
}

for await (const file of walk(join(BUILD, 'src'))) {
  if (!file.match(/\.[tj]sx?$/)) continue

  let src = await readFile(file, 'utf8')
  let changed = false

  // 2a. feature('X') → true/false (supports multi-line calls and trailing commas)
  // Enable useful features for anycode, disable Anthropic-internal ones
  // Features enabled for anycode. Tested: all build successfully.
  const ENABLED_FEATURES = new Set([
    'AGENT_TRIGGERS',                // /loop — tested, works
    'BRIDGE_MODE',                   // /rc — tested, works
    'FORK_SUBAGENT',                 // /fork — tested, works
    'NEW_INIT',                      // /init — tested, works
    'TOKEN_BUDGET',                  // token tracking — silent, no UI noise
    'EXTRACT_MEMORIES',              // auto-memory — silent, no UI noise
    'TRANSCRIPT_CLASSIFIER',         // auto permissions — silent, no UI noise
    'PROMPT_CACHE_BREAK_DETECTION',  // cache optimization — silent, no UI noise
    'BASH_CLASSIFIER',               // bash safety — silent, no UI noise
    'CONNECTOR_TEXT',                // text connector — silent, no UI noise
    'LODESTONE',                     // deep links — silent, no UI noise
    'MESSAGE_ACTIONS',               // message buttons — UI enhancement
    'MCP_SKILLS','BUDDY',                    // MCP skill support — works
  ])
  if (/\bfeature\s*\(/.test(src)) {
    src = src.replace(/\bfeature\s*\(\s*['"]([A-Z_]+)['"]\s*,?\s*\)/gs, (match, flag) => {
      return ENABLED_FEATURES.has(flag) ? 'true' : 'false'
    })
    changed = true
  }

  // 2b. MACRO.X → literals (longest keys first to avoid partial matches)
  const sortedMacros = Object.entries(MACROS).sort((a, b) => b[0].length - a[0].length)
  for (const [k, v] of sortedMacros) {
    if (src.includes(k)) {
      src = src.replaceAll(k, v)
      changed = true
    }
  }

  // 2c. Remove bun:bundle import (feature() is already replaced)
  if (src.includes("from 'bun:bundle'") || src.includes('from "bun:bundle"')) {
    src = src.replace(/import\s*\{\s*feature\s*\}\s*from\s*['"]bun:bundle['"];?\n?/g, '// feature() replaced with false at build time\n')
    changed = true
  }

  // 2d. Remove type-only import of global.d.ts
  if (src.includes("import '../global.d.ts'") || src.includes("import './global.d.ts'")) {
    src = src.replace(/import\s*['"][.\/]*global\.d\.ts['"];?\n?/g, '')
    changed = true
  }

  // 2e. anycode branding: replace "Claude Code" and "Anthropic" references
  if (src.includes('Claude Code')) {
    src = src.replaceAll('Claude Code', 'anycode')
    changed = true
  }
  if (src.includes("Anthropic's official CLI for Claude")) {
    src = src.replaceAll("Anthropic's official CLI for Claude", 'a universal coding agent')
    changed = true
  }
  // 2f. Replace CLAUDE.md with .anycode.md in user-facing strings
  // Skip claudemd.ts — it needs the original filename for backwards compatibility
  if (src.includes('CLAUDE.md') && !file.includes('claudemd')) {
    src = src.replaceAll('CLAUDE.md', '.anycode.md')
    changed = true
  }
  if (src.includes('CLAUDE.local.md')) {
    src = src.replaceAll('CLAUDE.local.md', '.anycode.local.md')
    changed = true
  }
  if (src.includes('claude.ai/code')) {
    src = src.replaceAll('claude.ai/code', 'github.com/anycode')
    changed = true
  }
  // 2g. Replace `claude` CLI references with `anycode`
  // Only replace command-line invocations, not variable names or other uses
  for (const pattern of [
    ['claude --resume', 'anycode --resume'],
    ['claude --continue', 'anycode --continue'],
    ['claude -r ', 'anycode -r '],
    ['claude -c', 'anycode -c'],
    ['claude update', 'anycode update'],
    ['claude install', 'anycode install'],
    ['claude auth', 'anycode auth'],
    ['`claude`', '`anycode`'],
    ["'claude'", "'anycode'"],
    ['Run claude ', 'Run anycode '],
    ['run claude ', 'run anycode '],
    ['claude mcp', 'anycode mcp'],
    ['claude doctor', 'anycode doctor'],
  ]) {
    if (src.includes(pattern[0])) {
      src = src.replaceAll(pattern[0], pattern[1])
      changed = true
    }
  }

  if (changed) {
    await writeFile(file, src, 'utf8')
    transformCount++
  }
}
console.log(`✅ Phase 2: Transformed ${transformCount} files`)

// ══════════════════════════════════════════════════════════════════════════════
// PHASE 3: Create entry wrapper
// ══════════════════════════════════════════════════════════════════════════════

await writeFile(ENTRY, `// Claude Code v${VERSION} — built from source
// Copyright (c) Anthropic PBC. All rights reserved.
import './src/entrypoints/cli.tsx'
`, 'utf8')
console.log('✅ Phase 3: Created entry wrapper')

// ══════════════════════════════════════════════════════════════════════════════
// PHASE 4: Iterative stub + bundle
// ══════════════════════════════════════════════════════════════════════════════

await ensureEsbuild()

const OUT_DIR = join(ROOT, 'dist')
await mkdir(OUT_DIR, { recursive: true })
const OUT_FILE = join(OUT_DIR, 'cli.js')

// ── esbuild JS API (needed for resolve plugin to fix src/ → build-src/src/) ─
const esbuild = await import('esbuild')

// Fix: jsonc-parser ESM has imports without .js extensions, breaks in Node 22.
// Patch the package to use CJS instead.
const jsoncParserPkg = join(ROOT, 'node_modules', 'jsonc-parser', 'package.json')
try {
  const pkg = JSON.parse(await readFile(jsoncParserPkg, 'utf8'))
  if (pkg.module || pkg.type === 'module') {
    // Remove ESM entry so Node uses CJS
    delete pkg.module
    delete pkg.exports?.['.']?.import
    pkg.type = 'commonjs'
    await writeFile(jsoncParserPkg, JSON.stringify(pkg, null, 2))
    console.log('  Fixed jsonc-parser for Node 22 compatibility')
  }
} catch {}

// Plugin: stub out @ant/claude-for-chrome-mcp (Anthropic internal package)
const chromeStubPlugin = {
  name: 'chrome-mcp-stub',
  setup(build) {
    build.onResolve({ filter: /^@ant\/claude-for-chrome-mcp$/ }, () => ({
      path: '@ant/claude-for-chrome-mcp',
      namespace: 'chrome-stub',
    }))
    build.onLoad({ filter: /.*/, namespace: 'chrome-stub' }, () => ({
      contents: 'export const BROWSER_TOOLS = []; export function createClaudeForChromeMcpServer() { return null; }',
      loader: 'js',
    }))
  },
}

// Plugin: redirect bare `src/...` imports to `build-src/src/...` so that
// modules are not duplicated (original src/ vs transformed build-src/src/).
const srcAliasPlugin = {
  name: 'src-alias',
  setup(build) {
    // Match any import starting with "src/" (bare specifier used by the codebase)
    build.onResolve({ filter: /^src\// }, async (args) => {
      const base = join(BUILD, args.path)
      // The source uses .js in imports but actual files are .ts/.tsx
      // Try the exact path first, then try replacing .js → .ts / .tsx
      const candidates = [base]
      if (base.endsWith('.js')) {
        const noExt = base.slice(0, -3)
        candidates.push(noExt + '.ts', noExt + '.tsx')
      }
      for (const p of candidates) {
        if (await exists(p)) return { path: p, namespace: 'file' }
      }
      // Fallback: let esbuild resolve it (will trigger stub creation)
      return { path: base, namespace: 'file' }
    })
  },
}

// Run up to 5 rounds of: esbuild → collect missing → create stubs → retry
const MAX_ROUNDS = 5
let succeeded = false

for (let round = 1; round <= MAX_ROUNDS; round++) {
  console.log(`\n🔨 Phase 4 round ${round}/${MAX_ROUNDS}: Bundling...`)

  try {
    await esbuild.build({
      entryPoints: [ENTRY],
      bundle: true,
      platform: 'node',
      target: 'node18',
      format: 'esm',
      outfile: OUT_FILE,
      banner: {
        js: `#!/usr/bin/env node\n// anycode v${VERSION}\n`,
      },
      packages: 'external',
      external: ['bun:*'],
      allowOverwrite: true,
      loader: { '.md': 'text', '.txt': 'text' },
      logLevel: 'error',
      logLimit: 0,
      sourcemap: true,
      // Force-bundle problematic CJS packages instead of keeping them external
      mainFields: ['module', 'main'],
      plugins: [chromeStubPlugin, srcAliasPlugin, {
        name: 'force-bundle-broken-esm',
        setup(build) {
          // These packages have CJS/ESM incompatibilities with Node 22
          // Force them to be bundled (not external) by resolving to their file path
          const forceBundled = ['jsonc-parser', 'color-diff-napi']
          for (const pkg of forceBundled) {
            // Match exact package name AND sub-path imports
            build.onResolve({ filter: new RegExp(`^${pkg}(/|$)`) }, async (args) => {
              // Resolve to CJS main entry (avoid ESM issues with Node 22)
              try {
                const pkgJson = JSON.parse(await readFile(join(ROOT, 'node_modules', pkg, 'package.json'), 'utf8'))
                if (args.path === pkg) {
                  // Exact match: use CJS main
                  const main = pkgJson.main || 'index.js'
                  return { path: join(ROOT, 'node_modules', pkg, main) }
                }
                // Sub-path: resolve directly
                const resolved = join(ROOT, 'node_modules', args.path)
                // Prefer .js file over directory
                if (await exists(resolved + '.js')) return { path: resolved + '.js' }
                if (await exists(join(resolved, 'index.js'))) return { path: join(resolved, 'index.js') }
                if (await exists(resolved)) {
                  const s = await stat(resolved)
                  if (s.isFile()) return { path: resolved }
                }
              } catch {}
              return undefined
            })
          }
        },
      }],
    })
    succeeded = true
    break
  } catch (e) {
    const esbuildOutput = (e.errors || []).map(err => err.text).join('\n')
    console.log('  Error type:', typeof e, 'keys:', Object.keys(e || {}))
    console.log('  Message:', e?.message?.slice(0, 500))
    if (e.errors) console.log('  Errors:', e.errors.slice(0, 5).map(x => x.text))

    // Parse missing modules
    const missingRe = /Could not resolve "([^"]+)"/g
    const missing = new Set()
    let m
    while ((m = missingRe.exec(esbuildOutput)) !== null) {
      const mod = m[1]
      if (!mod.startsWith('node:') && !mod.startsWith('bun:') && !mod.startsWith('/')) {
        missing.add(mod)
      }
    }

    if (missing.size === 0) {
      // No more missing modules but still errors — check what
      const errLines = esbuildOutput.split('\n').filter(l => l.includes('ERROR') || l.length > 0).slice(0, 5)
      console.log('❌ Unrecoverable errors:')
      errLines.forEach(l => console.log('   ' + l))
      break
    }

    console.log(`   Found ${missing.size} missing modules, creating stubs...`)

    // Create stubs
    let stubCount = 0
    for (const mod of missing) {
      // Resolve relative path from the file that imports it — but since we
      // don't have that info easily, create stubs at multiple likely locations
      const cleanMod = mod.replace(/^\.\//, '')

      // Text assets → empty file
      if (/\.(txt|md|json)$/.test(cleanMod)) {
        const p = join(BUILD, 'src', cleanMod)
        await mkdir(dirname(p), { recursive: true }).catch(() => {})
        if (!await exists(p)) {
          await writeFile(p, cleanMod.endsWith('.json') ? '{}' : '', 'utf8')
          stubCount++
        }
        continue
      }

      // JS/TS modules → export empty
      if (/\.[tj]sx?$/.test(cleanMod)) {
        for (const base of [join(BUILD, 'src'), join(BUILD, 'src', 'src')]) {
          const p = join(base, cleanMod)
          await mkdir(dirname(p), { recursive: true }).catch(() => {})
          if (!await exists(p)) {
            const name = cleanMod.split('/').pop().replace(/\.[tj]sx?$/, '')
            const safeName = name.replace(/[^a-zA-Z0-9_$]/g, '_') || 'stub'
            await writeFile(p, `// Auto-generated stub\nexport default function _stub_${safeName}() {}\nexport const ${safeName} = _stub_${safeName}\n`, 'utf8')
            stubCount++
          }
        }
      }
    }
    console.log(`   Created ${stubCount} stubs`)
  }
}

// Post-process: fix __require shim for Node.js ESM compatibility
// esbuild's ESM output uses a __require shim that throws for CJS modules.
// Replace it with createRequire() which works in Node.js ESM context.
if (succeeded) {
  let distCode = await readFile(OUT_FILE, 'utf8')
  distCode = distCode.replace(
    `throw Error('Dynamic require of "' + x + '" is not supported');`,
    `throw Error('Dynamic require of "' + x + '" is not supported');`
  )
  // Add createRequire at the top of the file, after the shebang and banner
  const createRequireShim = `import { createRequire as __createRequire } from 'node:module';\nvar require = __createRequire(import.meta.url);\n`
  // Insert after the second line (shebang + version comment)
  const secondNewline = distCode.indexOf('\n', distCode.indexOf('\n') + 1)
  if (secondNewline > 0) {
    distCode = distCode.slice(0, secondNewline + 1) + createRequireShim + distCode.slice(secondNewline + 1)
  }
  await writeFile(OUT_FILE, distCode)
}

if (succeeded) {
  const size = (await stat(OUT_FILE)).size
  console.log(`\n✅ Build succeeded: ${OUT_FILE}`)
  console.log(`   Size: ${(size / 1024 / 1024).toFixed(1)}MB`)
  console.log(`\n   Usage:  node ${OUT_FILE} --version`)
  console.log(`           node ${OUT_FILE} -p "Hello"`)
} else {
  console.error('\n❌ Build failed after all rounds.')
  console.error('   The transformed source is in build-src/ for inspection.')
  console.error('\n   To fix manually:')
  console.error('   1. Check build-src/ for the transformed files')
  console.error('   2. Create missing stubs in build-src/src/')
  console.error('   3. Re-run: node scripts/build.mjs')
  process.exit(1)
}
