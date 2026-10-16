# CI e releases

Modelo inspirado no T3 Code: o PR é validado rápido, o uso real vem do beta e a estável promove
um beta que já foi usado.

## Pull requests

O workflow **CI** roda em cada PR e push no `main`, em ~2 min, numa máquina Ubuntu. O Linux não
faz parte do produto: é só a máquina mais rápida e barata do Actions para estas verificações.

| Job           | O que confere                                                                            |
| ------------- | ---------------------------------------------------------------------------------------- |
| Lint          | `npm run check` (formato, lint e tipos) e `npm run knip` (código e dependências sem uso) |
| Build         | `npm run build` (typecheck e electron-vite)                                              |
| Test          | `npm test` (Vitest no Node do Electron)                                                  |
| Release Smoke | `node --test scripts/release/*.test.mjs` (versões e site de atualização)                 |
| **Check**     | Passa só se todos os outros passarem. É o único check exigido pela proteção do `main`    |

Não há aprovação obrigatória: com o `Check` verde o PR pode ser mesclado por squash ou rebase.

## Windows e Mac (manual)

O workflow **Windows** abre o Auri de verdade (E2E), testa a interface, o pacote, o instalador e os
instaladores oficiais das nuvens. Não roda sozinho:

```bash
gh workflow run windows.yml --ref <branch>
gh workflow run windows.yml --ref <branch> -f macos=true
```

Mudanças visuais: `gh workflow run referencias-visuais.yml --ref <branch>` e depois
`npm run visual:aceitar`, conferindo o diff das imagens antes do commit.

## Beta e estável

O workflow **Release** publica as versões. A versão é gravada só no build, então não há PR de
versão. O número em `package.json` serve só de ponto de partida antes da primeira estável.

- **Beta**: todo dia às 02:17 (Cuiabá), se o `main` mudou desde o último beta. Sai como
  `X.Y.(Z+1)-beta.AAAAMMDD.N`, só para Windows, numa prerelease do GitHub. Também pode ser
  disparado à mão: `gh workflow run release.yml -f channel=beta`.
- **Estável**: manual. Promove o commit do último beta como `X.Y.Z` (a base do beta ou a versão
  pedida), para Windows e Mac: `gh workflow run release.yml -f channel=stable [-f version=1.2.0]`.

O site de atualização (GitHub Pages, `guilhermebrun.github.io/auri`) é remontado das releases a
cada publicação: `latest.yml` aponta para a última estável e `beta.yml` para o beta mais novo que
ela. Quem escolhe o canal Beta em Configurações › Geral segue o `beta.yml`. O Mac se atualiza
sozinho só quando a estável sai assinada com o Developer ID (abaixo); sem isso, instala-se pela
página do site. No beta, o Mac fica na estável (o beta é só Windows).

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
