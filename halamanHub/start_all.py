#!/usr/bin/env python3
"""Start the HalamanHub admin/API, customer app, USB gateway, and ngrok tunnel.

Run from the project directory with:
    py start_all.py

Defaults can be overridden, for example:
    py start_all.py --port COM3
"""

import argparse
import shutil
import subprocess
import sys
import time
from pathlib import Path


PROJECT_DIR = Path(__file__).resolve().parent
GATEWAY_SCRIPT = PROJECT_DIR / "server" / "scripts" / "python_usb_gateway.py"
NGROK_DOMAIN = "dividers-curvature-neuter.ngrok-free.dev"


def windows_command(command, cwd):
    """Start an npm command through cmd.exe so npm.cmd works on Windows."""
    return subprocess.Popen(
        ["cmd.exe", "/d", "/c", command],
        cwd=str(cwd),
        creationflags=subprocess.CREATE_NEW_PROCESS_GROUP,
    )


def stop_process_tree(process):
    if process.poll() is not None:
        return
    try:
        subprocess.run(
            ["taskkill", "/PID", str(process.pid), "/T", "/F"],
            check=False,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
    except OSError:
        process.kill()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--port",
        default="COM4",
        help="ESP32 serial port (default: COM4)",
    )
    args = parser.parse_args()

    if sys.platform != "win32":
        parser.error("This launcher is intended for Windows PowerShell.")
    if not GATEWAY_SCRIPT.is_file():
        parser.error("USB gateway script was not found: {}".format(GATEWAY_SCRIPT))
    if not shutil.which("npm.cmd") and not shutil.which("npm"):
        parser.error("npm was not found. Install Node.js and make sure npm is on PATH.")

    processes = []
    try:
        print("[launcher] Starting admin dashboard and API (http://localhost:3000)...", flush=True)
        processes.append(("admin/API", windows_command("npm run dev", PROJECT_DIR)))
        time.sleep(1)

        print("[launcher] Starting customer shop (http://localhost:3001)...", flush=True)
        processes.append(("customer app", windows_command("npm start", PROJECT_DIR / "mapili")))

        print("[launcher] Starting USB gateway on {}...".format(args.port), flush=True)
        gateway = subprocess.Popen(
            [sys.executable, str(GATEWAY_SCRIPT), "--port", args.port],
            cwd=str(PROJECT_DIR),
            creationflags=subprocess.CREATE_NEW_PROCESS_GROUP,
        )
        processes.append(("USB gateway", gateway))

        ngrok = shutil.which("ngrok.exe") or shutil.which("ngrok")
        if ngrok:
            print("[launcher] Starting ngrok for http://localhost:4000...", flush=True)
            tunnel = subprocess.Popen(
                [ngrok, "http", "--domain=" + NGROK_DOMAIN, "4000"],
                cwd=str(PROJECT_DIR),
                creationflags=subprocess.CREATE_NEW_PROCESS_GROUP,
            )
            processes.append(("ngrok", tunnel))
            print("[launcher] Public API: https://{}".format(NGROK_DOMAIN), flush=True)
        else:
            print(
                "[launcher] ngrok was not found on PATH; local services are running, "
                "but no public tunnel was started. Install ngrok or add ngrok.exe to PATH.",
                flush=True,
            )

        print("[launcher] Admin: http://localhost:3000", flush=True)
        print("[launcher] Customer shop: http://localhost:3001", flush=True)
        print("[launcher] Press Ctrl+C to stop everything.", flush=True)

        reported_exits = set()
        while True:
            for name, process in processes:
                exit_code = process.poll()
                if exit_code is not None and name not in reported_exits:
                    reported_exits.add(name)
                    print(
                        "[launcher] {} exited with code {}.".format(name, exit_code),
                        flush=True,
                    )
            time.sleep(2)
    except KeyboardInterrupt:
        print("\n[launcher] Stopping all services...", flush=True)
    finally:
        for _, process in reversed(processes):
            stop_process_tree(process)
        print("[launcher] All started processes have been stopped.", flush=True)


if __name__ == "__main__":
    main()
