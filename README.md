# Auri

Cadastro de pacientes e agenda para clínica de fonoaudiologia. App desktop para Mac e Windows (Electron + React), com os dados guardados localmente em SQLite.

## Onde ficam os dados

Arquivo `auri.db`, na pasta de dados do app:

- **macOS:** `~/Library/Application Support/Auri/auri.db`
- **Windows:** `%APPDATA%\Auri\auri.db`

Em **Configurações → Cópia de segurança**, configure cópias cifradas em uma pasta local,
pendrive ou pasta sincronizada com a nuvem. A cópia pode ser diária, após alterações ou
manual; guarde a senha e o código de recuperação. O Auri precisa estar aberto para executar
as cópias automáticas. Apenas o computador que guarda os dados realiza essas cópias.

Para copiar o arquivo `auri.db` diretamente, feche o app antes. O CI, os testes no Windows e
as versões beta e estável estão em [docs/ci.md](docs/ci.md).

## Desenvolvimento

```bash
npm install        # também recompila o better-sqlite3 para o Electron
npm run dev        # recarrega as telas e reinicia o app ao alterar main/preload
npm test           # testes (rodam no Node do Electron por causa do better-sqlite3)
npm run typecheck
npm run lint
npm run check      # Vite+: formato, lint e análise de tipos
npm run knip       # código e dependências sem uso
npm run test:e2e   # o Auri aberto de verdade (depois de npm run build)
```

Estrutura:

- `src/shared/`: validações (zod), CPF, máscaras e datas, usadas pelas telas e pelo processo main.
- `src/main/db/`: SQLite. As migrations ficam em `migrations.ts`: para mudar o banco, acrescente uma nova no final em vez de editar as existentes.
- `src/main/ipc.ts`: canais IPC. Toda entrada é validada aqui.
- `src/preload/`: expõe `window.api`. O contrato fica em `src/shared/api.ts`.
- `src/renderer/`: telas (React + Tailwind).
- `docs/identidade-visual.md`: identidade visual (cores, tipografia, componentes). Toda tela nova deve segui-la.
- `vite.config.ts`: configuração única do build Electron, testes, lint e formatação com Vite+.

## Instaladores

```bash
npm run build:mac   # dist/auri-<versão>-arm64.dmg (Apple Silicon) e -x64.dmg (Intel)
npm run build:win   # dist/auri-<versão>-setup.exe (pode ser gerado no próprio Mac)
```

O better-sqlite3 já traz binários prontos para cada sistema, então os dois instaladores saem do Mac. As versões publicadas saem do workflow Release (beta diário e estável manual) e os instaladores são testados no Windows pelo workflow Windows; ver [docs/ci.md](docs/ci.md).

O app tem só assinatura ad-hoc: não há certificado da Apple nem da Microsoft.

- **No Mac:** na primeira vez o macOS bloqueia a abertura. Vá em Ajustes do Sistema → Privacidade e Segurança → "Abrir mesmo assim".
- **No Windows:** o SmartScreen pede "Mais informações → Executar assim mesmo".
