# Relatórios de erro

Quando o Auri instalado falha, ele manda sozinho para a equipe o tipo do erro e o ponto do código
onde ele aconteceu, sem dados de pacientes. Quem usa pode desligar em Configurações › Geral.

O serviço foi montado para sair da Vercel a qualquer momento: o app só conhece um endereço com
nome próprio e um formato de JSON, e o banco é um Postgres comum. Nenhuma das três partes depende
das outras.

```
Auri instalado ──POST JSON──▶ erros.auri.dev.br/api/erros ──SQL──▶ Postgres (DATABASE_URL)
(desktop/src/main/          (web/api/erros.ts, hoje na Vercel)   (tabela error_reports)
 error-reports.ts)
```

## O app

- Cada falha fica em `relatorios-de-erro.json`, ao lado do banco, mesmo com o envio desligado
  ("Copiar relatório" usa esse arquivo).
- Ligado, sai 5 s depois da falha, 30 s depois de abrir e a cada hora, até 20 por envio. Sem
  internet, ou se o Auri fechou com a falha, fica na fila (as 50 mais recentes) para a próxima vez.
- Só vai a mensagem de `TypeError`, `ReferenceError`, `RangeError` e `SqliteError`, sem textos
  entre aspas e sem números longos. A pilha vai sem o caminho da instalação e sem o nome do
  usuário. As outras mensagens podem ter o que foi digitado, então não saem.
- O endereço é `https://erros.auri.dev.br/api/erros`, só no app instalado. `AURI_ERROS_URL` troca
  o endereço; vazio desliga o envio.

## O contrato

`POST /api/erros` com `content-type: application/json`, até 64 KB:

```json
{
  "installId": "uuid aleatório da instalação",
  "version": "0.0.1",
  "channel": "latest",
  "platform": "win32",
  "arch": "x64",
  "osVersion": "10.0.26100",
  "electron": "44.9.0",
  "reports": [
    {
      "id": "uuid da falha",
      "at": "2026-10-19T13:00:00.000Z",
      "origin": "main | renderer | process",
      "name": "TypeError",
      "message": "Cannot read properties of undefined (reading 'nome')",
      "stack": "at render (app.asar/out/renderer/assets/index-abc.js:12:345)",
      "count": 3
    }
  ]
}
```

O app decide pela resposta. Qualquer servidor novo precisa responder igual:

| Resposta                         | O app                                        |
| -------------------------------- | -------------------------------------------- |
| `2xx`                            | marca como enviado                           |
| `4xx` (fora `429`)               | descarta: mandar de novo daria o mesmo erro  |
| `429`, `5xx`, sem rede, sem DNS  | guarda e tenta de novo mais tarde            |

Os limites de cada campo ficam num arquivo só, `web/contrato/relatorio-de-erro.json`, que os dois
lados leem: o app corta e divide os envios por ele, e a função monta o `payloadSchema` com ele. Os
testes de contrato quebram se um lado sair dele: o do app manda o pior caso (pilhas e nomes enormes,
a mesma falha repetida sem parar) e confere cada envio contra o arquivo; o da função aceita o que
está no limite e recusa um acima.

Versões antigas continuam instaladas por meses. Afrouxar um limite é seguro; apertar faz a função
recusar o que as versões antigas mandam, e o app descarta o que é recusado.

## O banco

Uma linha por falha na tabela `error_reports`, criada por `web/db/erros.sql`. A função não cria
nada: ela entra com um usuário que **só grava** nessa tabela (papel `erros_gravacao`). O `id` é o
do app, então um envio repetido não duplica nada. A tabela é criada, ou atualizada, com o dono do
banco:

```sh
cd web
DATABASE_URL=<endereço do dono> npm run erros:migrar
```

Algumas consultas, com o dono:

```sql
-- as falhas mais comuns da última semana
SELECT name, message, version, sum(count) AS vezes, count(DISTINCT install_id) AS computadores
FROM error_reports
WHERE happened_at > now() - interval '7 days'
GROUP BY 1, 2, 3
ORDER BY vezes DESC;

-- limpar o que tem mais de 90 dias
DELETE FROM error_reports WHERE happened_at < now() - interval '90 days';
```

## Hoje: Vercel + Neon

- A função mora no projeto `auri` da Vercel, junto com o site (`web/`), no Node 24.x. O domínio
  `erros.auri.dev.br` aponta para esse projeto; a raiz dele redireciona para o site.
- O banco é um Neon do Marketplace da Vercel, Postgres 17, na região AWS us-east-1: a função roda
  em `iad1` (Washington).
- Sem `DATABASE_URL`, ou com o banco fora do ar, a função responde `503` e os apps guardam as
  falhas para depois.

Para ligar:

