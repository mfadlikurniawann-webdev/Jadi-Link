#!/usr/bin/env bash
# Functional smoke test for deploy/nginx/jadi-link.conf on Linux (no root).
# Runs a real nginx on high ports with throwaway certificates and an echo
# upstream, then checks the public site's security behaviour.
# Requires: nginx, openssl, curl, python3.
# Usage: NGINX_BIN=/usr/sbin/nginx deploy/test/nginx-smoke.sh
# (Not "NGINX": nginx itself reads that variable for inherited sockets.)
set -euo pipefail

NGINX_BIN="${NGINX_BIN:-nginx}"
repo="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
work="$(mktemp -d)"
echo_pid=""

cleanup() {
  if [[ -f "$work/nginx.pid" ]]; then
    "$NGINX_BIN" -p "$work" -c "$work/nginx.conf" -e "$work/logs/error.log" -s stop 2>/dev/null || true
  fi
  if [[ -n "$echo_pid" ]]; then
    kill "$echo_pid" 2>/dev/null || true
  fi
  rm -rf "$work"
}
trap cleanup EXIT

mkdir -p "$work"/{sites,ssl,logs,tmp,www/.well-known/acme-challenge}
cd "$work/ssl"
quiet() { "$@" >/dev/null 2>&1; }

# Stand-in for the Let's Encrypt certificate (fullchain.pem + privkey.pem).
quiet openssl req -x509 -newkey rsa:2048 -nodes -days 1 -subj "/CN=link.example.com" \
  -addext "subjectAltName=DNS:link.example.com" -keyout privkey.pem -out fullchain.pem
# Stand-in for a token certbot writes to the webroot during HTTP-01 validation.
echo "acme-token-content" >"$work/www/.well-known/acme-challenge/test-token"

# Same site file, remapped to the sandbox: paths, high ports, IPv4 only.
sed -e "s#/etc/letsencrypt/live/link.example.com/#$work/ssl/#g" \
  -e "s#/var/www/html#$work/www#g" \
  -e "s#/var/log/nginx/#$work/logs/#g" \
  -e '/listen \[::\]/d' \
  -e 's/listen 80/listen 18080/' \
  -e 's/listen 443/listen 18443/' \
  -e 's/127\.0\.0\.1:3001/127.0.0.1:13001/' \
  "$repo/deploy/nginx/jadi-link.conf" >"$work/sites/jadi-link.conf"
if grep -qE '/etc/|/var/' "$work/sites/jadi-link.conf"; then
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

# Echo upstream that returns the request headers it received as JSON.
cat >"$work/echo.py" <<'EOF'
import json
from http.server import BaseHTTPRequestHandler, HTTPServer

class Echo(BaseHTTPRequestHandler):
    def _reply(self):
        body = json.dumps({k.lower(): v for k, v in self.headers.items()}).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)
    do_GET = _reply
    def do_POST(self):
        self.rfile.read(int(self.headers.get("Content-Length", 0)))
        self._reply()
    def log_message(self, *args):
        pass

HTTPServer(("127.0.0.1", 13001), Echo).serve_forever()
EOF
python3 "$work/echo.py" &
echo_pid=$!

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
  curl -sk --max-time 5 --resolve link.example.com:18443:127.0.0.1 "$@"
}

ng -t -q
ng
sleep 0.5

# No Cloudflare in front: forged CF headers from a client must not reach the API.
headers="$(https_req -H 'X-Forwarded-For: 6.6.6.6' -H 'CF-Connecting-IP: 198.51.100.7' \
  -H 'CF-IPCountry: ID' https://link.example.com:18443/abc)"
field() { python3 -c 'import json,sys; print(json.loads(sys.argv[1]).get(sys.argv[2], "<absent>"))' "$headers" "$1"; }
check "HTTPS request reaches the API" "link.example.com" "$(field host)"
check "spoofed X-Forwarded-For is overwritten" "127.0.0.1" "$(field x-forwarded-for)"
check "X-Forwarded-Proto is https" "https" "$(field x-forwarded-proto)"
check "client CF-Connecting-IP is stripped" "<absent>" "$(field cf-connecting-ip)"
check "client CF-IPCountry is stripped" "<absent>" "$(field cf-ipcountry)"

check "body over 64 KiB is rejected" "413" \
  "$(head -c 70000 /dev/zero | https_req -o /dev/null -w '%{http_code}' --data-binary @- https://link.example.com:18443/api/links)"

https_req --resolve other.example.com:18443:127.0.0.1 -o /dev/null https://other.example.com:18443/ && sni=accepted || sni=rejected
check "unknown TLS hostname is refused" "rejected" "$sni"

http_req() { curl -s --max-time 5 -H 'Host: link.example.com' "$@"; }
check "HTTP redirects to HTTPS" "301" \
  "$(http_req -o /dev/null -w '%{http_code}' http://127.0.0.1:18080/abc)"
check "ACME challenge is served over HTTP" "acme-token-content" \
  "$(http_req http://127.0.0.1:18080/.well-known/acme-challenge/test-token)"
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
