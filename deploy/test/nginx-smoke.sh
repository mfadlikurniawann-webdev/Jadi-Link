#!/usr/bin/env bash
# Functional smoke test for deploy/nginx/jadi-link.conf on Linux (no root).
# Runs a real nginx on high ports with throwaway certificates and two echo
# upstreams (API and dashboard), then checks routing and security behaviour.
# Requires: nginx, openssl, curl, python3.
# Usage: NGINX_BIN=/usr/sbin/nginx deploy/test/nginx-smoke.sh
# (Not "NGINX": nginx itself reads that variable for inherited sockets.)
set -euo pipefail

NGINX_BIN="${NGINX_BIN:-nginx}"
repo="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
work="$(mktemp -d)"
echo_pids=()

cleanup() {
  if [[ -f "$work/nginx.pid" ]]; then
    "$NGINX_BIN" -p "$work" -c "$work/nginx.conf" -e "$work/logs/error.log" -s stop 2>/dev/null || true
  fi
  for pid in "${echo_pids[@]}"; do
    kill "$pid" 2>/dev/null || true
  done
  rm -rf "$work"
}
trap cleanup EXIT

mkdir -p "$work"/{sites,ssl,logs,tmp,www/.well-known/acme-challenge}
cd "$work/ssl"
quiet() { "$@" >/dev/null 2>&1; }

# Stand-in for the Let's Encrypt certificate (fullchain.pem + privkey.pem).
quiet openssl req -x509 -newkey rsa:2048 -nodes -days 1 -subj "/CN=jadi.click" \
  -addext "subjectAltName=DNS:jadi.click,DNS:www.jadi.click" -keyout privkey.pem -out fullchain.pem
# Stand-in for a token certbot writes to the webroot during HTTP-01 validation.
echo "acme-token-content" >"$work/www/.well-known/acme-challenge/test-token"

# Same site file, remapped to the sandbox: paths, high ports, IPv4 only.
sed -e "s#/etc/letsencrypt/live/jadi.click/#$work/ssl/#g" \
  -e "s#/var/www/html#$work/www#g" \
  -e "s#/var/log/nginx/#$work/logs/#g" \
  -e '/listen \[::\]/d' \
  -e 's/listen 80/listen 18080/' \
  -e 's/listen 443/listen 18443/' \
  -e 's/127\.0\.0\.1:3001/127.0.0.1:13001/' \
  -e 's/127\.0\.0\.1:3000/127.0.0.1:13000/' \
  "$repo/deploy/nginx/jadi-link.conf" >"$work/sites/jadi-link.conf"
# Comments may mention system paths; only directives matter.
if sed '/^[[:space:]]*#/d' "$work/sites/jadi-link.conf" | grep -E '/etc/|/var/' >&2; then
  echo "Unmapped system path in the sandboxed site config." >&2
  exit 1
fi

cat >"$work/nginx.conf" <<EOF
pid $work/nginx.pid;
error_log $work/logs/error.log warn;
events {}
http {
  client_body_temp_path $work/tmp/body;
  proxy_temp_path $work/tmp/proxy;
  fastcgi_temp_path $work/tmp/fastcgi;
  uwsgi_temp_path $work/tmp/uwsgi;
  scgi_temp_path $work/tmp/scgi;
  access_log $work/logs/access.log;
  include $work/sites/jadi-link.conf;
}
EOF

ng() { "$NGINX_BIN" -p "$work" -c "$work/nginx.conf" -e "$work/logs/error.log" "$@"; }

# Echo upstream: replies with its name plus the request headers as JSON.
# The API stand-in also sends HSTS, like Helmet does, to test deduplication.
cat >"$work/echo.py" <<'EOF'
import json, sys
from http.server import BaseHTTPRequestHandler, HTTPServer

name, port = sys.argv[1], int(sys.argv[2])

class Echo(BaseHTTPRequestHandler):
    def _reply(self):
        payload = {k.lower(): v for k, v in self.headers.items()}
        payload["upstream"] = name
        body = json.dumps(payload).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        if name == "api":
            self.send_header("Strict-Transport-Security", "max-age=1")
        self.end_headers()
        self.wfile.write(body)
    do_GET = _reply
    def do_POST(self):
        self.rfile.read(int(self.headers.get("Content-Length", 0)))
        self._reply()
    def log_message(self, *args):
        pass

HTTPServer(("127.0.0.1", port), Echo).serve_forever()
EOF
python3 "$work/echo.py" api 13001 &
echo_pids+=("$!")
python3 "$work/echo.py" web 13000 &
echo_pids+=("$!")

