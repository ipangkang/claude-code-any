"""Interactive setup wizard for first-time anycode configuration."""

import json
import os
import sys
import subprocess
from pathlib import Path

PRESETS = [
    {"name": "OpenAI", "baseUrl": "https://api.openai.com/v1", "model": "gpt-4o"},
    {"name": "DeepSeek", "baseUrl": "https://api.deepseek.com/v1", "model": "deepseek-chat"},
    {"name": "Qwen (DashScope)", "baseUrl": "https://dashscope.aliyuncs.com/compatible-mode/v1", "model": "qwen-max"},
    {"name": "MiniMax", "baseUrl": "https://api.minimax.io/v1", "model": "MiniMax-M2.7"},
    {"name": "GLM (Zhipu)", "baseUrl": "https://open.bigmodel.cn/api/paas/v4", "model": "glm-4-plus"},
    {"name": "SiliconFlow", "baseUrl": "https://api.siliconflow.cn/v1", "model": "deepseek-ai/DeepSeek-V3"},
    {"name": "Ollama (Local)", "baseUrl": "http://localhost:11434/v1", "model": "llama3"},
]

def get_config_path() -> Path:
    config_dir = Path(os.environ.get("ANYCODE_CONFIG_DIR", Path.home() / ".anycode"))
    config_dir.mkdir(parents=True, exist_ok=True)
    return config_dir / "provider.json"


def run_setup() -> None:
    print("\033[1m\033[36m")
    print("  ╔══════════════════════════════════════╗")
    print("  ║       anycode — Provider Setup       ║")
    print("  ╚══════════════════════════════════════╝")
    print("\033[0m")

    # Check existing config
    config_path = get_config_path()
    if config_path.exists():
        try:
            existing = json.loads(config_path.read_text())
            print(f"  Current: {existing['provider']} / {existing['model']}")
            ans = input("  Reconfigure? [y/N] ").strip().lower()
            if ans != "y":
                print("  Keeping existing configuration.")
                return
        except Exception:
            pass

    # Select provider
    print("\n  Select your LLM provider:\n")
    for i, p in enumerate(PRESETS, 1):
        print(f"    {i}. {p['name']:<20} {p['baseUrl']}")
    print(f"    {len(PRESETS)+1}. Custom")

    while True:
        try:
            choice = int(input(f"\n  Enter number [1-{len(PRESETS)+1}]: "))
            if 1 <= choice <= len(PRESETS) + 1:
                break
        except (ValueError, EOFError):
            pass
        print("  Invalid choice, try again.")

    if choice <= len(PRESETS):
        preset = PRESETS[choice - 1]
        provider = preset["name"]
        base_url = preset["baseUrl"]
        model = preset["model"]
        print(f"\n  Selected: {provider}")
        custom_model = input(f"  Model [{model}]: ").strip()
        if custom_model:
            model = custom_model
    else:
        provider = input("  Provider name: ").strip() or "Custom"
        base_url = input("  Base URL (e.g. https://api.example.com/v1): ").strip()
        model = input("  Model name: ").strip()
        if not base_url or not model:
            print("\033[31m  Error: Base URL and model are required.\033[0m")
            sys.exit(1)

    # API Key
    api_key = input(f"\n  API Key for {provider}: ").strip()
    if not api_key:
        print("\033[31m  Error: API key is required.\033[0m")
        sys.exit(1)

    # Save config
    config = {
        "provider": provider,
        "baseUrl": base_url,
        "apiKey": api_key,
        "model": model,
    }
    config_path.write_text(json.dumps(config, indent=2))
    print(f"\n\033[32m  ✓ Saved to {config_path}\033[0m")

    # Test connection
    print("\n  Testing connection...")
    try:
        from .cli import find_node, get_bundle_path
        node = find_node()
        bundle = get_bundle_path()
        if node and bundle.exists():
            result = subprocess.run(
                [node, str(bundle), "--test"],
                capture_output=True, text=True, timeout=30,
                env={**os.environ},
            )
            if result.returncode == 0:
                print("\033[32m  ✓ Connection successful!\033[0m")
            else:
                output = result.stdout + result.stderr
                print(f"\033[31m  ✗ {output.strip()}\033[0m")
                print("  Check your API key and try again.")
        else:
            print("  (Skipped — Node.js or bundle not available)")
    except Exception as e:
        print(f"  (Skipped — {e})")

    print(f"\n\033[1m  Ready! Run \033[36manycode\033[0m\033[1m to start.\033[0m\n")


if __name__ == "__main__":
    run_setup()
