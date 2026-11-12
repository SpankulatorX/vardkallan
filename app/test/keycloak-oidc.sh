#!/bin/sh
# Runda 14, r1 (Sussa 5.2.1.1): lokalt prov av inloggningen genom beställarens inloggningstjänst mot Keycloak i en egen
# container. Behövs inte för de vanliga servertesterna. Kör från repots rot: sh app/test/keycloak-oidc.sh
# Keycloak och Vårdkällan lyssnar bara på 127.0.0.1. Resultatet skrivs till app/test/keycloak-oidc-resultat.json.
set -eu
KC_VERSION=26.0.7
KC_BILD="quay.io/keycloak/keycloak:${KC_VERSION}"
NAMN=vk14-r1-keycloak
LOSEN=$(head -c 18 /dev/urandom | base64 | tr -d '/+=')
ROT=$(cd "$(dirname "$0")/../.." && pwd)
stopp() { docker stop "$NAMN" >/dev/null 2>&1 || true; }
trap stopp EXIT
docker run -d --rm --name "$NAMN" --memory 1g --network host \
  -e KC_BOOTSTRAP_ADMIN_USERNAME=admin -e KC_BOOTSTRAP_ADMIN_PASSWORD="$LOSEN" \
  -e KC_HTTP_PORT=18181 -e KC_HTTP_HOST=127.0.0.1 -e JAVA_OPTS_KC_HEAP="-Xms64m -Xmx512m" \
  "$KC_BILD" start-dev >/dev/null
docker run --rm --name vk14-r1-kc-prov --memory 1g --network host -v "$ROT:/w" -w /w/app \
  -e KC_ADMIN_LOSEN="$LOSEN" -e KC_VERSION="$KC_VERSION" -e KC_RESULTAT=/w/app/test/keycloak-oidc-resultat.json \
  oven/bun:1.3.14-alpine bun test/keycloak-oidc.js