failures=0
check() {
  local name="$1" expected="$2" actual="$3"
  if [[ "$actual" == "$expected" ]]; then
    echo "ok   - $name"
  else
    echo "FAIL - $name (expected '$expected', got '$actual')"
    failures=$((failures + 1))
  fi
}
https_req() {
  curl -sk --max-time 5 --resolve jadi.click:18443:127.0.0.1 \
    --resolve www.jadi.click:18443:127.0.0.1 "$@"
}
json_field() { python3 -c 'import json,sys; print(json.loads(sys.argv[1]).get(sys.argv[2], "<absent>"))' "$1" "$2"; }
upstream_of() { json_field "$(https_req "https://jadi.click:18443$1")" upstream; }

ng -t -q
ng
sleep 0.5

echo "== routing"
check "/ goes to the dashboard" "web" "$(upstream_of /)"
check "/login goes to the dashboard" "web" "$(upstream_of /login)"
check "/register goes to the dashboard" "web" "$(upstream_of /register)"
check "/dashboard goes to the dashboard" "web" "$(upstream_of /dashboard)"
check "/links/<id> goes to the dashboard" "web" "$(upstream_of /links/0b6f1c2e)"
check "/_next assets go to the dashboard" "web" "$(upstream_of /_next/static/chunk.js)"
check "/icon.svg goes to the dashboard" "web" "$(upstream_of /icon.svg)"
check "/api/health goes to the API" "api" "$(upstream_of /api/health)"
check "short link /abc goes to the API" "api" "$(upstream_of /abc1234)"
check "/loginx is a short link, not a page" "api" "$(upstream_of /loginx)"

echo "== headers"
# No Cloudflare in front: forged CF headers from a client must not reach the API.
headers="$(https_req -H 'X-Forwarded-For: 6.6.6.6' -H 'CF-Connecting-IP: 198.51.100.7' \
  -H 'CF-IPCountry: ID' https://jadi.click:18443/abc1234)"
check "Host is forwarded" "jadi.click" "$(json_field "$headers" host)"
check "spoofed X-Forwarded-For is overwritten" "127.0.0.1" "$(json_field "$headers" x-forwarded-for)"
check "X-Forwarded-Proto is https" "https" "$(json_field "$headers" x-forwarded-proto)"
check "client CF-Connecting-IP is stripped" "<absent>" "$(json_field "$headers" cf-connecting-ip)"
check "client CF-IPCountry is stripped" "<absent>" "$(json_field "$headers" cf-ipcountry)"
hsts_count() { https_req -o /dev/null -D - "https://jadi.click:18443$1" | grep -ci '^strict-transport-security:'; }
check "API response has exactly one HSTS header" "1" "$(hsts_count /api/health)"
check "dashboard response has exactly one HSTS header" "1" "$(hsts_count /)"

echo "== limits and hosts"
check "body over 64 KiB is rejected" "413" \
  "$(head -c 70000 /dev/zero | https_req -o /dev/null -w '%{http_code}' --data-binary @- https://jadi.click:18443/api/links)"
https_req --resolve other.example.com:18443:127.0.0.1 -o /dev/null https://other.example.com:18443/ && sni=accepted || sni=rejected
check "unknown TLS hostname is refused" "rejected" "$sni"
check "https://www redirects to the apex" "301 https://jadi.click/abc1234" \
  "$(https_req -o /dev/null -w '%{http_code} %{redirect_url}' https://www.jadi.click:18443/abc1234)"

http_req() { curl -s --max-time 5 -H "Host: ${HOST_HEADER:-jadi.click}" "$@"; }
check "HTTP redirects to HTTPS apex" "301 https://jadi.click/abc1234" \
  "$(http_req -o /dev/null -w '%{http_code} %{redirect_url}' http://127.0.0.1:18080/abc1234)"
check "HTTP www redirects to HTTPS apex" "301 https://jadi.click/abc1234" \
  "$(HOST_HEADER=www.jadi.click http_req -o /dev/null -w '%{http_code} %{redirect_url}' http://127.0.0.1:18080/abc1234)"
check "ACME challenge is served over HTTP" "acme-token-content" \
  "$(http_req http://127.0.0.1:18080/.well-known/acme-challenge/test-token)"
check "ACME challenge is served for www too" "acme-token-content" \
  "$(HOST_HEADER=www.jadi.click http_req http://127.0.0.1:18080/.well-known/acme-challenge/test-token)"
check "missing ACME token is 404, not proxied" "404" \
  "$(http_req -o /dev/null -w '%{http_code}' http://127.0.0.1:18080/.well-known/acme-challenge/missing)"
curl -s --max-time 5 -o /dev/null -H 'Host: other.example.com' http://127.0.0.1:18080/ && plain=answered || plain=dropped
check "unknown HTTP host is dropped (444)" "dropped" "$plain"

if grep -qE '127\.0\.0\.1|198\.51\.100\.7' "$work"/logs/jadi-link.access.log; then
  check "visitor IP is not written to the access log" "absent" "present"
else
  check "visitor IP is not written to the access log" "absent" "absent"
fi

if ((failures > 0)); then
  echo "$failures check(s) failed."
  exit 1
fi
echo "All nginx smoke checks passed."
