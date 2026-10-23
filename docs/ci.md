# CI e releases

O PR é validado rápido, o uso real vem do alpha e a estável promove um alpha que já foi usado.

## Pull requests

O workflow **CI** roda o **Check**, uma vez por PR, em ~3 min numa máquina Ubuntu.
O Linux não faz parte do produto: é só a máquina mais barata do Actions para estas verificações.
Um job só porque cada job paga de novo checkout, Node e cache, e o Actions arredonda cada um para
o minuto inteiro. Ao lado dele roda o **iPhone no Mac** (imagem `xcode-27`, Xcode 27.1 e XcodeGen
fixos), que gera o projeto do Xcode, confere o formato do Swift e roda os testes em Swift. Como o
repositório é público, as máquinas padrão do Actions, Mac inclusive, não são cobradas; as `-xlarge`
seriam.

| Passo         | O que confere                                                                            |
| ------------- | ---------------------------------------------------------------------------------------- |
| Lint          | `npm run check` (formato, lint e tipos) e `npm run knip` (código e dependências sem uso) |
| Build         | `npm run build` (electron-vite; os tipos já passaram no `npm run check`)                 |
| Test          | `npm test` (Vitest no Node do Electron)                                                  |
| Release Smoke | `node --test scripts/release/*.test.mjs` (versões e tradução da pilha de erros)          |
| Site          | `npm run check`, `npm test` e `npm run build:exemplo`                                    |

Os passos do app rodam em `desktop/`, os do site em `web/` e os do iPhone em `ios/`: formato, lint
e tipos do worklet e o teste da conexão (o cliente do iPhone no runtime Bare contra as operações do
desktop, numa DHT local), que pega quando uma mudança no desktop quebra o celular. Esse teste também
confere as respostas do desktop com `ios/Tests/Contrato/contrato.json`, o mesmo arquivo que os testes
em Swift decodificam nos modelos do app: um campo que o desktop renomeia ou tira reprova no Linux,
sem precisar do Mac. Quando a mudança é de propósito, `npm run contrato` (em `ios/`) grava o arquivo
de novo.

Os passos rodam mesmo depois de um erro, para o PR mostrar todos de uma vez. O `Check` é o único
check exigido pela proteção do `main`, que também exige o PR **atualizado com o `main`**: o que
entra é exatamente o que o CI testou, então não há outra execução no push no `main`. Se o `main`
andou desde o último CI do PR, o GitHub pede **Update branch**
(`gh pr update-branch --rebase`) e o CI roda de novo, com os dois juntos. Não há aprovação obrigatória: com o `Check` verde e o PR
atualizado, ele pode ser mesclado por squash ou rebase.

Os mesmos passos rodam na sua máquina antes de cada `git push` (`npm run ci:local`, pelo hook
`desktop/.vite-hooks/pre-push`). Por isso o Actions não roda em **rascunho**: abra o PR como
rascunho enquanto ajusta (`gh pr create --draft`) e marque como pronto (`gh pr ready`) quando
terminar. Um rascunho não pode ser mesclado. Para o CI rodar só uma vez: um PR pronto de cada vez,
mesclado antes de marcar o próximo como pronto, e sem push depois de pronto.

No `ci:local`, lint, testes e o build do site passam pelo cache do Vite+ (`vp run --cache`): se
nada do que o passo lê mudou desde a última vez que passou, a saída é repetida sem rodar de novo
(`npx vp cache clean` zera). O `npm ci` do site só roda quando o `package-lock.json` mudou. O Actions
roda tudo sem cache.

Os hooks são do Vite+. O `npm install` do desktop instala os hooks (`vp config`). Antes de cada
commit, o `desktop/.vite-hooks/pre-commit` roda o `vp staged` no app e no site: formato e lint só
dos arquivos do commit, corrigindo o que der. `npx vp hooks status` mostra o estado, e `VP_GIT_HOOKS=0` desliga os
hooks num comando.

## Revisão

O Codex revisa o PR quando ele sai do rascunho: a revisão de código e a de segurança, que roda junto.
Ele segue as **Code Review Rules** do [AGENTS.md](../AGENTS.md), que dizem o que é erro grave no Auri
(dado de paciente exposto ou perdido, recepção vendo o que não pode, atualização apontando errado…),
e só comenta P0 e P1. Sem achados, ele reage com 👍 no PR. `@codex review` e `@codex security review`
num comentário pedem de novo.

A proteção do `main` exige todas as conversas resolvidas: cada achado é corrigido ou tem a conversa
resolvida com o motivo. Depois de três rodadas no mesmo PR, a abordagem é repensada em vez de corrigida
de novo. Quando um bug passa da revisão e chega ao alpha, ele vira um teste e, se for do tipo que a
revisão deveria pegar, uma regra no `AGENTS.md`.

