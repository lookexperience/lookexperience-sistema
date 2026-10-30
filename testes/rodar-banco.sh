#!/usr/bin/env bash
# Cria um banco de teste do zero, aplica o schema (duas vezes, para
# conferir que rodar de novo não estraga nada) e roda testes/banco.sql.
# Precisa de um PostgreSQL local. Uso: PGHOST=... PGPORT=... ./testes/rodar-banco.sh
set -euo pipefail
cd "$(dirname "$0")/.."
P="psql -U ${PGUSER:-postgres} -q -v ON_ERROR_STOP=1"
$P -c "drop database if exists look_teste" -c "create database look_teste" >/dev/null
$P -c "do \$\$ begin create role authenticated nologin; exception when duplicate_object then null; end \$\$;" \
   -c "do \$\$ begin create role anon nologin; exception when duplicate_object then null; end \$\$;" >/dev/null
$P -d look_teste -f testes/supabase-simulado.sql -f supabase/schema.sql 2>&1 | grep -v NOTICE || true
$P -d look_teste -f supabase/schema.sql 2>&1 | grep -v NOTICE || true
$P -d look_teste -f testes/banco.sql 2>&1 | grep -v NOTICE
