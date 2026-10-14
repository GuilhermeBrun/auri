# Baseline do Auri e proposta de CI CD

Pesquisa em 14/10/2026. Escopo: leitura do checkout local de `/Users/guilherme/Developer/auri` e consulta de documentação primária. Não executei testes, builds, instalação de dependências, Electron, APIs do GitHub ou alterações de código/workflows. Os testes abaixo são **declarados nos arquivos**, e o workflow é **configuração existente**; esta pesquisa não confirmou uma execução recente ou seu resultado. Não encontrei `AGENTS.md` aplicável na raiz, nos ancestrais ou dentro do Auri. Os links locais usam arquivo e linha; os links externos foram consultados na data acima.

Referência do checkout observada por `git branch --show-current` e `git rev-parse HEAD`: branch `main`, commit `a04490a9fefb7ef6ac04ae2eafba9b9b2456b18a`. A escrita ficou restrita a esta nota; `git status --short` no fim mostrou somente `research_notes/` não rastreado, sem alteração em arquivos versionados.

## Qual é a estrutura real e quais controles existem hoje

### Takeaway

O Auri é um aplicativo desktop Electron/React/TypeScript com SQLite local e comunicação entre computadores; já existe automação de build e E2E em macOS e Windows. A principal lacuna inicial é que a automação só está ligada a execução manual e tags, não a cada PR ou alteração de `main`.

### Cited Findings