Antes de marcar o PR como pronto, o agente que escreveu o código roda a própria revisão na máquina
(`/code-review` e, nas áreas sensíveis, `/security-review`, ver [CLAUDE.md](../CLAUDE.md)). O template
do PR pede Testes, Risco e Como reverter.

Não há aprovação obrigatória, CODEOWNERS nem fila de merge: com uma pessoa só no projeto, o GitHub não
deixa aprovar o próprio PR, e a exigência de PR atualizado com o `main` já garante o que a fila
garantiria.

## Windows (manual) e Mac (local)

O workflow **Windows** abre o Auri de verdade (E2E), testa a interface, o pacote, o instalador e os
instaladores oficiais das nuvens. Não roda sozinho:

```bash
gh workflow run windows.yml --ref <branch>
```

No Mac, os mesmos passos rodam na própria máquina, não no Actions, onde o minuto do Mac custa 10x
o do Linux. Rodar antes de cada estável e em mudanças que mexem no Mac:

```bash
npm run ci:mac
```

O app do iPhone só compila no Mac. No `git push` feito no Mac, o `npm run ci:local` gera o projeto
do Xcode e roda os testes em Swift quando a branch mexe em `ios/` ou no código que ele usa do desktop
(`desktop/src/main/net/`, `db/`, `operations.ts`, `desktop/src/shared/`); o job **iPhone no Mac** repete
isso no PR. Os testes de interface no simulador ficam só no `ci:ios`, antes do PR, com as capturas em
`ios/build/telas/`: dependem do springboard, de Face ID simulado e de uma DHT local, e levam ~6 min. Cada tela passa pela auditoria de acessibilidade do Xcode (rótulos, área de
toque, texto cortado, traços); contraste e tamanho do texto ficam com a captura em letra grande, porque
a auditoria reprova cores e vidro do próprio sistema.

```bash
npm run ci:ios
```

Mudanças visuais: `gh workflow run referencias-visuais.yml --ref <branch>` (capturas do Windows) e
depois, no Mac, `npm run visual:aceitar`, que baixa as do Windows, gera as do Mac na hora e as
copia para `desktop/docs/qualidade/visual`. Conferir o diff das imagens antes do commit.

## Custo do Actions

O repositório é privado: o Actions cobra por minuto, cada job arredondado para cima, e os 2.000
minutos grátis do mês descontam 1 por minuto de Linux, 2 de Windows e 10 de Mac. Estimativas:

| Execução                         | Minutos da cota | Fora da cota |
| -------------------------------- | --------------- | ------------ |
| CI (PR pronto)                   | ~3              | ~US$ 0,02    |
| Alpha (Windows)                  | ~28             | ~US$ 0,14    |
| Alpha (Windows + Mac arm64)      | ~130            | ~US$ 0,80    |
| Estável (Windows + Mac arm64)    | ~130            | ~US$ 0,80    |
| Windows manual                   | ~60             | ~US$ 0,30    |
| Referências visuais (só Windows) | ~20             | ~US$ 0,10    |

Os artefatos ficam 1 dia (3 no Windows manual): a release guarda os instaladores sem custo, e o
armazenamento de artefatos acima de 500 MB é pago.

## Alpha e estável

O workflow **Release** publica as versões. A versão é gravada só no build, então não há PR de
versão. O número em `desktop/package.json` (`0.0.1`, o Auri está em alpha) é a primeira estável a sair:
enquanto ela não existe, os alphas são `0.0.1-alpha.AAAAMMDD.N`; depois, da versão seguinte.
Até a 0.0.1 o canal alpha se chamava beta: as tags `-beta.` antigas contam como alpha, e quem
tinha escolhido o canal Beta passa para o Alpha sozinho.

- **Alpha**: todo dia às 02:17 (Cuiabá), se o app mudou no `main` desde o último alpha (conta
  o que muda em `desktop/` ou `.github/`; documentação, arquivos `.md` e o site não contam).
  Sai como `X.Y.(Z+1)-alpha.AAAAMMDD.N`, só para
  Windows, numa prerelease do GitHub. Também pode ser disparado à mão:
  `gh workflow run release.yml -f channel=alpha`; com `-f mac=true`, sai também para o Mac.
- **Estável**: manual. Promove o commit do último alpha como `X.Y.Z` (a base do alpha ou a versão
  pedida), para Windows e Mac (só Apple Silicon). Antes, rodar `npm run ci:mac` no Mac e o
  workflow Windows: `gh workflow run release.yml -f channel=stable [-f version=1.2.0]`.

Os arquivos de atualização (no site, ver abaixo) são remontados das releases a cada
publicação: `latest.yml` aponta para a última estável e `alpha.yml` para o alpha mais novo que
ela. Quem escolhe o canal Alpha em Configurações › Geral segue o `alpha.yml`. O Mac se atualiza
sozinho só quando a estável sai assinada com o Developer ID (abaixo); sem isso, instala-se pela
página do site. No alpha, o Mac fica na estável, a não ser no alpha disparado com `mac=true`: aí o `alpha-mac.yml`
aponta para ele.

