#!/usr/bin/env bash
# Monta a pasta "publico" com só o que o navegador precisa (sem banco,
# testes, robôs e documentação) e os cabeçalhos de segurança.
# Usado pela Cloudflare Pages: comando de build "bash publicar.sh",
# pasta de saída "publico".
set -euo pipefail
cd "$(dirname "$0")"
rm -rf publico
mkdir publico
cp -r index.html briefing.html css fonts img js modelos publico/
# Mesmos cabeçalhos do netlify.toml, no formato da Cloudflare (_headers).
csp=$(grep -o 'Content-Security-Policy = "[^"]*"' netlify.toml | sed 's/^Content-Security-Policy = "//; s/"$//')
cat > publico/_headers <<CAB
/*
  Content-Security-Policy: $csp
  Strict-Transport-Security: max-age=31536000
  X-Frame-Options: DENY
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()
  X-Robots-Tag: noindex, nofollow
CAB
echo "Pasta publico pronta: $(find publico -type f | wc -l) arquivos."