- A descrição e arquitetura são desktop para clínica, com dados locais SQLite. O código recente acrescentou backup em pasta sincronizada e modelo servidor/cliente entre computadores; não é uma implantação de site/API em nuvem. — [README, linhas 3–10](/Users/guilherme/Developer/auri/README.md:3); [design da conexão, linhas 7–24](/Users/guilherme/Developer/auri/docs/superpowers/specs/2026-10-13-conexao-entre-computadores-design.md:7); [design do backup, linhas 29–43](/Users/guilherme/Developer/auri/docs/superpowers/specs/2026-10-13-copia-de-seguranca-design.md:29).
- `package.json` tem Electron, `better-sqlite3`, Zod e dependências de rede no runtime; React, Tailwind, TypeScript, Vitest, ESLint, Prettier, `electron-vite` e `electron-builder` compõem o desenvolvimento. A entrada do aplicativo é `out/main/index.js`. — [package.json, linhas 5–66](/Users/guilherme/Developer/auri/package.json:5).
- As versões resolvidas no lockfile local são Electron 39.8.10, electron-builder 26.15.3, electron-vite 5.0.0, better-sqlite3 13.0.3, React 19.3.0, Vitest 5.0.3 e TypeScript 5.9.3. São fatos do checkout, não afirmações de que sejam as versões públicas mais recentes. O Vitest resolvido exige Node `^22.12.0 || ^24.0.0 || >=26.0.0`, e o electron-vite exige `^20.19.0 || >=22.12.0`. — [lockfile, better-sqlite3](/Users/guilherme/Developer/auri/package-lock.json:5659); [Electron](/Users/guilherme/Developer/auri/package-lock.json:6716); [builder](/Users/guilherme/Developer/auri/package-lock.json:6734); [electron-vite](/Users/guilherme/Developer/auri/package-lock.json:6874); [React](/Users/guilherme/Developer/auri/package-lock.json:10718); [TypeScript](/Users/guilherme/Developer/auri/package-lock.json:12232); [Vitest](/Users/guilherme/Developer/auri/package-lock.json:13065).
- `npm test` executa Vitest usando o Node embutido no Electron e `ELECTRON_RUN_AS_NODE=1`. O runner encaminha argumentos extras; não substituí-lo por `npx vitest run` sem verificar os binários nativos. A configuração atual inclui somente `src/**/*.test.ts` e ambiente `node`. — [runner de testes, linhas 1–11](/Users/guilherme/Developer/auri/scripts/run-tests.mjs:1); [vitest.config.ts](/Users/guilherme/Developer/auri/vitest.config.ts:3). A documentação do Electron explica as diferenças de ABI e a necessidade de compatibilidade de módulo/plataforma/arquitetura; também contempla pacotes com binários prontos. — [Electron: Native Node Modules](https://www.electronjs.org/docs/latest/tutorial/using-native-node-modules).
- A configuração do empacotamento local declara `npmRebuild: false`, explicando o uso de prebuilds Node-API; `postinstall` executa `electron-builder install-app-deps`. Portanto o desenho de CI deve **preservar e verificar o contrato atual**, não assumir que um rebuild manual sempre é necessário nem desabilitar indiscriminadamente o postinstall. — [electron-builder.yml, linhas 22–24](/Users/guilherme/Developer/auri/electron-builder.yml:22); [package.json, linha 17](/Users/guilherme/Developer/auri/package.json:17).

| Controle | Situação local | Evidência e limite |
| --- | --- | --- |
| TypeScript main/preload e renderer | Existente | `typecheck:node`, `typecheck:web`, `typecheck`; `build` inclui o typecheck. [package.json:10](/Users/guilherme/Developer/auri/package.json:10) |
| ESLint e regras de React Hooks | Existente, gate de CI ausente | Script `lint`; configuração recomendada de TS/React/Hooks. Não há passo `lint` no workflow. [package.json:9](/Users/guilherme/Developer/auri/package.json:9), [eslint.config.mjs:8](/Users/guilherme/Developer/auri/eslint.config.mjs:8), [build.yml:31](/Users/guilherme/Developer/auri/.github/workflows/build.yml:31) |
| Prettier | Parcial | Há `format` com `--write`, não um script imutável `format:check`. [package.json:8](/Users/guilherme/Developer/auri/package.json:8) |
| Testes de regras/SQLite/rede/backup | Existente | Foram encontrados 15 arquivos `.test.ts` em main/shared; configuração node. Nenhum teste de componente `.tsx` foi encontrado. Não medir quantidade de casos aprovados por contagem estática. [vitest.config.ts:5](/Users/guilherme/Developer/auri/vitest.config.ts:5), [patients.test.ts:20](/Users/guilherme/Developer/auri/src/main/db/patients.test.ts:20), [sync.test.ts:89](/Users/guilherme/Developer/auri/src/main/net/sync.test.ts:89), [backup.test.ts:50](/Users/guilherme/Developer/auri/src/main/backup/backup.test.ts:50) |
| Cobertura e limiares | Ausente na configuração | `vitest.config.ts` não tem `coverage`; package.json não declara pacote de cobertura ou script. O lockfile lista cobertura apenas entre peers opcionais do Vitest, o que não demonstra instalação. [vitest.config.ts:3](/Users/guilherme/Developer/auri/vitest.config.ts:3), [package.json:30](/Users/guilherme/Developer/auri/package.json:30), [package-lock.json:13102](/Users/guilherme/Developer/auri/package-lock.json:13102) |
| Build de Mac/Windows | Existente | Jobs com `npm ci`, `npm test` e `build:mac`/`build:win`, artefatos DMG/EXE. [build.yml:11](/Users/guilherme/Developer/auri/.github/workflows/build.yml:11) |
| E2E Electron aberto | Existente e parcial no escopo | Main/preload/renderer/IPC/banco/disco reais; diálogos nativos substituídos; foco backup/configurações. [e2e.mjs:35](/Users/guilherme/Developer/auri/scripts/e2e.mjs:35), [e2e.mjs:212](/Users/guilherme/Developer/auri/scripts/e2e.mjs:212), [e2e.mjs:234](/Users/guilherme/Developer/auri/scripts/e2e.mjs:234) |
| Smoke do aplicativo empacotado/instalação do Auri | Ausente na configuração examinada | E2E usa Electron de node_modules com `.`; não seleciona executável de `dist` ou instala NSIS/DMG. [e2e.mjs:17](/Users/guilherme/Developer/auri/scripts/e2e.mjs:17), [e2e.mjs:35](/Users/guilherme/Developer/auri/scripts/e2e.mjs:35) |
| Regressão visual | Parcial | E2E salva PNGs, mas não faz comparação de baseline/diff, nem reprova mudança visual. [e2e.mjs:100](/Users/guilherme/Developer/auri/scripts/e2e.mjs:100), [build.yml:70](/Users/guilherme/Developer/auri/.github/workflows/build.yml:70) |
| Gate em PR/main | Ausente no arquivo local | Só `workflow_dispatch` e tags `v*`; não há `pull_request` ou push de branch. [build.yml:5](/Users/guilherme/Developer/auri/.github/workflows/build.yml:5) |
| Análise de segurança/dependências/secrets/mutação | Ausente como job local | O único workflow encontrado é build/e2e; package.json não tem scripts desses controles. Configuração externa do GitHub continua desconhecida. [build.yml:10](/Users/guilherme/Developer/auri/.github/workflows/build.yml:10), [package.json:7](/Users/guilherme/Developer/auri/package.json:7) |
| Publicação/assinatura de release | Parcial | Artefatos são gerados com `--publish never`; Mac ad-hoc, `notarize: false`, `hardenedRuntime: false`; README informa ausência de certificados Apple/Microsoft. [package.json:19](/Users/guilherme/Developer/auri/package.json:19), [electron-builder.yml:35](/Users/guilherme/Developer/auri/electron-builder.yml:35), [README:42](/Users/guilherme/Developer/auri/README.md:42) |

### Inferences

- Uma primeira entrega pode usar os comandos existentes e ampliar o workflow, com pouco código novo: habilitar execução para PR/main e exigir sua aprovação antes de integrar. É uma proposta baseada na configuração acima, não um CI já ativado.
- Cobertura deve começar por medição real e por regras de risco. Aumentar automaticamente um percentual global sem exercitar renderer/preload/empacotamento não resolve as lacunas observadas.

### Gaps

- Não consultei configurações remotas de branch protection/rulesets, plano/visibilidade do GitHub, execuções recentes, custos, secrets ou runners. A URL de `origin` observada por `git remote -v` aponta para GitHub; isso não prova proteção de `main`.
- A presença e versão dos pacotes instalados em `node_modules`, e compatibilidade prática do coverage-v8 com o runner Electron desta versão, não foram verificadas por execução.

## Quais contratos e comportamentos precisam de regressão

### Takeaway

Os controles mais valiosos protegem os dados do paciente, impedem sessões sobrepostas e perda de alterações, preservam restauração e mantêm as barreiras entre renderer, preload, main e rede. As regras precisam ser expressas como invariantes independentes do código alterado pela IA.

### Cited Findings

- Cadastro valida nome, CPF, telefone, e-mail, datas e limites de texto; campos opcionais vazios e inativos já têm asserções. A busca sem acento/case também é testada. — [schemas.ts, linhas 6–45](/Users/guilherme/Developer/auri/src/shared/schemas.ts:6); [patients.test.ts, linhas 54–101](/Users/guilherme/Developer/auri/src/main/db/patients.test.ts:54).
- O SQLite ativa WAL e foreign keys. Há somente uma migration declarada, aplicação em transação, controle por `user_version` e recusa de banco mais novo. O teste de migration atual apenas abre banco vazio e compara a versão. — [connection.ts, linhas 7–16](/Users/guilherme/Developer/auri/src/main/db/connection.ts:7); [migrations.ts, linhas 9–70](/Users/guilherme/Developer/auri/src/main/db/migrations.ts:9); [patients.test.ts, linhas 16–23](/Users/guilherme/Developer/auri/src/main/db/patients.test.ts:16).
- Sobreposição usa `inicio < fim_proposto AND fim > inicio_proposto`, admitindo sessões adjacentes e ignorando a própria sessão na edição. Há asserções para conflitos, edição/exclusão, paciente inexistente e foreign key. — [appointments.ts, linhas 32–55](/Users/guilherme/Developer/auri/src/main/db/appointments.ts:32); [appointments.test.ts, linhas 64–142](/Users/guilherme/Developer/auri/src/main/db/appointments.test.ts:64).
- Agenda documenta 07:00–20:00. Essa limitação é aplicada no formulário, mas `appointmentInputSchema` verifica formato e término maior que início; `createAppointment`/`updateAppointment` verificam existência, concorrência e conflitos, sem chamar as funções do expediente. — [agenda.ts:1](/Users/guilherme/Developer/auri/src/shared/agenda.ts:1); [AppointmentDialog.tsx, linhas 38–58](/Users/guilherme/Developer/auri/src/renderer/src/components/AppointmentDialog.tsx:38); [schemas.ts, linhas 73–83](/Users/guilherme/Developer/auri/src/shared/schemas.ts:73); [appointments.ts, linhas 73–104](/Users/guilherme/Developer/auri/src/main/db/appointments.ts:73).
- O contrato usa datas de agendamento locais `AAAA-MM-DDTHH:mm`, enquanto timestamps do banco usam `Z`. Testes de idade/datas recebem uma data fixa e verificam parsing local. — [api.ts, linhas 20–26](/Users/guilherme/Developer/auri/src/shared/api.ts:20); [migrations.ts:3](/Users/guilherme/Developer/auri/src/main/db/migrations.ts:3); [dates.test.ts, linhas 16–70](/Users/guilherme/Developer/auri/src/shared/dates.test.ts:16).
- Operações locais e de rede compartilham validação no main; recusam operação desconhecida e emitem tópicos de mudança. Atualização recebe `updated_at` esperado; logs do caminho de dados evitam argumentos e nomes de pacientes. — [operations.ts, linhas 38–95](/Users/guilherme/Developer/auri/src/main/operations.ts:38); [operations.ts, linhas 114–131](/Users/guilherme/Developer/auri/src/main/operations.ts:114); [concurrency.ts](/Users/guilherme/Developer/auri/src/main/db/concurrency.ts:1).
- A janela usa `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`. O preload importa tipos de schemas, expõe APIs delimitadas e não importa Zod em runtime; `DEFAULT_UI_PREFS` documenta explicitamente essa limitação. Os handlers IPC examinados ignoram `_event`; não há validação visível de remetente nesse arquivo. — [main/index.ts, linhas 61–67](/Users/guilherme/Developer/auri/src/main/index.ts:61); [preload/index.ts, linhas 1–20](/Users/guilherme/Developer/auri/src/preload/index.ts:1); [preload/index.ts, linhas 106–112](/Users/guilherme/Developer/auri/src/preload/index.ts:106); [api.ts, linhas 55–59](/Users/guilherme/Developer/auri/src/shared/api.ts:55); [ipc.ts, linhas 9–18 e 37–40](/Users/guilherme/Developer/auri/src/main/ipc.ts:9). A documentação confirma que o `require` do preload em sandbox é restrito. — [Electron: Process Sandboxing](https://www.electronjs.org/docs/latest/tutorial/sandbox).
- Testes de rede declaram pareamento de uso único, expiração, código errado, computador não pareado, versão incompatível, conflito de edição, revogação, reconexão e identidade do servidor. TCP usa loopback/porta aleatória; a suite de acesso externo cria uma testnet DHT local, não comprova conectividade real entre redes/NATs. — [sync.test.ts, linhas 34–86](/Users/guilherme/Developer/auri/src/main/net/sync.test.ts:34); [sync.test.ts, linhas 100–116](/Users/guilherme/Developer/auri/src/main/net/sync.test.ts:100); [sync.test.ts, linhas 156–249](/Users/guilherme/Developer/auri/src/main/net/sync.test.ts:156); [remote.test.ts, linhas 29–65](/Users/guilherme/Developer/auri/src/main/net/remote.test.ts:29). A spec ainda declara falta de teste real no Windows e entre duas redes. — [design da conexão:3](/Users/guilherme/Developer/auri/docs/superpowers/specs/2026-10-13-conexao-entre-computadores-design.md:3).
- Backup tem asserções de roundtrip SQLite, dados não presentes em claro, senha/código inválidos, cabeçalho adulterado, retenção e versão futura. Restauração valida integridade e tabelas antes da troca; a troca elimina WAL/SHM antigos e reabre o banco. — [backup.test.ts, linhas 50–147](/Users/guilherme/Developer/auri/src/main/backup/backup.test.ts:50); [backup.ts, linhas 153–197](/Users/guilherme/Developer/auri/src/main/backup/backup.ts:153); [connection.ts, linhas 530–542](/Users/guilherme/Developer/auri/src/main/connection.ts:530).
- A implementação de salvar chave usa `safeStorage` quando disponível e fallback codificado quando não disponível. Isso deve ser reconhecido por um teste de política, pois rodar em CI não prova disponibilidade do cofre no ambiente distribuído. — [backup-service.ts, linhas 126–136](/Users/guilherme/Developer/auri/src/main/backup-service.ts:126).

### Inferences

Proposta de invariantes prioritárias, com evidência de implementação/contrato acima:

1. **Pacientes e agenda:** gravações inválidas não alteram SQLite; inativação preserva histórico; edição concorrente recusa sobrescrever; intervalo e busca preservam os casos de fronteira; sessões adjacentes continuam aceitas e sobreposições recusadas.
2. **Regra do expediente:** definir se 07:00–20:00 é regra do domínio ou somente da apresentação. Se for regra do domínio, exigir teste pela operação IPC e pela rede; o inventário mostra que somente o formulário a aplica hoje. Tratar como lacuna a confirmar, sem corrigi-la neste estudo.
3. **Migração:** fixture fictícia de cada versão publicada + upgrade preservando registros/IDs/FKs; reabertura idempotente; recusa de versão futura; falha em migration não avança `user_version`; migrations publicadas não podem ser reescritas pelo PR.
4. **Backup/restauração:** arquivos truncados e payload adulterado; banco inválido não substitui o atual; restauração e desfazer preservam dados; falha de disco mantém estado recuperável; chave/senha/pareamento não entram em exportação de configurações; comportamento explícito quando cofre indisponível.
5. **Fronteira Electron/rede:** janela abre com sandbox e APIs esperadas; não existe `require`/Node no renderer; origem de IPC não confiável é recusada; canal desconhecido/argumentos enormes são recusados; listeners cancelam corretamente; versão/identidade/revogação continuam bloqueando acesso.
6. **Tempo:** rodar casos de datas locais em UTC e America/Cuiaba, com testes de meia-noite, ano bissexto e transição de dia. Não converter automaticamente horário de clínica para UTC: isso contrariaria o contrato atual.

### Gaps

- Não existe evidência nesta pesquisa de regressão em todos os comportamentos acima, nem cobertura medida. Não classificar funcionamento de produção como validado por inspeção de fonte.
- O requisito do cofre indisponível, a política de sender IPC e a regra do expediente precisam de uma decisão de produto/segurança antes de congelar o comportamento esperado em novos testes.

## Como validar conteúdo e apresentação usando o que o projeto já define

### Takeaway

A fonte inicial para regressão de conteúdo é a identidade visual e as specs do próprio Auri. Existe uma divergência documental concreta que um fluxo de revisão deve impedir de voltar: o README ainda diz que não há backup automático.

### Cited Findings

- O README diz literalmente que não há backup automático e manda copiar `auri.db` com o app fechado; a spec atual descreve backup automático diário/a cada alteração/manual e o E2E cria, restaura e desfaz cópia cifrada. É uma divergência entre conteúdo e implementação, sem precisar de julgamento subjetivo por IA. — [README:12](/Users/guilherme/Developer/auri/README.md:12); [design backup, linhas 53–68](/Users/guilherme/Developer/auri/docs/superpowers/specs/2026-10-13-copia-de-seguranca-design.md:53); [e2e.mjs, linhas 242–285](/Users/guilherme/Developer/auri/scripts/e2e.mjs:242).
- A identidade define tokens claro/escuro, sidebar 216px, breadcrumb navegável, cabeçalho 48px, uso de espaços, ausência de verde decorativo/divisores e mensagens sobre próximos passos. — [identidade visual, linhas 3–18](/Users/guilherme/Developer/auri/docs/identidade-visual.md:3); [estrutura, linhas 44–50](/Users/guilherme/Developer/auri/docs/identidade-visual.md:44); [espaço, linha 73](/Users/guilherme/Developer/auri/docs/identidade-visual.md:73).
- Estados carregando/vazio/erro têm significados próprios; erro de gravação deve ficar inline; falha de leitura não deve prometer dados salvos; campos têm rótulos e mensagens; ações de cabeçalho têm nomes acessíveis. — [feedback:139](/Users/guilherme/Developer/auri/docs/identidade-visual.md:139); [componentes:173](/Users/guilherme/Developer/auri/docs/identidade-visual.md:173); [erro:181](/Users/guilherme/Developer/auri/docs/identidade-visual.md:181); [ações:168](/Users/guilherme/Developer/auri/docs/identidade-visual.md:168).
- A documentação especifica teclado dos campos de data/hora, movimento reduzido e contraste aumentado; ainda lista passagem com leitor de tela e tema escuro real no Windows como não realizados. Esses são limites explícitos do documento, mesmo havendo E2E de backup no Windows. — [identidade:175](/Users/guilherme/Developer/auri/docs/identidade-visual.md:175); [acessibilidade, linhas 204–212](/Users/guilherme/Developer/auri/docs/identidade-visual.md:204).

### Inferences

- Propor um catálogo pequeno de requisitos versionados com ID, comportamento esperado, risco, owner e testes relacionados; por exemplo `AGENDA-01` para sobreposição, `DADOS-02` para restauração, `CONTEUDO-03` para explicar a consequência antes de confirmar. O requisito pertence ao produto; a IA implementadora pode sugerir testes, mas não redefinir expectativa sozinha.
- Testar conteúdo sem congelar todo texto: exigir rótulo/ação, estado coerente com falha, ausência de placeholders e promessas falsas; snapshot de regiões/ARIA para estrutura significativa; comparação visual para layout/tema. Mudança editorial intencional passa por review humano do diff.
- Criar fixtures determinísticas de primeira abertura, lista vazia, busca sem resultado, paciente ativo/inativo, agenda com sessão curta/longa/conflitante, erro de leitura e perda de rede. Gerar screenshots em claro/escuro e tamanho de janela definido, com baseline separado por SO/arquitetura quando o render diferir.
- Nenhum snapshot ou baseline deve ser atualizado automaticamente pelo próprio job que constatou a divergência; a alteração precisa aparecer em PR revisável junto com a mudança do requisito quando aplicável.
- Corrigir README e definir revisão de documentação como primeira tarefa de conteúdo. Uma expressão regular para a frase obsoleta isoladamente seria teste frágil; o controle útil é conteúdo ligado ao contrato, walkthrough documentado e revisão das mudanças de feature.

### Gaps

- Não há catálogo de conteúdo centralizado, checker de texto/acessibilidade ou ferramenta de diff visual configurada no checkout examinado. A escolha da ferramenta de UI fica com a pesquisa adjacente.
- Não executei leitura por tecnologia assistiva, browser QA ou avaliação de contraste; são passos futuros, separados do inventário de fonte.

## Quais comandos funcionam como base e o que precisa ser acrescentado

### Takeaway

É possível iniciar o gate de código com scripts que já existem. Cobertura, formato em modo check, E2E ampliado e smoke empacotado exigem configuração/código adicional e validação antes de virar etapa obrigatória.

### Cited Findings

| Comando | Situação | Observação |
| --- | --- | --- |
| `npm ci` | Existente no workflow | Preserva lockfile, executa o postinstall configurado; não foi executado nesta pesquisa. [build.yml:31](/Users/guilherme/Developer/auri/.github/workflows/build.yml:31), [package.json:17](/Users/guilherme/Developer/auri/package.json:17) |
| `npm run lint -- --max-warnings=0` | Composição proposta sobre script existente | `lint` já chama ESLint; o argumento adicional transforma avisos em falha. Não foi testado aqui. [package.json:9](/Users/guilherme/Developer/auri/package.json:9) |
| `npm run typecheck` | Existente | Checa node e web. [package.json:10](/Users/guilherme/Developer/auri/package.json:10) |
| `npm test` | Existente | Vitest no runtime Electron. [package.json:13](/Users/guilherme/Developer/auri/package.json:13), [run-tests.mjs:6](/Users/guilherme/Developer/auri/scripts/run-tests.mjs:6) |
| `npm run build` | Existente | Inclui typecheck + bundles main/preload/renderer. Evitar duplicar typecheck sem finalidade. [package.json:16](/Users/guilherme/Developer/auri/package.json:16) |
| `node scripts/e2e.mjs e2e-saida` | Existente | Requer build prévio; inicializa Electron real e retorna erro se houver falha. [build.yml:64](/Users/guilherme/Developer/auri/.github/workflows/build.yml:64), [e2e.mjs:414](/Users/guilherme/Developer/auri/scripts/e2e.mjs:414) |
| `npm run build:unpack` | Existente | Build + `electron-builder --dir`; base possível para smoke do binário empacotado. [package.json:18](/Users/guilherme/Developer/auri/package.json:18) |
| `npm run build:mac` / `npm run build:win` | Existentes | Criam os artefatos sem publicar. [package.json:19](/Users/guilherme/Developer/auri/package.json:19) |
| `npm run format:check` | A criar | Proposta de script `prettier --check .`; o script atual escreve. [package.json:8](/Users/guilherme/Developer/auri/package.json:8) |
| `npm test -- --coverage` | Só após configuração | O runner encaminha argumentos, mas falta pacote de coverage instalado/configuração. [run-tests.mjs:8](/Users/guilherme/Developer/auri/scripts/run-tests.mjs:8), [vitest.config.ts](/Users/guilherme/Developer/auri/vitest.config.ts:3) |
| `npm run test:e2e`, `test:packaged`, `test:content` | A criar | Não há scripts desse nome no package.json atual. [package.json:7](/Users/guilherme/Developer/auri/package.json:7) |

- `npm ci` falha quando manifest e lock divergem, não altera os manifests e é voltado a instalações limpas automatizadas. — [npm: npm ci](https://docs.npmjs.com/cli/v11/commands/npm-ci/).
- Vitest oferece coverage-v8/istanbul opcionais, flag `--coverage` e inclusão explícita de arquivos sem testes para não esconder módulos nunca importados. — [Vitest: Coverage](https://vitest.dev/guide/coverage.html). A versão deve ser compatível com o Vitest resolvido; testar o provider pelo runner Electron do Auri antes de bloquear PR.
- O E2E atual abre `electron` de node_modules usando `.` com `--inspect`, `--remote-debugging-port` e `--user-data-dir` temporário. Paciente e sessão fictícios são criados diretamente por `window.api`, o que exercita IPC/banco, mas não comprova preenchimento e validação dos formulários pelo usuário. Os diálogos de abrir/salvar são substituídos no main. — [e2e.mjs, linhas 17–43](/Users/guilherme/Developer/auri/scripts/e2e.mjs:17); [e2e.mjs, linhas 212–231](/Users/guilherme/Developer/auri/scripts/e2e.mjs:212).
- O E2E não testa o instalador do Auri. A opção `AURI_E2E_INSTALAR` instala apps de nuvem, e o workflow a ativa somente no Windows. `AURI_TESTA_INSTALADORES=1` ativa download/verificação de assinaturas de Google Drive/OneDrive na suite Windows. — [build.yml:33](/Users/guilherme/Developer/auri/.github/workflows/build.yml:33); [build.yml:66](/Users/guilherme/Developer/auri/.github/workflows/build.yml:66); [e2e.mjs:326](/Users/guilherme/Developer/auri/scripts/e2e.mjs:326); [installer.test.ts, linhas 51–89](/Users/guilherme/Developer/auri/src/main/backup/installer.test.ts:51).
- Electron documenta automação do aplicativo real, incluindo Playwright com suporte experimental a Electron e escolha de binário empacotado nas ferramentas compatíveis. Isso sustenta acrescentar smoke do pacote, sem obrigar reescrever o E2E atual na primeira fase. — [Electron: Automated Testing](https://www.electronjs.org/docs/latest/tutorial/automated-testing).

### Inferences

Proposta de árvore, preservando o workflow de release atual e o runner de testes:

```text
.github/workflows/
  quality.yml              # PR/main: gates de código, regras, Electron e conteúdo
  build.yml                # existente: separar geração/release de integração externa longa
  scheduled-quality.yml    # testes mais caros: cloud installers, mutação, matriz estendida
.github/CODEOWNERS          # revisão das fronteiras de dados, testes e CI
docs/
  qualidade-e-regressao.md  # política de gates e exceções com prazo
  contratos-do-produto.md   # invariantes de código, dados e conteúdo
scripts/
  run-tests.mjs            # existente; manter runtime Electron
  e2e.mjs                  # existente; manter modo rápido sem instaladores externos
  smoke-packaged.mjs       # novo: parametrizar executável e afirmar app.isPackaged
  check-quality-policy.mjs # novo: regras estruturais pontuais, sem tentar interpretar todo diff
tests/
  fixtures/sqlite/          # versões publicadas e dados fictícios
  e2e/                     # fluxos reais de paciente/agenda/restauração/rede
  visual/                  # baseline/diffs por ambiente controlado
```

Essa árvore é **proposta**, não implementação. Os nomes de scripts novos não devem ser apresentados como comandos já disponíveis. A cobertura deve declarar `include` de código de produção, exclusões justificadas e relatórios; primeiro coletar baseline, depois bloquear regressão em código modificado e estabelecer limiares por domínio. Não fazer uma porcentagem inventada parecer medida.

### Gaps

- Nenhum comando acima foi executado nesta pesquisa. Versões de Node dos runners devem ser fixadas/validadas respeitando o mínimo real do lockfile; manter apenas `node-version: 22` permite deriva de patch.
- O isolamento de `userData` está declarado pelos argumentos do E2E, mas falta nesta pesquisa uma asserção executada de que `app.getPath('userData')` coincide com a pasta temporária. Acrescentar essa asserção antes de operações destrutivas é recomendável; a API oficial permite controlar paths no main. — [Electron: app.setPath](https://www.electronjs.org/docs/latest/api/app#appsetpathname-path).

## Como distribuir as validações entre PR main agendamento e release

### Takeaway

Separar feedback rápido de PR, validação completa de integração e entrega do aplicativo. Reaproveitar a matriz Windows/macOS existente, retirar instaladores externos da barreira rápida e testar o artefato que será entregue.

### Cited Findings

- O workflow atual tem matriz Windows/macOS no job de build e no E2E, com `fail-fast: false`. Build gera EXE Windows x64 e DMGs Mac arm64/x64; o E2E roda somente a arquitetura do host, pois usa o Electron instalado. — [build.yml, linhas 11–22 e 48–53](/Users/guilherme/Developer/auri/.github/workflows/build.yml:11); [electron-builder.yml, linhas 25–47](/Users/guilherme/Developer/auri/electron-builder.yml:25); [e2e.mjs:18](/Users/guilherme/Developer/auri/scripts/e2e.mjs:18).
- Não há `needs` entre build e E2E atualmente. São jobs independentes; geração do instalador e aprovação do E2E não compõem uma etapa de publicação. — [build.yml, linhas 10–74](/Users/guilherme/Developer/auri/.github/workflows/build.yml:10).
- O guia oficial recomenda assinatura de apps distribuídos e descreve certificados/notarização de Mac e assinatura Windows. A configuração local ainda não entrega esse estágio. — [Electron: Code Signing](https://www.electronjs.org/docs/latest/tutorial/code-signing); [electron-builder.yml:38](/Users/guilherme/Developer/auri/electron-builder.yml:38).

### Inferences

Tabela abaixo é uma proposta baseada no baseline; duração/custo de execução **não foi medido**:

| Evento | Jobs propostos e resultado obrigatório | Custo relativo e motivo |
| --- | --- | --- |
| Todo PR | Formato check, lint sem avisos, typecheck/build, testes de invariantes; Electron E2E rápido Windows/macOS sem download/instalação de nuvens; resumo final `quality` obrigatório | Baixo a médio: reaproveita infraestrutura; os dois SOs custam mais que um job, mas protegem produto distribuído nos dois |
| Push em `main` | Reexecutar o conjunto no commit integrado; build unpacked e smoke `app.isPackaged`; relatórios de cobertura, conteúdo e visual | Médio: pega conflitos de integração e problemas de pacote que não aparecem em `out` |
| Agenda diária/semanal | Testes de instaladores externos em máquinas descartáveis, matriz de TZ/arquitetura, suite estendida de rede, mutação direcionada, varredura de dependências | Alto/variável: downloads ~centenas de MB, serviços externos e automação nativa tornam a etapa lenta/instável |
| Tag/release protegida | Verificar ancestral de `main` aprovada e versão; gates completos; gerar instaladores; smoke do binário exato e instalação/upgrade com fixtures fictícias; assinatura/notarização e publicação separadas | Alto e ocasional: entrega e instalação exigem evidência diferente de unit tests |

Sugestão mínima de estrutura lógica para **novo** `quality.yml`, antes de ferramentas adicionais:

```yaml
# Esboço de proposta, não um workflow instalado ou validado.
name: Quality
on:
  pull_request:
  push:
    branches: [main]
  workflow_dispatch:
permissions:
  contents: read
concurrency:
  group: quality-${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true
jobs:
  checks:
    strategy:
      fail-fast: false
      matrix:
        os: [windows-latest, macos-latest]
    runs-on: ${{ matrix.os }}
    timeout-minutes: 20
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npm run lint -- --max-warnings=0
      - run: npm test
      - run: npm run build
      - run: node scripts/e2e.mjs e2e-saida
      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: evidence-${{ matrix.os }}
          path: e2e-saida
          retention-days: 7
```

O esboço usa comandos e action refs que já aparecem no projeto, para deixar clara a adaptação mínima. Antes de efetivá-lo, fixar actions por SHA verificado e fixar versão de Node/OS conforme política, adicionar `format:check` após criar o script, testar permissões/relatórios e criar o status final obrigatório. Limite de 20 minutos e retenção de 7 dias são parâmetros iniciais sugeridos, não métricas observadas. Não passar `AURI_TESTA_INSTALADORES`/`AURI_E2E_INSTALAR` no PR. O job pode rodar código não confiável; não deve receber certificados, tokens de publicação ou segredos de produção.

Detalhes de implementação que importam:

- **Branch protection:** exigir status final e revisão, inclusive de CI/testes/fixtures/contratos. Sem configurar a exigência no host, um workflow vermelho pode ser ignorado. Não usar somente paths filters nos gates exigidos sem um agregador que represente corretamente todos os jobs.
- **Same artifact:** o smoke de release deve abrir o aplicativo gerado pela mesma execução que será publicado, não fazer um novo build após assinar/aprovar. Registrar commit, versão, hashes, plataforma/arquitetura e resultados junto com os artefatos.
- **Native/ABI:** manter `npm test` via Electron; cache de download npm, sem mover node_modules entre SO/arquiteturas. `build:mac` declarar dois artefatos não demonstra que ambos executaram. Escolher runners por arquitetura realmente suportada pelo projeto e comprovar execução de cada alvo antes da entrega.
- **E2E rápido:** primeiro estender o script existente para interações de paciente/agenda via UI, validação inline, foco/teclado, tema, primeira abertura e persistência após reabrir. Capturar erros do renderer/preload/main e travamentos como falha; substituir sleeps fixos por espera de estado quando possível. Uma suite nova pode vir depois, se a manutenção justificar.
- **Fixtures/disco:** usar somente dados fictícios, criar userData temporário, confirmar path efetivo antes da primeira escrita e impedir teste contra pasta real. Simular pasta sincronizada no gate; a gravação local não comprova upload pela nuvem. A instalação externa permanece em runner descartável.
- **Datas/UI:** fixtures com relógio/datas controlados, TZ explicitado e fonte/layout esperados; testar horário local separadamente de timestamps UTC. Baselines visuais independentes de OS/arquitetura e revisão humana para sua atualização.
- **Execução agendada:** falha de serviço externo deve ser distinguida de regressão do Auri, mas registrada. Ela pode bloquear uma release relevante após triagem; não deve transformar indisponibilidade externa eventual em falso sucesso de testes.
- **CD desktop:** gates pós-merge antecedem empacotamento/distribuição. Assinatura/publicação são jobs de release autorizada com acesso restrito; dependem de certificados, conta/notarização e estratégia de atualização ainda não definidos neste checkout.

Prioridade e esforço sugeridos, apenas estimativa de planejamento:

1. **P0, pequeno, aproximadamente 1–2 dias de engenharia:** ligar PR/main com comandos existentes, formato check, status exigido e política de revisão; corrigir conteúdo obsoleto; preservar relatórios. Validar de fato em ambos os SOs antes de exigir o gate.
2. **P1, médio, aproximadamente 3–5 dias:** invariantes IPC/rede/dados, fixtures de migração/restauração, medição de cobertura e E2E de paciente/agenda/reabertura com relógio controlado.
3. **P2, médio/alto, aproximadamente 3–7 dias:** baseline visual/conteúdo/acessibilidade, smoke do binário empacotado e upgrade/instalação dos alvos distribuídos; otimizar confiabilidade de automação.
4. **P3, contínuo:** mutação direcionada, limites de performance, vulnerabilidades e testes externos agendados; assinatura/notarização/publicação conforme requisitos e orçamento. Valores monetários e prazo de certificados não foram pesquisados.

### Gaps

- Custos de runners, minutos de execução, flakiness e orçamento de manutenção precisam de uma semana ou mais de medições do pipeline proposto; não há números locais nesta pesquisa.
- Não foi comprovado suporte/arquitetura do `macos-latest` em execuções remotas, instalação/upgrade real de NSIS/DMG, notarização, publicação, rollback por versão do instalador ou auto-update. São pré-requisitos explícitos da etapa de entrega, não recursos já presentes.
- Não há decisão registrada sobre release gradual/auto-update e política de versão. Para um desktop com SQLite local, rollback do executável não pode ser presumido seguro se a versão antiga não abre o schema novo; a recusa de `user_version` futura já demonstra essa restrição.
