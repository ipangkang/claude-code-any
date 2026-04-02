#!/bin/bash
# Build the pip package for anycode
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
BUNDLE_DIR="$SCRIPT_DIR/anycode/bundle"

echo "=== Building anycode pip package ==="

# 1. Build the Node.js bundle if needed
if [ ! -f "$PROJECT_ROOT/dist/cli.js" ]; then
    echo "Building Node.js bundle..."
    cd "$PROJECT_ROOT"
    node scripts/build.mjs
fi

# 2. Copy bundle + full node_modules
echo "Copying bundle..."
rm -rf "$BUNDLE_DIR"
mkdir -p "$BUNDLE_DIR"
cp "$PROJECT_ROOT/dist/cli.js" "$BUNDLE_DIR/"

echo "Copying node_modules..."
cp -r "$PROJECT_ROOT/node_modules" "$BUNDLE_DIR/node_modules"

# Remove unnecessary large files to reduce package size
echo "Cleaning up..."
find "$BUNDLE_DIR/node_modules" -name '*.d.ts' -delete 2>/dev/null
find "$BUNDLE_DIR/node_modules" -name '*.map' -delete 2>/dev/null
find "$BUNDLE_DIR/node_modules" -name '*.md' -not -name 'LICENSE*' -delete 2>/dev/null
find "$BUNDLE_DIR/node_modules" -name 'CHANGELOG*' -delete 2>/dev/null
find "$BUNDLE_DIR/node_modules" -name '.github' -type d -exec rm -rf {} + 2>/dev/null
find "$BUNDLE_DIR/node_modules" -name 'test' -type d -exec rm -rf {} + 2>/dev/null
find "$BUNDLE_DIR/node_modules" -name 'tests' -type d -exec rm -rf {} + 2>/dev/null
find "$BUNDLE_DIR/node_modules" -name '__tests__' -type d -exec rm -rf {} + 2>/dev/null
# Remove native build artifacts for other platforms
find "$BUNDLE_DIR/node_modules" -name '*.node' -delete 2>/dev/null
find "$BUNDLE_DIR/node_modules" -name 'binding.gyp' -delete 2>/dev/null
# Remove esbuild and typescript (build-only)
rm -rf "$BUNDLE_DIR/node_modules/esbuild" "$BUNDLE_DIR/node_modules/@esbuild" "$BUNDLE_DIR/node_modules/typescript" 2>/dev/null

BUNDLE_SIZE=$(du -sh "$BUNDLE_DIR" | cut -f1)
echo "Total bundle size: $BUNDLE_SIZE"

# 3. Build pip package
echo "Building pip package..."
cd "$SCRIPT_DIR"
rm -rf dist/ build/
python3 -m build

echo ""
echo "=== Done ==="
ls -lh "$SCRIPT_DIR/dist/"*.whl "$SCRIPT_DIR/dist/"*.tar.gz 2>/dev/null
echo ""
echo "Install:  pip install dist/anycode_ai-1.2.0-py3-none-any.whl"
