#!/usr/bin/env python3
"""HalamanHub USB serial gateway for an ESP32.

Run beside the HalamanHub server on the laptop:
    py server/scripts/python_usb_gateway.py --port COM5

Install the one external dependency first:
    py -m pip install pyserial

Telemetry uses the existing ESP32 `TELEMETRY:<json>` serial line and is
forwarded to the local Express API. For two-way watering control, the future
ESP32 firmware must also read `HH_CONTROL:<json>` lines and acknowledge them
with `HH_CONTROL_ACK:<settingsVersion>`. The current sketch does not yet read
serial control commands; this script alone therefore does not enable watering
settings over USB.
"""

import argparse
import json
import os
import re
import sys
import time
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

try:
    import serial
    from serial.tools import list_ports
except ImportError:
    print("Missing pyserial. Install it with: py -m pip install pyserial", file=sys.stderr)
    raise SystemExit(2)


SCRIPT_PATH = Path(__file__).resolve()
SERVER_DIR = SCRIPT_PATH.parents[1]
DEFAULT_API_BASE = "http://127.0.0.1:4000"
BAUD_RATE = 115200
CONTROL_POLL_SECONDS = 5
CONTROL_RETRY_SECONDS = 10
HTTP_TIMEOUT_SECONDS = 3
TELEMETRY_PREFIX = "TELEMETRY:"
CONTROL_PREFIX = "HH_CONTROL:"
CONTROL_ACK_PREFIX = "HH_CONTROL_ACK:"


class GatewayError(Exception):
    """An HTTP or gateway error safe to show in the terminal."""


def read_server_env():
    """Read simple KEY=value entries from server/.env without extra packages."""
    values = {}
    env_path = SERVER_DIR / ".env"
    if not env_path.is_file():
        return values

    try:
        for raw_line in env_path.read_text(encoding="utf-8").splitlines():
            line = raw_line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            key = key.strip()
            value = value.strip()
            if len(value) >= 2 and value[0] == value[-1] and value[0] in ("'", '"'):
                value = value[1:-1]
            values[key] = value
    except OSError as exc:
        raise GatewayError("Could not read server/.env: {}".format(exc))
    return values


def choose_port(requested_port):
    if requested_port:
        return requested_port

    ports = list(list_ports.comports())
    usb_pattern = re.compile(r"cp210|ch340|silicon labs|usb.?serial|usb.?uart", re.I)
    matches = []
    for candidate in ports:
        description = "{} {} {}".format(
            candidate.manufacturer or "",
            candidate.description or "",
            candidate.hwid or "",
        )
        if usb_pattern.search(description):
            matches.append(candidate.device)

    if len(matches) == 1:
        return matches[0]
    if not matches and len(ports) == 1:
        return ports[0].device

    if not ports:
        raise GatewayError("No serial ports found. Plug in the ESP32 and try again.")
    available = ", ".join(
        "{} ({})".format(candidate.device, candidate.description or "serial device")
        for candidate in ports
    )
    raise GatewayError(
        "Could not choose the ESP32 port automatically. Available: {}. "
        "Run again with --port COM5 (use your port).".format(available)
    )


def http_json(api_base, path, method, token, boot_id=None, payload=None):
    body = None
    headers = {"Accept": "application/json"}
    if payload is not None:
        body = json.dumps(payload, separators=(",", ":")).encode("utf-8")
        headers["Content-Type"] = "application/json"
    if token:
        headers["x-device-token"] = token
    if boot_id:
        headers["x-device-boot-id"] = boot_id

    request = Request(api_base.rstrip("/") + path, data=body, headers=headers, method=method)
    try:
        with urlopen(request, timeout=HTTP_TIMEOUT_SECONDS) as response:
            response_body = response.read().decode("utf-8", errors="replace")
            parsed = json.loads(response_body) if response_body else {}
            return response.status, parsed
    except HTTPError as exc:
        response_body = exc.read().decode("utf-8", errors="replace")
        try:
            parsed = json.loads(response_body) if response_body else {}
        except json.JSONDecodeError:
            parsed = {"message": response_body[:300]}
        message = parsed.get("message") if isinstance(parsed, dict) else None
        raise GatewayError("HTTP {}{}".format(exc.code, ": " + message if message else ""))
    except (URLError, TimeoutError, OSError) as exc:
        raise GatewayError("Could not reach the local HalamanHub server: {}".format(exc))
    except json.JSONDecodeError as exc:
        raise GatewayError("The local HalamanHub server returned invalid JSON: {}".format(exc))


def post_telemetry(api_base, token, payload):
    boot_id = payload.get("deviceBootId")
    try:
        status, result = http_json(
            api_base,
            "/api/sensor-data",
            "POST",
            token,
            boot_id=boot_id,
            payload=payload,
        )
        if 200 <= status < 300:
            sequence = payload.get("deviceSequence", "?")
            print("[usb-gateway] Reading {} saved (HTTP {}).".format(sequence, status))
            return True
        print("[usb-gateway] Server did not accept the reading (HTTP {}).".format(status))
    except GatewayError as exc:
        print("[usb-gateway] Reading forward failed: {}".format(exc))
    return False


def write_control(esp, settings):
    frame = CONTROL_PREFIX + json.dumps(settings, separators=(",", ":")) + "\n"
    esp.write(frame.encode("utf-8"))
    esp.flush()
    print(
        "[usb-gateway] Sent watering settings version {} to ESP32; "
        "firmware acknowledgement is required.".format(settings.get("settingsVersion", "?"))
    )


