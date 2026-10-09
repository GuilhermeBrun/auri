# Auri

Cadastro de pacientes e agenda para clínica de fonoaudiologia. App desktop para Mac e Windows (Electron + React), com os dados guardados localmente em SQLite.

## Onde ficam os dados

Arquivo `auri.db`, na pasta de dados do app:

- **macOS:** `~/Library/Application Support/Auri/auri.db`
- **Windows:** `%APPDATA%\Auri\auri.db`

Por enquanto não há backup automático. Para não perder dados, copie esse arquivo com o app fechado.

## Desenvolvimento

```bash
npm install        # também recompila o better-sqlite3 para o Electron
npm run dev        # recarrega as telas e reinicia o app ao alterar main/preload
npm test           # testes (rodam no Node do Electron por causa do better-sqlite3)
npm run typecheck
npm run lint
```

Estrutura:

- `src/shared/`: validações (zod), CPF, máscaras e datas, usadas pelas telas e pelo processo main.
- `src/main/db/`: SQLite. As migrations ficam em `migrations.ts`: para mudar o banco, acrescente uma nova no final em vez de editar as existentes.
- `src/main/ipc.ts`: canais IPC. Toda entrada é validada aqui.
- `src/preload/`: expõe `window.api`. O contrato fica em `src/shared/api.ts`.
- `src/renderer/`: telas (React + Tailwind).
- `docs/identidade-visual.md`: identidade visual (cores, tipografia, componentes). Toda tela nova deve segui-la.

## Instaladores

```bash
npm run build:mac   # dist/auri-<versão>-arm64.dmg (Apple Silicon) e -x64.dmg (Intel)
npm run build:win   # dist/auri-<versão>-setup.exe (pode ser gerado no próprio Mac)
```

O better-sqlite3 já traz binários prontos para cada sistema, então os dois instaladores saem do Mac. O workflow `.github/workflows/build.yml` faz o mesmo no GitHub Actions e roda os testes também no Windows. Ele pode ser disparado manualmente ou ao criar uma tag `v*`.

O app tem só assinatura ad-hoc: não há certificado da Apple nem da Microsoft.

- **No Mac:** na primeira vez o macOS bloqueia a abertura. Vá em Ajustes do Sistema → Privacidade e Segurança → "Abrir mesmo assim".
- **No Windows:** o SmartScreen pede "Mais informações → Executar assim mesmo".
