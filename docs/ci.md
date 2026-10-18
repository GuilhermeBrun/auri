# CI e releases

Modelo inspirado no T3 Code: o PR é validado rápido, o uso real vem do alpha e a estável promove
um alpha que já foi usado.

## Pull requests

O workflow **CI** roda num job só, o **Check**, uma vez por PR, em ~3 min numa máquina Ubuntu.
O Linux não faz parte do produto: é só a máquina mais barata do Actions para estas verificações.
Um job só porque cada job paga de novo checkout, Node e cache, e o Actions arredonda cada um para
o minuto inteiro.

| Passo         | O que confere                                                                            |
| ------------- | ---------------------------------------------------------------------------------------- |
| Lint          | `npm run check` (formato, lint e tipos) e `npm run knip` (código e dependências sem uso) |
| Build         | `npm run build` (electron-vite; os tipos já passaram no `npm run check`)                 |
| Test          | `npm test` (Vitest no Node do Electron)                                                  |
| Release Smoke | `node --test scripts/release/*.test.mjs` (versões e site de atualização)                 |

Os comandos rodam em `desktop/`, a pasta do app (o job define `working-directory: desktop`).

Os passos rodam mesmo depois de um erro, para o PR mostrar todos de uma vez. O `Check` é o único
check exigido pela proteção do `main`, que também exige o PR **atualizado com o `main`**: o que
entra é exatamente o que o CI testou, então não há outra execução no push no `main`. Se o `main`
andou desde o último CI do PR, o GitHub pede **Update branch**
(`gh pr update-branch --rebase`) e o CI roda de novo, com os dois juntos. Não há aprovação obrigatória: com o `Check` verde e o PR
atualizado, ele pode ser mesclado por squash ou rebase.

Os mesmos passos rodam na sua máquina antes de cada `git push` (`npm run ci:local`, pelo hook
`.githooks/pre-push`). Por isso o Actions não roda em **rascunho**: abra o PR como rascunho
enquanto ajusta (`gh pr create --draft`) e marque como pronto (`gh pr ready`) quando terminar. Um
rascunho não pode ser mesclado. Para o CI rodar só uma vez: um PR pronto de cada vez, mesclado
antes de marcar o próximo como pronto, e sem push depois de pronto.

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
  `gh workflow run release.yml -f channel=alpha`.
- **Estável**: manual. Promove o commit do último alpha como `X.Y.Z` (a base do alpha ou a versão
  pedida), para Windows e Mac (só Apple Silicon). Antes, rodar `npm run ci:mac` no Mac e o
  workflow Windows: `gh workflow run release.yml -f channel=stable [-f version=1.2.0]`.

O site de atualização (GitHub Pages, ver abaixo) é remontado das releases a
cada publicação: `latest.yml` aponta para a última estável e `alpha.yml` para o alpha mais novo que
ela. Quem escolhe o canal Alpha em Configurações › Geral segue o `alpha.yml`. O Mac se atualiza
sozinho só quando a estável sai assinada com o Developer ID (abaixo); sem isso, instala-se pela
página do site. No alpha, o Mac fica na estável (o alpha é só Windows).

## Site e atualização

A página de download é o projeto `web/` (React + Vite+). A **Vercel** a publica em `auri.dev.br` a
cada push no `main` (e faz uma prévia por PR). O build lê o `releases.json` publicado no Pages e
pré-renderiza a página com a versão, os tamanhos e a data.

O **GitHub Pages** (`atualizacoes.auri.dev.br`) guarda o que o Auri instalado usa: `latest.yml`,
`alpha.yml`, os instaladores e o `releases.json`, montados das releases pelo job Atualização (a
cada release, ou `gh workflow run release.yml -f channel=site`). O Pages também recebe uma cópia
da página. Na Vercel, `web/vercel.json` redireciona esses arquivos para o Pages, então o Auri que
procura em `auri.dev.br/` (as versões até 0.0.x) continua achando as versões novas; as seguintes
procuram direto em `atualizacoes.auri.dev.br` (`publish.url` do `desktop/electron-builder.yml`). Depois de publicar, o job chama o
Deploy Hook da Vercel (secret `VERCEL_DEPLOY_HOOK`) para a página mostrar a versão nova.

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
