#!/usr/bin/env bash
# Regenerates the nginx allowlist of Cloudflare edge ranges.
# Usage: sudo deploy/scripts/update-cloudflare-ips.sh [output-file]
# Default output: /etc/nginx/snippets/cloudflare-ips.conf (validated + reloaded).
set -euo pipefail

output="${1:-/etc/nginx/snippets/cloudflare-ips.conf}"
tmp="$(mktemp)"
trap 'rm -f "$tmp"' EXIT

ipv4="$(curl -fsS --max-time 15 https://www.cloudflare.com/ips-v4)"
ipv6="$(curl -fsS --max-time 15 https://www.cloudflare.com/ips-v6)"

{
  echo "# Cloudflare edge ranges. Generated $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "# by deploy/scripts/update-cloudflare-ips.sh — do not edit by hand."
  while IFS= read -r range; do
    [[ -z "$range" ]] && continue
    if [[ ! "$range" =~ ^[0-9]{1,3}(\.[0-9]{1,3}){3}/[0-9]{1,2}$ ]]; then
      echo "Unexpected IPv4 range: $range" >&2
      exit 1
    fi
    echo "allow $range;"
  done <<<"$ipv4"
  while IFS= read -r range; do
    [[ -z "$range" ]] && continue
    if [[ ! "$range" =~ ^[0-9a-fA-F:]+/[0-9]{1,3}$ ]]; then
      echo "Unexpected IPv6 range: $range" >&2
      exit 1
    fi
    echo "allow $range;"
  done <<<"$ipv6"
} >"$tmp"

# Refuse to write a suspiciously short list (e.g. an error page).
if (($(grep -c '^allow ' "$tmp") < 10)); then
  echo "Cloudflare returned too few ranges; keeping the current file." >&2
  exit 1
fi

if [[ "$output" == /etc/nginx/* ]]; then
  backup=""
  if [[ -f "$output" ]]; then
    backup="$(mktemp)"
    cp "$output" "$backup"
  fi
  install -m 0644 "$tmp" "$output"
  if ! nginx -t; then
    echo "nginx -t failed; restoring the previous allowlist." >&2
    if [[ -n "$backup" ]]; then
      install -m 0644 "$backup" "$output"
    else
      rm -f "$output"
    fi
    exit 1
  fi
  [[ -n "$backup" ]] && rm -f "$backup"
  systemctl reload nginx
  echo "Updated $output and reloaded nginx."
else
  install -m 0644 "$tmp" "$output"
  echo "Wrote $output."
fi