1. Crie o Neon pelo Marketplace (Storage › Neon) e **não** deixe ele gravar as variáveis no projeto:
   o endereço que ele daria é o do dono, que lê tudo.
2. Com o endereço do dono, rode `npm run erros:migrar` (acima).
3. Crie o usuário da função com uma senha longa e aleatória, no SQL Editor do Neon:
   `CREATE ROLE erros_funcao LOGIN PASSWORD '<senha>' IN ROLE erros_gravacao;`
4. Em Settings › Environment Variables do projeto `auri`, crie `DATABASE_URL` com o endereço
   **com pool** desse usuário (`postgres://erros_funcao:<senha>@<host>-pooler.…/neondb`), só em
   **Production**: as prévias do site não precisam do banco.
5. Em Settings › Domains, adicione `erros.auri.dev.br`, e no registro.br o CNAME de `erros` que a
   Vercel mostrar.

## Segurança

O que alguém consegue tentando atacar ou interceptar o serviço:

| Tentativa | O que impede |
| --- | --- |
| Ler o envio no caminho (Wi-Fi da clínica, provedor) | O app só manda por HTTPS e confere o certificado; o envio também não tem dado de paciente nem nome de quem usa. |
| Fazer o app mandar para outro lugar | O endereço está no app (`erros.auri.dev.br`) e redirecionamentos são recusados (`redirect: 'error'`): o relatório só vai para o endereço configurado. |
| Ler os relatórios pela API | Não há como: a função só aceita `POST` e responde sem corpo. Nenhum caminho devolve o que está no banco. |
| Ler os relatórios com o endereço do banco, se vazar da Vercel | O usuário da função só grava: `SELECT`, `UPDATE`, `DELETE`, outras tabelas e criar tabelas dão "permission denied" (testado em `web/tests/erros.test.ts`). |
| Se passar pelo banco entre a função e o Neon | A conexão confere o certificado do banco (`verify-full`). O `sslmode=require` do endereço do Neon cifraria sem conferir; o código ignora esse modo. |
| Injetar SQL pelos campos | Todo valor vai como parâmetro (`sql(rows)` do driver `postgres`), nunca colado no texto do SQL; os campos ainda passam pelo `payloadSchema` (tipos e tamanhos). |
| Encher o banco de lixo | Dá para gravar relatórios falsos (o app é público, não há senha a esconder), mas não ler nada. Limites: 64 KB e 20 falhas por envio. Falta um limite por IP no Firewall da Vercel. |

O que não sai do computador de jeito nenhum: dados de pacientes, o que foi digitado, o nome de quem
usa e o nome do computador. O IP de quem manda não é guardado.

## Testes com banco

Os testes da tabela e das permissões (`web/tests/erros.test.ts`) rodam contra um Postgres de
verdade, com o endereço do dono. Sem `TEST_DATABASE_URL`, eles são pulados.

```sh
cd web
TEST_DATABASE_URL=postgres://<dono>@localhost:5432/<banco> npm test
```

Qualquer Postgres 17 serve (Homebrew, Postgres.app, um branch do Neon). Os testes criam e apagam a
tabela, o papel e um usuário de teste.

## Trocar de lugar

Cada parte troca sozinha, sem nova versão do app.

**Outro Postgres** (Supabase, RDS, um servidor próprio): rode `npm run erros:migrar` no banco novo,
crie o usuário da função (passo 3 acima), copie os dados e troque `DATABASE_URL`.

```sh
pg_dump --data-only --table=error_reports "$DONO_ANTIGO" | psql "$DONO_NOVO"
```

**Outra hospedagem para a função**: `web/api/erros.ts` só usa `Request`/`Response` da web e
exporta `{ fetch }`, que Cloudflare Workers, Deno e Bun aceitam como está. Num Node comum (Fly,
Railway, Render, uma VPS), o servidor de `web/scripts/servidor-erros.ts` responde em `/api/erros`
e em `/saude` (para a checagem de saúde da hospedagem):

```sh
cd web
DATABASE_URL=postgres://… DATABASE_POOL=10 PORT=8080 npm run erros:servidor
```

`DATABASE_POOL` é o número de conexões com o banco: 1 na Vercel, mais num servidor que fica de pé.

Ponha HTTPS na frente (a maioria dessas hospedagens já põe; numa VPS, Caddy ou nginx) e troque o
DNS de `erros` no registro.br para o novo lugar. Os apps instalados passam a mandar para lá; o que
estiver na fila durante a troca sai na próxima tentativa.

**Desligar o serviço** sem perder nada: apague `DATABASE_URL` (a função responde `503`) ou o DNS
de `erros`. Os apps guardam as 50 falhas mais recentes até o serviço voltar.
