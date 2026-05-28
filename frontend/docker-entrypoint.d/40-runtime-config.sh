#!/bin/sh
set -eu

api_url="${VITE_API_URL:-${BACKEND_URL:-}}"
ws_url="${VITE_WS_URL:-}"

if [ -z "$ws_url" ] && [ -n "$api_url" ]; then
  case "$api_url" in
    https://*) ws_url="wss://${api_url#https://}/ws" ;;
    http://*) ws_url="ws://${api_url#http://}/ws" ;;
    *) ws_url="${api_url}/ws" ;;
  esac
fi

json_escape() {
  printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g'
}

cat > /usr/share/nginx/html/config.js <<EOF
window.__APP_CONFIG__ = {
  API_URL: "$(json_escape "$api_url")",
  WS_URL: "$(json_escape "$ws_url")"
};
EOF
