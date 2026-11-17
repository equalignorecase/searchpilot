#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."
if [[ ! -t 0 ]]; then printf 'Run npm run auth:owner in an interactive terminal.\n' >&2; exit 1; fi
printf 'Create or verify the private owner account. Password is sent only to Neon Auth.\n'
read -rs -p 'Password (12-128 characters): ' owner_password
printf '\n'
read -rs -p 'Repeat password: ' owner_confirmation
printf '\n'
if [[ "$owner_password" != "$owner_confirmation" ]]; then printf 'Passwords do not match.\n' >&2; exit 1; fi
printf '%s' "$owner_password" | node --conditions=react-server --import tsx scripts/provision-owner.ts
unset owner_password owner_confirmation
