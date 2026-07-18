import os
import sys
import json
import re
import subprocess

WORKSPACE = os.path.dirname(os.path.abspath(__file__))
ENV_PATH = os.path.join(WORKSPACE, ".env")
CAPACITOR_PATH = os.path.join(WORKSPACE, "capacitor.config.json")
INDEX_HTML_PATH = os.path.join(WORKSPACE, "public", "index.html")

ENVIRONMENTS = {
    "local": {
        "NEXT_PUBLIC_SERVER_URL": "http://localhost:3000",
        "DATABASE_URL": "postgresql://exhibition_user:ExhibitionPassword123@localhost:5439/exhibition_explorer",
        "CAPACITOR_URL": "http://10.0.2.2:3000", # Default for Android emulator to loopback to host
    },
    "staging": {
        "NEXT_PUBLIC_SERVER_URL": "https://exhibition-explorer.duckdns.org",
        "DATABASE_URL": "postgresql://exhibition_user:ExhibitionPassword123@localhost:5439/exhibition_explorer",
        "CAPACITOR_URL": "https://exhibition-explorer.duckdns.org",
    },
    "production": {
        "NEXT_PUBLIC_SERVER_URL": "https://exhibition-explorer.org",
        "DATABASE_URL": "postgresql://exhibition_user:ExhibitionPassword123@prod-db-host:5432/exhibition_explorer",
        "CAPACITOR_URL": "https://exhibition-explorer.org",
    }
}

def load_env():
    if not os.path.exists(ENV_PATH):
        return {}
    env_data = {}
    with open(ENV_PATH, 'r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith('#'):
                continue
            if '=' in line:
                key, val = line.split('=', 1)
                env_data[key.strip()] = val.strip().strip('"').strip("'")
    return env_data

def save_env(env_data):
    # We want to preserve existing lines and order as much as possible,
    # only replacing the updated ones.
    lines = []
    updated_keys = set()
    if os.path.exists(ENV_PATH):
        with open(ENV_PATH, 'r', encoding='utf-8') as f:
            for line in f:
                stripped = line.strip()
                if not stripped or stripped.startswith('#'):
                    lines.append(line)
                    continue
                if '=' in stripped:
                    key, _ = stripped.split('=', 1)
                    key = key.strip()
                    if key in env_data:
                        lines.append(f"{key}={env_data[key]}\n")
                        updated_keys.add(key)
                    else:
                        lines.append(line)
                else:
                    lines.append(line)
    
    # Add any new keys
    for key, val in env_data.items():
        if key not in updated_keys:
            lines.append(f"{key}={val}\n")
            
    with open(ENV_PATH, 'w', encoding='utf-8') as f:
        f.writelines(lines)

def update_capacitor(url):
    if not os.path.exists(CAPACITOR_PATH):
        print(f"Warning: {CAPACITOR_PATH} not found.")
        return
    with open(CAPACITOR_PATH, 'r', encoding='utf-8') as f:
        config = json.load(f)
    
    if "server" not in config:
        config["server"] = {}
    config["server"]["url"] = url
    
    with open(CAPACITOR_PATH, 'w', encoding='utf-8') as f:
        json.dump(config, f, indent=2)
    print(f"Updated capacitor.config.json server URL to: {url}")

def update_index_html(url):
    if not os.path.exists(INDEX_HTML_PATH):
        print(f"Warning: {INDEX_HTML_PATH} not found.")
        return
    with open(INDEX_HTML_PATH, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # 1. Replace placeholder in input
    content = re.sub(
        r'(<input type="text" id="server-url" placeholder=")([^"]*)(")',
        rf'\g<1>{url}\g<3>',
        content
    )
    
    # 2. Replace value assignment
    content = re.sub(
        r'(document\.getElementById\(\'server-url\'\)\.value = ")([^"]*)(";)',
        rf'\g<1>{url}\g<3>',
        content
    )
    
    with open(INDEX_HTML_PATH, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f"Updated public/index.html setup URLs to: {url}")

def run_cap_sync():
    print("Synchronizing Capacitor configurations...")
    try:
        # Run npx cap sync
        subprocess.run(["npx", "cap", "sync"], cwd=WORKSPACE, shell=True, check=True)
        print("Capacitor sync complete.")
    except Exception as e:
        print(f"Warning: Capacitor sync failed: {e}")

def safe_input(prompt, default=""):
    try:
        if not sys.stdin.isatty():
            return default
        val = input(prompt).strip()
        return val if val else default
    except (EOFError, KeyboardInterrupt):
        return default

def main():
    args = sys.argv[1:]
    env_name = args[0].lower() if args else None
    
    if env_name not in ENVIRONMENTS:
        print("--- Exhibition Explorer Environment Switcher ---")
        print("Choose an environment:")
        print("1. Local (for localhost web development & emulator debugging)")
        print("2. Staging (points to https://exhibition-explorer.duckdns.org)")
        print("3. Production (points to production domains)")
        choice = safe_input("Enter choice (1, 2, 3): ", "").strip()
        if choice == "1":
            env_name = "local"
        elif choice == "2":
            env_name = "staging"
        elif choice == "3":
            env_name = "production"
        else:
            print("Invalid choice or non-interactive context. Exiting.")
            sys.exit(1)
            
    config = ENVIRONMENTS[env_name].copy()
    print(f"\nSwitching to environment: {env_name.upper()}")
    
    # Allow custom inputs
    custom_srv = safe_input(f"Enter server URL (default: {config['NEXT_PUBLIC_SERVER_URL']}): ", "").strip()
    if custom_srv:
        config["NEXT_PUBLIC_SERVER_URL"] = custom_srv
        config["CAPACITOR_URL"] = custom_srv
        
    custom_db = safe_input(f"Enter DATABASE_URL (default: {config['DATABASE_URL']}): ", "").strip()
    if custom_db:
        config["DATABASE_URL"] = custom_db
        
    if env_name == "local":
        custom_cap = safe_input(f"Enter Capacitor Android/iOS Server URL (default: {config['CAPACITOR_URL']}): ", "").strip()
        if custom_cap:
            config["CAPACITOR_URL"] = custom_cap

    # Update .env
    env_data = load_env()
    env_data["NEXT_PUBLIC_SERVER_URL"] = config["NEXT_PUBLIC_SERVER_URL"]
    env_data["DATABASE_URL"] = f'"{config["DATABASE_URL"]}"'
    save_env(env_data)
    print(f"Updated .env fields:")
    print(f"  NEXT_PUBLIC_SERVER_URL = {config['NEXT_PUBLIC_SERVER_URL']}")
    print(f"  DATABASE_URL = {config['DATABASE_URL']}")
    
    # Update capacitor.config.json
    update_capacitor(config["CAPACITOR_URL"])
    
    # Update public/index.html
    update_index_html(config["CAPACITOR_URL"])
    
    # Run Capacitor sync
    run_cap_sync()
    
    print(f"\nSUCCESS! Environment successfully switched to {env_name.upper()}.")

if __name__ == "__main__":
    main()
