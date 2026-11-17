#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."
umask 077
certificate=certificates/localhost.pem
key=certificates/localhost-key.pem
if [[ ! -f "$certificate" || ! -f "$key" ]]; then
  mkdir -p certificates
  openssl req -x509 -newkey rsa:2048 -nodes -days 365 \
    -keyout "$key" -out "$certificate" -subj '/CN=localhost' \
    -extensions SAN -config <(printf '[req]\ndistinguished_name=dn\n[dn]\n[SAN]\nsubjectAltName=DNS:localhost,IP:127.0.0.1\n')
fi
printf 'Open https://localhost:3000. Trust the local development certificate in your browser.\n'
exec node node_modules/next/dist/bin/next dev --port 3000 --experimental-https \
  --experimental-https-key "$key" --experimental-https-cert "$certificate" "$@"