def run_gateway(args):
    env_values = read_server_env()
    token = os.environ.get("IOT_DEVICE_TOKEN") or env_values.get("IOT_DEVICE_TOKEN", "")
    if not token or token == "PASTE_A_RANDOM_64_CHARACTER_HEX_TOKEN_HERE":
        raise GatewayError(
            "IOT_DEVICE_TOKEN is missing. Set it in server/.env or the environment; "
            "do not put the token in a command-line argument."
        )

    api_base = args.api_base.rstrip("/")
    port_name = choose_port(args.port)
    print("[usb-gateway] Opening {} at {} baud.".format(port_name, BAUD_RATE))
    print("[usb-gateway] Local API: {}".format(api_base))
    print("[usb-gateway] Press Ctrl+C to stop.")

    with serial.Serial(port_name, BAUD_RATE, timeout=0.25, write_timeout=2) as esp:
        # Some ESP32 boards reset when the USB serial port opens.
        time.sleep(2)
        esp.reset_input_buffer()
        active_boot_id = ""
        last_control_poll = 0.0
        last_control_sent_at = 0.0
        sent_settings_version = None
        pending_control = None

        try:
            while True:
                raw_line = esp.readline()
                if raw_line:
                    line = raw_line.decode("utf-8", errors="replace").strip()

                    if line.startswith(TELEMETRY_PREFIX):
                        json_text = line[len(TELEMETRY_PREFIX):]
                        try:
                            telemetry = json.loads(json_text)
                            if not isinstance(telemetry, dict):
                                raise ValueError("telemetry must be a JSON object")
                        except (json.JSONDecodeError, ValueError) as exc:
                            print("[usb-gateway] Skipped malformed telemetry: {}".format(exc))
                            continue

                        boot_id = str(telemetry.get("deviceBootId") or "")
                        if boot_id and active_boot_id and boot_id != active_boot_id:
                            sent_settings_version = None
                            pending_control = None
                            print("[usb-gateway] ESP32 boot session changed; refreshing settings.")
                        if boot_id:
                            active_boot_id = boot_id

                        if post_telemetry(api_base, token, telemetry):
                            watering = telemetry.get("watering") or {}
                            applied_version = watering.get("appliedSettingsVersion")
                            try:
                                if pending_control and int(applied_version) >= int(
                                    pending_control.get("settingsVersion", 0)
                                ):
                                    sent_settings_version = int(
                                        pending_control.get("settingsVersion", 0)
                                    )
                                    pending_control = None
                                    print("[usb-gateway] ESP32 confirmed the watering settings.")
                            except (TypeError, ValueError):
                                pass

                    elif line.startswith(CONTROL_ACK_PREFIX):
                        try:
                            acknowledged = int(line[len(CONTROL_ACK_PREFIX):].strip())
                            if pending_control and acknowledged >= int(
                                pending_control.get("settingsVersion", 0)
                            ):
                                sent_settings_version = acknowledged
                                pending_control = None
                                print("[usb-gateway] ESP32 acknowledged settings version {}.".format(acknowledged))
                        except ValueError:
                            print("[usb-gateway] Ignored malformed control acknowledgement.")

                now = time.monotonic()
                if active_boot_id and now - last_control_poll >= CONTROL_POLL_SECONDS:
                    last_control_poll = now
                    try:
                        status, settings = http_json(
                            api_base,
                            "/api/irrigation/control",
                            "GET",
                            token,
                            boot_id=active_boot_id,
                        )
                        if status == 200 and isinstance(settings, dict):
                            try:
                                version = int(settings.get("settingsVersion", 0))
                            except (TypeError, ValueError):
                                version = 0
                            pending_version = None
                            if pending_control:
                                try:
                                    pending_version = int(pending_control.get("settingsVersion", 0))
                                except (TypeError, ValueError):
                                    pending_version = None
                            if (
                                version > 0
                                and version != sent_settings_version
                                and version != pending_version
                            ):
                                pending_control = settings
                                write_control(esp, settings)
                                last_control_sent_at = now
                    except GatewayError as exc:
                        print("[usb-gateway] Settings poll failed: {}".format(exc))

                if (
                    pending_control
                    and now - last_control_sent_at >= CONTROL_RETRY_SECONDS
                ):
                    write_control(esp, pending_control)
                    last_control_sent_at = now

        except KeyboardInterrupt:
            print("\n[usb-gateway] Stopped.")


def main():
    parser = argparse.ArgumentParser(description="Bridge HalamanHub ESP32 telemetry and controls over USB.")
    parser.add_argument("--port", help="Serial port, for example COM5 or /dev/cu.SLAB_USBtoUART. Auto-detect if omitted.")
    parser.add_argument("--api-base", default=DEFAULT_API_BASE, help="Local HalamanHub API base URL (default: %(default)s).")
    args = parser.parse_args()

    try:
        run_gateway(args)
    except GatewayError as exc:
        print("[usb-gateway] {}".format(exc), file=sys.stderr)
        raise SystemExit(1)
    except serial.SerialException as exc:
        print("[usb-gateway] Could not open/use serial port: {}".format(exc), file=sys.stderr)
        raise SystemExit(1)


if __name__ == "__main__":
    main()
