# Links curtos

Os links de termo e de confirmação levavam o conteúdo inteiro, cifrado, depois do `#`, e por isso
ocupavam meia tela do WhatsApp. Desde 21/10/2026 o conteúdo cifrado fica guardado no site e o link
leva só um código de 22 letras:

```
https://auri.dev.br/assinar#k8Zt3mN2pL5vB7xC9dF1gQ
https://auri.dev.br/confirmar#…    https://auri.dev.br/recebido#…    https://auri.dev.br/resposta#…
```

O site guarda só o que já estava cifrado e não consegue ler: a chave sai do código, e o código fica
depois do `#`, que o navegador nunca manda ao servidor.

## Como funciona

Do código (16 bytes aleatórios, em base64url) saem duas coisas, por SHA-256 com rótulos diferentes
(`web/contrato/link-curto.ts` e `.json`):

- `id = SHA-256("auri/link/id/" + código)`: o nome do que fica guardado no site;
- `chave = SHA-256("auri/link/chave/" + código)`: a chave AES-256-GCM do conteúdo.

Quem vê o banco ou o tráfego do site tem o `id` e o conteúdo cifrado, nunca o código, e do `id` não
dá para voltar ao código.

**Ida (Auri → família):** o Auri sorteia o código, cifra com a chave dele, guarda `versão.conteúdo`
em `PUT /api/links?id=…` e manda o link curto. Se o site não responder em 3 s, manda o link longo
de antes, que continua valendo. A página busca com `GET`, põe a chave entre a versão e o conteúdo e
segue igual; com a versão guardada, um link de outra versão mostra a tela de versão, não "link
adulterado".

**Volta (família → clínica):** ao tocar em enviar, a página monta a resposta como antes (cifrada
com a chave da ida), sorteia outro código, guarda a resposta e põe o link curto na mensagem. Se o
site não responder em 1,5 s (para o toque ainda abrir o app do WhatsApp) ou sem internet, vai o
link longo. No Auri, "Colar resposta" e o `auri://` aceitam os dois: o curto é buscado no site
antes de ler, e a conferência e o guardar usam a mesma busca.

| Guardado            | Some do site                          |
| ------------------- | ------------------------------------- |
| Termo e confirmação | Um dia depois do prazo para responder |
| Resposta            | 30 dias depois de enviada             |

## O site e o banco

`web/api/links.ts` (`GET` e `PUT`, só `?id=`) grava na tabela `links` do mesmo Postgres dos
relatórios de erro (`002_links_curtos.sql`). O papel `links_uso` (ler e gravar, sem apagar) entra no
`erros_gravacao`, então o usuário da função não muda.

O banco cuida dos limites a cada gravação: apaga os vencidos, recusa mais de 3000 links ou mais de
3 MB por dia (`53400` → `503`; `003_links_teto.sql`), até 6000 caracteres só de base64url e
pontos, e no máximo 60 dias de vida. Com o teto diário, a tabela não passa de uns 180 MB mesmo com
alguém gravando o máximo todo dia. O primeiro a gravar um `id` fica; um segundo `PUT` igual não muda
nada.

Em produção a migração roda sozinha pelo workflow **Banco do site** quando o `main` recebe um
arquivo novo em `web/db/migracoes/` (ver `docs/relatorios-de-erro.md`, seção Migrações). Até a
migração rodar, o `PUT` responde `503` e o Auri manda o link longo.

## Segurança

| Tentativa                                       | O que impede                                                                                                              |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Ler um termo ou resposta pelo banco ou pela API | O conteúdo está cifrado com uma chave que só existe no código, depois do `#`.                                             |
| Adivinhar links                                 | O código tem 128 bits sorteados; o `id` é um SHA-256 dele.                                                                |
| Trocar o termo de alguém                        | Só quem tem o código calcula o `id`, e o primeiro `PUT` de um `id` fica.                                                  |
| Forjar uma resposta                             | A resposta continua cifrada e conferida com a chave da ida, como no link longo.                                           |
| Encher o banco                                  | Limites acima, no próprio banco, e o Firewall da Vercel: no máximo 60 pedidos por minuto por IP em `/api/` (desde 21/10). |
