# Auri

Prontuário, agenda e gestão para clínica de fonoaudiologia. App desktop para Mac e Windows (Electron + React), com os dados guardados localmente em SQLite, e o site [auri.dev.br](https://auri.dev.br).

## Onde ficam os dados

Arquivo `auri.db`, na pasta de dados do app:

- **macOS:** `~/Library/Application Support/Auri/auri.db`
- **Windows:** `%APPDATA%\Auri\auri.db`

Em **Configurações → Armazenamento → Cópia de segurança**, configure cópias cifradas em uma pasta local,
pendrive ou pasta sincronizada com a nuvem. A cópia pode ser diária, após alterações ou
manual; guarde a senha e o código de recuperação. O Auri precisa estar aberto para executar
as cópias automáticas. Apenas o computador que guarda os dados realiza essas cópias.

Para copiar o arquivo `auri.db` diretamente, feche o app antes. O CI, os testes no Windows e
as versões alpha e estável estão em [docs/ci.md](docs/ci.md).

## Projetos

O repositório tem um projeto por pasta, cada um com o próprio `package.json` e
`package-lock.json` (sem npm workspaces: o electron-builder precisa do `node_modules` ao lado
do app).

- `desktop/`: o app (Electron + React + SQLite) e os scripts de release.
- `web/`: o site [auri.dev.br](https://auri.dev.br) (React + Vite+, pré-renderizado): página de
  download, feed de atualização, as páginas que a família abre pelo celular (`/assinar`,
  `/recebido`, `/confirmar`, `/resposta`) e as funções `api/erros.ts` (relatórios de erro) e
  `api/links.ts` (links curtos). Publicado pela Vercel; os instaladores ficam nas releases do
  GitHub (ver [docs/ci.md](docs/ci.md)).
- `ios/`: o app do iPhone (SwiftUI), em construção. A rede roda no runtime Bare com o mesmo código
  de conexão do desktop (`desktop/src/main/net/`). Desenho em
  [docs/specs/2026-10-21-app-ios-design.md](docs/specs/2026-10-21-app-ios-design.md).
- `docs/`: documentação para quem desenvolve (pessoas e agentes): [CI e releases](docs/ci.md),
  [identidade visual](docs/identidade-visual.md), [relatórios de erro](docs/relatorios-de-erro.md),
  [links curtos](docs/links-curtos.md) e, em `docs/specs/`, o desenho de cada funcionalidade maior.

## Desenvolvimento

### Site (`web/`)

```bash
cd web
npm install
npm run dev             # página com releases de exemplo (releases.exemplo.json)
npm run check           # Vite+: formato, lint e tipos
npm test
npm run build:exemplo   # build pré-renderizado com as releases de exemplo
```

O `npm run build` lê as releases publicadas no GitHub e grava em `dist/` o feed de atualização
(`latest.yml`, `alpha.yml`…) e o `releases.json`; `AURI_RELEASES` aceita um arquivo ou url no lugar.

### iPhone (`ios/`)

Precisa do Xcode e do XcodeGen (`brew install xcodegen`).

```bash
cd ios
npm install
npm run preparar   # empacota o worklet, liga os addons nativos, baixa o BareKit e gera o Auri.xcodeproj
npm run servidor   # computador de teste: as operações do desktop num banco em memória com pacientes e sessões fictícios; mostra o QR code (e grava build/qrcode.png) e o convite em texto
npm run teste -- '<convite>' internet   # o cliente do iPhone no runtime Bare, sem o app
```

Depois do `preparar`, abrir `ios/Auri.xcodeproj` no Xcode ou rodar
`xcodebuild -project ios/Auri.xcodeproj -scheme Auri -sdk iphonesimulator build`. Rodar o `preparar`
de novo quando mudar o worklet ou o código de conexão do desktop.

O simulador não tem câmera. No teste de interface, o app em Debug recebe o convite pela variável
`AURI_QR` no lugar da leitura: com o `npm run servidor` aberto (o QR vale uma vez, por 5 minutos), ele
passa pelas boas-vindas, pareia e lista os pacientes, e guarda as capturas das telas no resultado.

```bash
cd ios
./scripts/telas.sh   # sobe o servidor de teste, roda o teste e grava as capturas em build/telas/
```

O `npm run servidor` usa o Electron e o `better-sqlite3` do `desktop/` (rodar `npm install` lá antes).

### App (`desktop/`)

Os comandos abaixo rodam dentro de `desktop/`.

```bash
cd desktop
npm install        # também recompila o better-sqlite3 para o Electron
npm run dev        # recarrega as telas e reinicia o app ao alterar main/preload
npm test           # testes (rodam no Node do Electron por causa do better-sqlite3)
npm run typecheck  # só os tipos (vp check sem formato e lint)
npm run lint
npm run check      # Vite+: formato, lint e análise de tipos
npm run knip       # código e dependências sem uso
npm run test:e2e   # o Auri aberto de verdade (depois de npm run build)
```

Estrutura (em `desktop/`):

- `src/shared/`: validações (zod), CPF, máscaras e datas, usadas pelas telas e pelo processo main.
- `src/main/db/`: SQLite. As migrations ficam em `migrations.ts`: para mudar o banco, acrescente uma nova no final em vez de editar as existentes.
- `src/main/ipc.ts`: canais IPC. Toda entrada é validada aqui.
- `src/preload/`: expõe `window.api`. O contrato fica em `src/shared/api.ts`.
- `src/renderer/`: telas (React + Tailwind).
- `docs/qualidade/`: banco de exemplo dos testes e capturas de referência da interface.
- `scripts/release/`: versões do alpha e da estável e tradução da pilha dos relatórios de erro.
- `vite.config.ts`: configuração única do build Electron, testes, lint e formatação com Vite+.

A identidade visual (cores, tipografia, componentes) está em
[docs/identidade-visual.md](docs/identidade-visual.md). Toda tela nova deve segui-la.

## Antes de abrir um PR

O CI do GitHub roda só quando o PR sai do rascunho e confere formato, lint, tipos, build e
testes do app e do site (o job `Check`). O resto é testado aqui, no Mac, antes do PR:

1. **Sempre:** `npm run ci:local` (em `desktop/`), os mesmos passos do `Check`, inclusive os do
   site. Também roda sozinho antes de cada `git push`, com o cache do Vite+ nos passos que não
   mudaram.
2. **Conforme o que mudou:**

| Mudou                                                              | Rodar                                                  |
| ------------------------------------------------------------------ | ------------------------------------------------------ |
| Telas, estilos ou textos                                           | `npm run build && npm run test:ui`                     |
| Uma tela mudou de propósito (a comparação de imagens reprova)      | `npm run visual:aceitar` e conferir o diff das imagens |
| Processo main, IPC, banco, cópia de segurança, conexão, importação | `npm run build && npm run test:e2e`                    |
| Empacotamento, `electron-builder.yml`, atualização, dependências   | `npm run ci:mac`                                       |
| Algo só do Windows (caminhos, instaladores das nuvens, instalador) | `gh workflow run windows.yml --ref <branch>`           |

O `npm run ci:mac` cobre todas as linhas do Mac de uma vez e também roda antes de cada versão
estável.

3. **Abrir o PR como rascunho** (`gh pr create --draft`) e marcar como pronto (`gh pr ready`) só
   quando terminar. Como o CI e a revisão funcionam depois disso está em [docs/ci.md](docs/ci.md).

## Instaladores

```bash
cd desktop
npm run build:mac   # dist/auri-<versão>-arm64.dmg (só Apple Silicon)
npm run build:win   # dist/auri-<versão>-setup.exe (pode ser gerado no próprio Mac)
```

O better-sqlite3 já traz binários prontos para cada sistema, então os dois instaladores saem do Mac. As versões publicadas saem do workflow Release; ver [docs/ci.md](docs/ci.md).

O app tem só assinatura ad-hoc: não há certificado da Apple nem da Microsoft.

- **No Mac:** na primeira vez o macOS bloqueia a abertura. Vá em Ajustes do Sistema → Privacidade e Segurança → "Abrir mesmo assim".
- **No Windows:** o SmartScreen pede "Mais informações → Executar assim mesmo".

## Licença

[PolyForm Noncommercial 1.0.0](LICENSE.md): o código pode ser lido, usado e modificado para fins
não comerciais. Uso comercial só com autorização do autor.