## Site e atualização

A página de download é o projeto `web/` (React + Vite+). A **Vercel** a publica em `auri.dev.br` a
cada push no `main` (e faz uma prévia por PR, só quando o commit mexe no `web/`).

O repositório é público, e os instaladores ficam só nas **releases do GitHub**, sem limite de
download. No build, `web/scripts/prerender.mjs` lê as releases sem token: a última estável
(`/releases/latest`) e o alpha mais novo (`/releases.atom`). Ele grava em `dist/` o `latest.yml`,
o `alpha.yml` (do alpha, se for mais novo que a estável) e os `-mac.yml`, com `url` e `path`
apontando para a release no GitHub, além do `releases.json` usado para pré-renderizar a página
com a versão, os tamanhos e a data. As regras de escolha estão em `web/src/feed.ts`.

O Auri procura versões em `atualizacoes.auri.dev.br` (`publish.url` do
`desktop/electron-builder.yml`); as versões até 0.0.x, em `auri.dev.br`. Os dois domínios servem o
mesmo site, então os dois têm os `.yml`. O instalador e o `.blockmap` (atualização diferencial)
vêm direto do GitHub. O `web/vercel.json` ainda redireciona os nomes antigos dos instaladores
(`auri.dev.br/auri-<versão>-setup.exe`) para a release.

Depois de cada release, o job Atualização chama o Deploy Hook da Vercel (secret
`VERCEL_DEPLOY_HOOK`) para o site ler a versão nova. Para refazer o site sem release:
`gh workflow run release.yml -f channel=site`.

O banco do site (Neon) é migrado pelo workflow **Banco do site** (`banco.yml`) quando um push no
`main` mexe em `web/db/`, com o segredo `NEON_DONO_URL` do ambiente `producao` (só o `main`
recebe). Detalhes em `docs/relatorios-de-erro.md`, seção Migrações.

## Proteções do repositório

Configuradas no GitHub (não ficam em arquivo):

- PRs só de colaboradores (`pull_request_creation_policy`) e interações (issues, comentários)
  limitadas a colaboradores (vale 6 meses; renovar em Settings › Moderation options).
- Actions: workflows de fork só rodam com aprovação (todo colaborador externo), só actions do
  GitHub e fixadas por SHA, `GITHUB_TOKEN` só leitura por padrão.
- Varredura de segredos com bloqueio no push, alertas do Dependabot e relato privado de
  vulnerabilidade.
- `main`: PR obrigatório, check `Check` com a branch atualizada, conversas resolvidas, vale para
  administradores. Wiki e Projects desligados.

## Assinatura do Mac (Developer ID)

Com os segredos abaixo, o Release assina o Mac com o Developer ID, liga o hardened runtime e
notariza na Apple. Assim o macOS abre o Auri sem aviso e aceita que ele se troque pela versão
nova (o `.zip` do `latest-mac.yml`). Sem os segredos, o Mac sai com assinatura ad-hoc, como antes,
e o job avisa. O build local (`npm run build:mac`) e o teste manual continuam ad-hoc.

1. Entrar no Apple Developer Program (US$ 99/ano) com o Apple ID.
2. Em Xcode › Settings › Accounts › Manage Certificates (ou em developer.apple.com ›
   Certificates), criar um **Developer ID Application**. No Acesso às Chaves, exportar o
   certificado com a chave privada como `.p12`, com senha.
3. Em appleid.apple.com › Senhas de app, gerar uma **senha de app** para a notarização.
4. O **Team ID** (10 caracteres) está em developer.apple.com › Account › Membership.
5. Gravar os segredos no repositório:

```bash
base64 -i DeveloperID.p12 | gh secret set MAC_CERTIFICATE_P12
```

```bash
gh secret set MAC_CERTIFICATE_PASSWORD
```

```bash
gh secret set APPLE_ID
```

```bash
gh secret set APPLE_APP_SPECIFIC_PASSWORD
```

```bash
gh secret set APPLE_TEAM_ID
```

Cada `gh secret set` sem valor pede o valor no terminal, sem deixar no histórico. Na próxima
estável, o log do build do Mac mostra `signing` com o nome do certificado e
`notarization successful`. Conferir no `.app` baixado: `spctl -a -vv Auri.app` deve dizer
`source=Notarized Developer ID`.

Quem já tem o Auri ad-hoc instalado precisa instalar uma vez a versão assinada pelo `.dmg`; daí
em diante ela se atualiza sozinha. As chaves da conexão ficam no Keychain presas à assinatura, então
nessa troca o macOS pode pedir a senha do computador uma vez (ou a conexão ser pareada de novo).

## Dependências

O Dependabot abre PRs semanais (npm e Actions), que passam pelo mesmo CI.
