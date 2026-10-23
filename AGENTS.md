# Auri

Prontuário, agenda e gestão para clínica de fonoaudiologia: app desktop para Windows e Mac (Electron +
React + SQLite local) e o site `auri.dev.br` (`web/`). Os dados são de saúde de pacientes, muitos
menores de idade. Estrutura, comandos e testes por tipo de mudança estão no [README](README.md); CI e
releases em [docs/ci.md](docs/ci.md); interface em [docs/identidade-visual.md](docs/identidade-visual.md);
o desenho das funcionalidades maiores em [docs/specs/](docs/specs/).

## Verificar antes de dizer que terminou

- `desktop/`: `npm run ci:local` sempre (também roda no `git push`), mais o que a tabela "Antes de abrir
  um PR" do README pede para o que mudou.
- `web/`: `npm run check`, `npm test` e `npm run build:exemplo`.
- Mostrar a saída dos comandos. Se algo não foi testado (Windows real, celular, Mac assinado), dizer na
  descrição do PR.

## Convenções

- Sem comentários no código. Só ficam os que uma ferramenta lê: `// @vitest-environment`,
  `/// <reference>`, `oxlint-disable`, os `# vX.Y.Z` das ações fixadas por SHA e os marcadores
  `<!--app-html-->`/`<!--app-data-->` do `web/index.html`. Decisões vão na descrição do PR ou em `docs/`.
- Commit só com a linha de título, em português: `tipo(escopo): título`. Sem corpo e sem coautor.
- PR pequeno: um pedido por PR, com Testes, Risco e Como reverter (template em `.github/`).
- Banco: migrações só se acrescentam no final (`desktop/src/main/db/migrations.ts`, `web/db/migracoes/`).
- Toda chamada IPC passa por `desktop/src/main/ipc.ts`, com a entrada validada por zod; as telas só
  falam com o main por `window.api` (contrato em `desktop/src/shared/api.ts`).
- Interface: espaço como divisor (sem `border-t`/`border-b` de separação, `divide-` ou `<hr>`, exceto nas
  Configurações), botões sem contorno, nada de verde. Textos em português do Brasil, com acentos.
- Testes só com dados fictícios.
- Terceiros só como banco ou hospedagem trocáveis (Postgres por `DATABASE_URL`); lógica e API próprias.
- Não citar outros produtos como modelo em PRs, commits ou documentos.

## Code Review Rules

Revisar procurando, nesta ordem, os erros que mais custam no Auri. P0 e P1 são estes; o resto não
precisa de comentário.

**P0**

- Dado de paciente saindo do computador sem cifra ou sem o usuário pedir: relatório de erro
  (`desktop/src/main/error-reports.ts`, `web/api/erros.ts`), link curto (`web/api/links.ts`, onde o
  servidor só pode ver dado cifrado), logs, nomes de arquivo, URLs.
- Dado perdido ou corrompido: migração que edita uma existente ou apaga coluna ou tabela com dado,
  arquivo de estado ou de configuração gravado direto, sem temporário e troca (como em
  `desktop/src/main/atomic-file.ts`), cópia de segurança que pode sair incompleta ou sem cifra,
  restauração que sobrescreve sem conferir.
- Computador ou celular da recepção chegando à anamnese ou à evolução por qualquer caminho: IPC,
  conexão entre computadores, PDF, exportação, busca.
- Conexão entre computadores (`desktop/src/main/net/`) aceitando quem não foi pareado, ou celular
  passando por canal fora da lista de `desktop/src/main/net/celular.ts`.
- Canal IPC sem validação da entrada ou sem `assertTrustedSender`.

**P1**

- Termo, assinatura ou presença que pode mudar depois de assinado, ou ser assinado fora da sessão certa.
- Duas sessões sobrepostas na agenda (`assertSlotFree`).
- Site, API ou feed de atualização que deixa de aceitar versões antigas do app ainda instaladas
  (`web/contrato/`, `web/src/feed.ts`, `latest.yml`/`alpha.yml`).
- Desktop que deixa de atender uma versão do app do iPhone ainda em uso: `API_MINIMA` subindo,
  formato do contrato mudando sem adaptador ou canal saindo da lista do celular
  (`desktop/src/main/net/celular.ts`, `ios/Tests/Contrato/`).
- Atualização ou release apontando para versão, canal ou arquivo errado (`desktop/src/main/updates.ts`,
  `desktop/scripts/release/`, `desktop/electron-builder.yml`, `.github/workflows/release.yml`).
- Workflow com segredo exposto, `permissions` além do necessário, ação sem SHA fixado ou migração do Neon
  (`banco.yml`) sem caminho de volta.
- Caminho, nome de arquivo ou comando que só funciona no Mac. O CI do PR roda em Linux e não pega quebra
  só do Windows.
- Texto da interface que diz que salvou, cifrou, enviou ou apagou quando isso não aconteceu.

**Como comentar**

- Cada achado com `arquivo:linha` e o cenário que quebra (entrada e resultado errado). Sem palpite pelo
  nome da função.
- Se o problema já existia antes do PR, começar com "Já existia:".
- Dizer a classe do erro e onde mais ela aparece no diff, para corrigir todas de uma vez.
- Não comentar formato, ordem de import, nomes ou estilo (o `vp check` cobre) e não pedir comentários
  no código.
- Não repetir achado já respondido ou resolvido. Depois da primeira revisão, olhar só o que mudou desde
  o commit revisado.
- Ignorar `package-lock.json`, `dist/`, `out/`, `desktop/docs/qualidade/visual/` e
  `web/releases.exemplo.json`.
- Começar o resumo pela contagem ("1 P0, 2 P1") ou dizer "Nada a corrigir".

## Respondendo à revisão

- Cada achado é corrigido, em todas as ocorrências da mesma classe, ou tem a conversa resolvida com o
  motivo. O `main` só aceita PR com todas as conversas resolvidas.
- Depois de três rodadas de revisão no mesmo PR, parar e repensar a abordagem em vez de corrigir de novo.
- Bug que chegou ao alpha ou à estável vira um teste que o reproduz e, se o revisor deveria ter pego,
  uma linha nas regras acima.
