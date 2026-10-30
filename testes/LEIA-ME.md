# Testes do sistema

Dois conjuntos de testes simulam cada tipo de usuário. Rode os dois antes de publicar qualquer atualização.

| Arquivo | O que testa | Como rodar |
| --- | --- | --- |
| `banco.sql` | As regras de segurança do banco: o que administrador, gerente, freelancer, conta nova, conta desativada e visitante sem login conseguem ver, criar, editar e apagar. | `PGHOST=... PGPORT=... ./testes/rodar-banco.sh` (precisa de um PostgreSQL local; `supabase-simulado.sql` imita o login do Supabase) |
| `telas.mjs` | As telas num navegador de verdade, no modo demonstração: cada usuário clicando, criando, editando, arrastando, comentando, filtrando e apagando. | `node testes/telas.mjs` (precisa do pacote `playwright`); capturas de tela vão para `testes/capturas/` |

Cada linha mostra `OK` ou `FALHOU`. Uma atualização só vai pro ar com tudo `OK`.
