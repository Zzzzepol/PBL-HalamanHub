// Copy this file to halamanhub_config.h and edit your local network details.
// Keep halamanhub_config.h private; it is ignored by Git.
#define HALAMANHUB_WIFI_SSID "YOUR_LOCAL_WIFI_NAME"
#define HALAMANHUB_WIFI_PASS "YOUR_LOCAL_WIFI_PASSWORD"

// Use the laptop's IPv4 address on the same Wi-Fi network as this ESP32.
// Do not use localhost or 127.0.0.1 here.
#define HALAMANHUB_LAPTOP_IP "192.168.1.10"

#define HALAMANHUB_DEVICE_ID "ESP32-01"

// Required. Generate a random token and use the same value for IOT_DEVICE_TOKEN
// in server/.env. Keep this private config file out of Git.
#define HALAMANHUB_DEVICE_TOKEN "PASTE_A_RANDOM_64_CHARACTER_HEX_TOKEN_HERE"
