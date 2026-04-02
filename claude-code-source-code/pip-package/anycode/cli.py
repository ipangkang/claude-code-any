"""CLI entry point — launches the bundled Node.js anycode agent."""

import os
import sys
import shutil
import subprocess
from pathlib import Path


def get_bundle_path() -> Path:
    """Return path to the bundled cli.js."""
    return Path(__file__).parent / "bundle" / "cli.js"


def find_node() -> str | None:
    """Find a working Node.js >= 18 binary."""
    for cmd in ("node", "node18", "nodejs"):
        path = shutil.which(cmd)
        if path:
            try:
                ver = subprocess.check_output(
                    [path, "--version"], text=True, timeout=5
                ).strip()
                major = int(ver.lstrip("v").split(".")[0])
                if major >= 18:
                    return path
            except Exception:
                continue
    return None


def check_first_run() -> bool:
    """Check if this is first run (no provider config)."""
    config_dir = Path(os.environ.get("ANYCODE_CONFIG_DIR", Path.home() / ".anycode"))
    return not (config_dir / "provider.json").exists()


def main() -> None:
    # Handle `anycode setup` — pure Python, no Node.js needed
    if len(sys.argv) > 1 and sys.argv[1] == "setup":
        from .setup_wizard import run_setup
        run_setup()
        return

    node = find_node()
    if not node:
        print(
            "Error: Node.js >= 18 is required but not found.\n"
            "Install it from https://nodejs.org or via your package manager:\n"
            "  brew install node      # macOS\n"
            "  apt install nodejs     # Ubuntu/Debian\n"
            "  winget install OpenJS.NodeJS  # Windows",
            file=sys.stderr,
        )
        sys.exit(1)

    bundle = get_bundle_path()
    if not bundle.exists():
        print(
            f"Error: Bundle not found at {bundle}\n"
            "The anycode package may be corrupted. Try reinstalling:\n"
            "  pip install --force-reinstall anycode",
            file=sys.stderr,
        )
        sys.exit(1)

    # First run: prompt for setup if no config exists
    if check_first_run() and "--test" not in sys.argv and "--version" not in sys.argv and "-v" not in sys.argv and "--help" not in sys.argv and "-h" not in sys.argv:
        print("\033[33mNo provider configured. Running setup...\033[0m\n")
        from .setup_wizard import run_setup
        run_setup()
        # Re-check after setup
        if check_first_run():
            return

    # Set NODE_PATH so external packages can be found from the bundle's node_modules
    node_modules = bundle.parent / "node_modules"
    env = {**os.environ, "ANYCODE_LAUNCHED_VIA": "pip"}
    if node_modules.exists():
        env["NODE_PATH"] = str(node_modules)

    # Forward all args to the Node.js bundle
    try:
        result = subprocess.run(
            [node, str(bundle)] + sys.argv[1:],
            env=env,
        )
        sys.exit(result.returncode)
    except KeyboardInterrupt:
        sys.exit(130)


if __name__ == "__main__":
    main()
