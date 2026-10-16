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
ela. Quem liga "Receber versões beta" em Configurações → Atualizações segue o `beta.yml`. A
atualização automática é só no Windows: no Mac, sem assinatura, instala-se pela página do site.

## Dependências

O Dependabot abre PRs semanais (npm e Actions), que passam pelo mesmo CI.
