# Regressão de comportamento e conteúdo do Auri

Pesquisa realizada em 14/10/2026. Foram lidos fontes e documentação, sem executar testes, abrir o aplicativo, acessar bancos pessoais, instalar ferramentas ou alterar a implementação. Os resultados esperados abaixo são uma proposta para aprovação, e não resultados empíricos. Os links locais apontam para a evidência inspecionada no checkout atual.

## O que proteger como conteúdo e contrato de produto

### Takeaway

“Conteúdo” deve abranger as informações e ações que o usuário vê, sua fidelidade aos dados persistidos, mensagens e documentação de uso, além da apresentação. Para proteger mudanças feitas com IA, o resultado esperado precisa vir de exemplos de aceitação aprovados, separados do código e dos textos que a mesma alteração pode modificar.

### Cited Findings

- Testing Library orienta testar componentes pela interação com seus elementos DOM e pelo uso que a pessoa faz da aplicação, evitando depender de instâncias e detalhes internos. — [Testing Library: princípios](https://testing-library.com/docs/guiding-principles/).
- O Auri documenta ações com verbos, resumo antes de confirmar, e diferencia primeiro uso de busca sem resultados. Sua identidade atual inclui grafite, superfícies sólidas, fonte Bricolage Grotesque, tokens compartilhados e temas claro/escuro. — [Identidade visual](/Users/guilherme/Developer/auri/docs/identidade-visual.md:3).
- A busca atual ignora acentos e caixa, pesquisa nome do paciente, nome da mãe e dígitos de CPF. A listagem esconde inativos por padrão; há testes escritos para criação, edição, busca, inativação e validações em SQLite real em memória. Não foram executados nesta pesquisa. — [Busca](/Users/guilherme/Developer/auri/src/shared/search.ts:15), [Listagem](/Users/guilherme/Developer/auri/src/main/db/patients.ts:42), [Testes de pacientes](/Users/guilherme/Developer/auri/src/main/db/patients.test.ts:22).
- A regra 07–20 está explícita no formulário: início >=07:00 e <20:00, com término <=20:00. O schema compartilhado de agendamento valida data/hora e término posterior ao início, sem aplicar esses limites; a operação no main usa esse schema. O banco aplica conflito de horários, sem uma checagem de expediente nesses trechos. — [Regra de agenda](/Users/guilherme/Developer/auri/src/shared/agenda.ts:27), [Formulário](/Users/guilherme/Developer/auri/src/renderer/src/components/AppointmentDialog.tsx:38), [Schema](/Users/guilherme/Developer/auri/src/shared/schemas.ts:73), [Operações no main](/Users/guilherme/Developer/auri/src/main/operations.ts:75), [Persistência](/Users/guilherme/Developer/auri/src/main/db/appointments.ts:73).
- Sobreposição no banco usa `inicio < fimPretendido AND fim > inicioPretendido`, permite sessões adjacentes e exclui o próprio ID na edição. A mensagem informa paciente e horários conflitantes. A implementação assume um profissional nesse comentário. — [Conflito](/Users/guilherme/Developer/auri/src/main/db/appointments.ts:32), [Testes escritos de conflito](/Users/guilherme/Developer/auri/src/main/db/appointments.test.ts:76).
- O botão “Cancelar” fecha o diálogo sem chamar salvar/remover; exclusão tem duas etapas, “Excluir” e “Confirmar exclusão”. O modelo de Appointment inspecionado não tem um status de cancelamento clínico. — [Ações do diálogo](/Users/guilherme/Developer/auri/src/renderer/src/components/AppointmentDialog.tsx:307), [Modelo](/Users/guilherme/Developer/auri/src/shared/schemas.ts:87).
- Datas de sessões são texto ISO local sem fuso. Os utilitários fazem conversão brasileira `dd/mm/aaaa`, validam datas inexistentes e produzem idade em dias, meses ou anos. — [Utilitários de datas](/Users/guilherme/Developer/auri/src/shared/dates.ts:29).
- Existe uma divergência documental verificável: README afirma ausência de backup automático, enquanto o main instancia serviço de backup e o E2E escrito configura cópia inicial cifrada e testa restauração. Isso demonstra por que conteúdo de documentação precisa ser reconciliado com comportamento. A leitura não confirma execução operacional de backup nesta sessão. — [README](/Users/guilherme/Developer/auri/README.md:12), [Inicialização do serviço](/Users/guilherme/Developer/auri/src/main/index.ts:171), [E2E de backup](/Users/guilherme/Developer/auri/scripts/e2e.mjs:242).

### Inferences

- Separar quatro contratos de produto: (1) regras e preservação de dados; (2) valores e estados apresentados; (3) significado dos textos e ações; (4) identidade e acessibilidade. Um diff de screenshot sozinho não confirma nenhum dos três primeiros.
- Manter exemplos aprovados em um catálogo pequeno, como `docs/qualidade/cenarios.yml`, com ID estável, requisito, dado fictício, resultado esperado, criticidade e testes associados. É proposta de organização, não arquivo existente.
- As expectativas devem ser literais independentes ou derivadas de um conjunto de dados de aceitação aprovado. Um teste de horário que importa `DAY_END_HOUR` do código para calcular seu próprio resultado esperado muda junto com a implementação e perde a capacidade de detectar uma alteração indevida do limite.
- Distinguir o que foi observado, o contrato que se quer aprovar e a alteração deliberada. O teste da UI pode preservar hoje a janela 07–20. Se essa janela precisar valer para qualquer cliente/IPC, isso exige decisão de produto e uma alteração explícita no contrato do main; esta pesquisa identificou uma discrepância de camadas, sem executar uma tentativa de bypass.
- Exemplo independente de conflito: dado “João Fictício” com 14/10/2026 14:00–15:00, tentar criar “Ana Teste” 14:30–15:30 pela API real deve falhar; o banco continua com uma sessão e a UI informa 14:00–15:00 e o paciente conflitante. A primeira sessão não pode desaparecer e uma notificação de sucesso não pode aparecer.
- Exemplo independente de limites: no formulário, 07:00+30 e 19:30+30 devem salvar; 06:45+30, 20:00+30 e 19:30+45 devem ficar sem gravação e mostrar a razão. Não testar só que “algum erro” ocorreu: validar o limite comunicado e que a API de gravação não foi acionada, ou que o total persistido permaneceu igual no E2E.
- Não congelar cada frase. Para mensagens críticas, validar significado e valores: ação, paciente, data, início/fim, estado, presença de orientação; usar texto exato somente quando a redação é parte do contrato aprovado, como um comando destrutivo ou instrução essencial. Uma regex ampla como `/erro/` não protege conteúdo.
- Não importar a própria constante de texto da implementação para dizer que a UI tem esse mesmo texto. Isso verifica encanamento, não a permanência do significado. Preferir uma expectativa independente e, para redações flexíveis, valores estruturados mais uma pequena rubrica de revisão humana.
- Rótulos de campos, nomes acessíveis, títulos e verbos principais são adequados a asserts direcionados. Evitar snapshot de todo o DOM, que acumula mudanças de classes e estrutura sem relação com o resultado do usuário.
- Para documentação, vincular claims relevantes a capacidades testadas e exigir revisão factual ao mudar fluxo/capacidade. Não há teste universal que prove que todo README está correto. O caso do backup é uma correção concreta a incluir na primeira etapa de saneamento.

### Gaps

- Não foram verificadas expectativas de produto para sessões fora do expediente via IPC, agendamento para paciente inativo ou eventual expansão para vários profissionais. Não converter tais temas em regras clínicas novas sem decisão explícita.
- Não se identificou um modelo financeiro nas telas e schemas de pacientes/agendamento inspecionados. Moeda BRL pode ser critério futuro quando existir funcionalidade financeira, sem acrescentar testes de finanças a este escopo.
- As expectativas temporais devem explicitar se horários de sessões representam hora local da clínica ou hora de cada computador. O fonte armazena hora local sem offset; uma proposta de alteração de fuso seria mudança de modelo, não simples endurecimento do CI.

## Camadas de teste adequadas ao Electron e ao SQLite

### Takeaway

Auri já tem testes de domínio e um E2E real de Electron, mas sua existência não equivale à cobertura das jornadas da UI ou do pacote distribuído. A proposta é ampliar os resultados de usuário preservados por esses testes e acrescentar componentes, comparação visual e smoke do artefato empacotado.

### Cited Findings

- `npm test` chama um runner que executa Vitest no Node embutido no Electron, porque `better-sqlite3` está compilado para Electron. O Vitest atual inclui `src/**/*.test.ts` e usa ambiente `node`; seu glob não inclui `.test.tsx`. Dependências inspecionadas não listam Testing Library, Playwright ou axe. — [Package](/Users/guilherme/Developer/auri/package.json:14), [Runner](/Users/guilherme/Developer/auri/scripts/run-tests.mjs:1), [Vitest](/Users/guilherme/Developer/auri/vitest.config.ts:3).
- SQLite cria bancos `:memory:` distintos por conexão; eles deixam de existir ao fechar a conexão. Por padrão, só a conexão que criou o banco tem acesso ao seu conteúdo. — [SQLite: bancos em memória](https://www.sqlite.org/inmemorydb.html).
- `openDatabase` usa o driver real, ativa foreign keys e WAL, registra normalização de texto e executa migrations. Isso é diferente de simular chamadas ao banco. — [Conexão SQLite](/Users/guilherme/Developer/auri/src/main/db/connection.ts:7).
- O E2E atual usa CDP, pasta `userData` temporária, dados fictícios, main e renderer reais. Ele inicializa `electron` de `node_modules` com `.` após build e grava screenshots; os checks são concentrados em backup, configurações e instalação dos provedores externos. A criação inicial de pacientes é feita diretamente por `window.api`, não pelos campos do formulário. — [E2E existente](/Users/guilherme/Developer/auri/scripts/e2e.mjs:7), [Launch](/Users/guilherme/Developer/auri/scripts/e2e.mjs:35), [Fixtures](/Users/guilherme/Developer/auri/scripts/e2e.mjs:225).
- O workflow atual roda manualmente ou por tag `v*`, tem macOS/Windows e publica capturas do E2E. A flag `AURI_E2E_INSTALAR` instala Google Drive/OneDrive, não o próprio instalador do Auri. — [Workflow](/Users/guilherme/Developer/auri/.github/workflows/build.yml:5), [Instalação de provedores](/Users/guilherme/Developer/auri/scripts/e2e.mjs:327).
- Playwright mantém suporte experimental ao Electron e fornece lançamento, acesso ao main e à janela. A documentação registra dependência do fuse de inspeção para launch; os diálogos nativos não são interceptados automaticamente, e seu mock precisa ocorrer no main. A documentação do Electron também apresenta testes com Playwright e drivers próprios. — [API Electron do Playwright](https://playwright.dev/docs/api/class-electron), [Testes automatizados do Electron](https://www.electronjs.org/docs/latest/tutorial/automated-testing).
- Os defaults de janela atuais são 1280×820, com mínimo 1000×640. O preload é carregado com `contextIsolation: true`, `nodeIntegration: false` e `sandbox: true`. Preferências são lidas no main e passadas à janela; o tema usa `nativeTheme.themeSource`. — [Janela real](/Users/guilherme/Developer/auri/src/main/index.ts:45), [Preferências](/Users/guilherme/Developer/auri/src/main/prefs.ts:14), [Aplicação de tema](/Users/guilherme/Developer/auri/src/main/index.ts:35).

### Inferences

Proposta de camadas, aproveitando o que existe:

| Camada | Objetivo e uso proposto | Limite da evidência |
| --- | --- | --- |
| Vitest de funções e schemas | Casos de datas inexistentes, idade, máscaras, CPF, busca e limites; entradas e saídas de aceitação independentes | Um schema correto não prova que a UI o chama ou explica o problema |
| Integração SQLite real | Regras de conflito, busca, inativação, foreign keys, migrations e alterações recusadas sem perda de dados | Banco em memória não prova reinício, disco, restauração nem o binário empacotado |
| Componentes React | Acrescentar RTL + user-event e ambiente DOM, separando configuração/globs de testes do main. Validar campos, resumo, erros, nomes acessíveis e ações | Stub de `window.api` deve ser explícito; não representa IPC ou SQLite reais |
| E2E do bundle Electron | Ampliar script CDP atual ou adotar Playwright gradualmente para interagir com UI, IPC, banco temporário, disco e reinício | `electron .` pós-build não comprova recursos e dependências dentro do artefato distribuído |
| Smoke do pacote | Abrir `.app`/executável obtido do pacote construído, conferir janela útil, preload, operação real e reinício com dados fictícios | Instalar um provedor de nuvem não é smoke do pacote Auri; validações de OS devem respeitar restrições de distribuição |
| Visual e acessibilidade | Screenshots aprovados de estados selecionados e axe após interações, junto de fluxo por teclado | Nem pixels nem scanner provam lógica, preservação de dados ou toda acessibilidade |

- Para um projeto pequeno, manter o CDP existente inicialmente é razoável. Playwright oferece asserts, locators, relatórios e comparação visual; pode justificar o custo de manutenção para as novas jornadas. Não há necessidade de reescrever de uma vez a suíte de backup.
- Separar testes de renderer/DOM e driver nativo, mas preservar o runner atual para integração com `better-sqlite3`. Acrescentar globs/projetos explicitamente evita que um `.tsx` novo nunca seja coletado enquanto o CI permanece verde.
- Para persistência, migrations históricas e restore, criar bancos em arquivos de diretórios temporários com fixtures sintéticas versionadas. Fechar conexões ao terminar, reiniciar o processo e reler resultados. Não usar uma cópia do banco pessoal como fixture.
- Uma fixture histórica deve ser imutável e ter um schema/version conhecido; o teste a copia para diretório descartável antes de abrir/migrar. Se a fixture antiga for recriada automaticamente pelo código novo, deixa de testar compatibilidade com a versão anterior.
- O smoke de preload precisa confirmar a API útil e executar uma operação não destrutiva no ambiente de teste; “a janela apareceu” pode passar com tela branca, erro de preload ou API indisponível. Capturar erros de preload, renderer e main com assert para falhas não esperadas.
- Ler HTML/abrir renderer no navegador pode ajudar testes de componentes e visuais, mas a prova Electron deve carregar main/preload reais. Usar mocks na API do renderer deve aparecer claramente no relatório de evidência.
- Ao automatizar pacote com fuse de inspeção desativado em release, escolher driver compatível ou smoke externo adequado; não enfraquecer a segurança do artefato publicado só para conectar o teste. A tecnologia de teste não deve ditar os controles do produto.

### Gaps

- Não se verificou a execução atual dos testes, seu total, duração, estabilidade ou cobertura. Inventário de fonte não é evidência de passagem.
- Não se confirmou neste recorte a estratégia de fuses/signing para o pacote de release nem uma forma já implementada de iniciar pacote com `userData` isolado. Isso deve ser validado na implementação do smoke.
- As jornadas atuais de conexão entre máquinas e controle concorrente merecem cenários próprios se estiverem no release; o código lido contém `updated_at` e prevenção de sobrescrita na edição. Esta proposta não substitui a verificação especializada dessas integrações. — [Edição de paciente](/Users/guilherme/Developer/auri/src/main/db/patients.ts:65), [Edição de sessão](/Users/guilherme/Developer/auri/src/main/db/appointments.ts:85).

## Regressão visual e acessibilidade com baseline confiável

### Takeaway

Começar com poucos estados importantes, dados fictícios fixos e baselines aprovados no mesmo ambiente do CI. Diferença visual deve gerar evidência para review; atualizar tudo automaticamente para ficar verde elimina a proteção.

### Cited Findings

- Playwright compara screenshots de referência e oferece atualização explícita de baselines. A documentação adverte que OS, versão, configuração, hardware e modo de execução influenciam a imagem, e recomenda comparar no mesmo ambiente em que a referência foi produzida; plataformas e browsers podem exigir referências separadas. — [Comparação visual](https://playwright.dev/docs/test-snapshots).
- Os asserts de screenshot esperam imagens consecutivas estáveis e permitem desativar animações, ocultar cursor de texto e fixar escala CSS. `threshold` trata diferença de cor por pixel; `maxDiffPixels` e `maxDiffPixelRatio` limitam quantidade/proporção de pixels diferentes. — [PageAssertions](https://playwright.dev/docs/api/class-pageassertions).
- A API Clock permite controlar relógio na página. Isso é um mecanismo para determinismo no renderer, sem justificar a suposição de que o relógio do main e do SQLite também está controlado. — [Clock](https://playwright.dev/docs/clock).
- Playwright integra axe e recomenda combinar análise automática, avaliação manual e uso inclusivo; o scan considera o estado atual, então é preciso abrir menus e diálogos para analisar seu conteúdo. Exclusões podem esconder todas as regras de uma árvore inteira. — [Acessibilidade automatizada](https://playwright.dev/docs/accessibility-testing).
- WCAG 2.2 exige operação por teclado para funcionalidades aplicáveis e que conteúdo criado pela aplicação não oculte inteiramente o componente focado. As páginas Understanding são explicações oficiais, não uma certificação resultante de passar axe. — [Teclado](https://www.w3.org/WAI/WCAG22/Understanding/keyboard.html), [Foco não encoberto](https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html).

### Inferences

- Fixar no job visual: imagem/versão de OS, versões de Electron/driver pelo lockfile, fonte embutida e carregada (`document.fonts.ready`), tamanho útil de conteúdo e escala, locale `pt-BR`, fuso documentado, data/hora fixa, fixtures, IDs, ordenação, conexão/rede simuladas conforme o cenário, tema e posição de mouse/foco/scroll.
- A janela externa e o viewport da página não são a mesma medida, especialmente com chrome nativo por OS. Registrar ambas no metadata e conferir os limites reais. Usar o mínimo 1000×640 e o padrão 1280×820 como pontos de partida, validando a dimensão útil capturada.
- Para relógio, combinar injeção controlada no renderer com timestamps de fixtures e um clock testável no main quando ele influencia o cenário. Evitar mocks de timers que parem o IPC, scheduler ou inicialização. Timestamps gerados por SQLite devem ser validados com regras adequadas ou normalizados somente na evidência não crítica.
- Para “Sistema”, testar integração de preferência e `nativeTheme`, com ambientes de tema controlado. Para pixels, usar Claro e Escuro explícitos: não depender do tema do runner na hora do screenshot.
- Desativar animação para comparação estática não testa feedback em movimento. Manter cenário funcional separado de foco/toast, modo de movimento reduzido e visibilidade do resultado; não esconder informações essenciais com máscaras para reduzir diffs.
- Matriz inicial sugerida, deliberadamente pequena: 8 estados em Claro e Escuro (16 referências), mais agenda e diálogo no tamanho mínimo em um tema (18 referências). Os outros fluxos continuam tendo asserts funcionais; ampliar snapshots quando o risco justificar.

| Tela/estado de baseline | Conteúdo protegido | Outras verificações no mesmo cenário |
| --- | --- | --- |
| Pacientes em primeiro uso | Mensagem e ação para cadastrar | Ação alcançável por teclado |
| Pacientes com nomes longos, acentos e inativo | Colunas, truncamento, estado e busca | Resultado correto de busca e filtro |
| Formulário de paciente com erro | Rótulos e erro associado ao campo | Foco e ausência de gravação inválida |
| Agenda semanal povoada até 19:30–20:00 | Grade, nome, datas/horas e limite inferior da janela | Sessão e foco não cobertos por toast |
| Diálogo de agendamento com resumo | Paciente, data, duração, início/fim e ação | Resumo corresponde aos inputs e à gravação |
| Diálogo com conflito | Nome e faixa do conflito, ação disponível | Nenhuma gravação indevida nem toast de sucesso |
| Configurações de aparência | Opção escolhida e legibilidade dos temas | Persistência após reinício |
| Cópia de segurança/restauração em estado relevante | Estado, consequência e confirmação | Banco sintético preservado ou restaurado conforme contrato |

- A matriz deve registrar screenshots por plataforma quando houver comparação de pixels do Electron em macOS/Windows; os 18 acima são estados lógicos, não promessa de somente 18 arquivos para todos os sistemas.
- Não prescrever “até 1% de diferença passa” como regra universal: um horário alterado ou botão perdido pode ocupar menos que isso. Calibrar tolerância com repetição do mesmo build e defeitos deliberados de exemplos, considerar regiões críticas separadas e complementar pixels com asserts de texto/valor. Nunca aumentar globalmente tolerância para resolver um defeito isolado.
- Rodar axe nas páginas e em diálogos abertos de ambos os temas. Tratar falha nova como bloqueio, preservar exceções existentes com localização, regra, responsável e vencimento. Não excluir o formulário inteiro ou desligar uma regra porque um componente falhou.
- Complementar com fluxo por Tab/Shift+Tab/Enter/Escape, nome acessível de ícones, foco inicial e retorno ao abrir/fechar diálogo, erros anunciáveis e scroll/foco nos estados perto de 20:00. Fazer checagem manual com VoiceOver/NVDA em mudanças relevantes e antes de releases; axe verde não comprova conformidade integral.

### Gaps

- Não foram geradas nem comparadas imagens, aferido contraste real ou medido ruído visual. As tolerâncias, quantidade final de estados e custo do runner precisam de uma rodada inicial de calibração.
- A documentação visual é uma fonte de intenção, não comprova que todos os componentes atuais a cumprem. As primeiras imagens precisam de revisão para não consagrar defeitos como baseline.

## Catálogo prioritário e proteção contra enfraquecimento dos testes

### Takeaway

O CI deve falhar quando perde proteção de um cenário crítico, além de falhar quando o cenário executado encontra defeito. Uma IA pode alterar simultaneamente implementação, teste e baseline; por isso a aceitação e as mudanças dos controles precisam de comparação com a base e aprovação explícita.

### Cited Findings

- Vitest recomenda versionar/revisar snapshots junto com o código; em CI, por padrão não grava snapshots e falha em divergências, snapshots ausentes e obsoletos. Os comandos de atualização existem, logo a configuração de CI deve preservar a verificação. — [Snapshots do Vitest](https://vitest.dev/guide/snapshot.html).
- Playwright distingue sucesso na primeira execução, flaky (falhou e passou no retry) e falha persistente. Recomenda isolamento para repetir casos independentemente. — [Retries](https://playwright.dev/docs/test-retries).
- A CLI Playwright tem coleta sem execução (`--list`), detecção de `test.only` com `--forbid-only`, falha por flaky com `--fail-on-flaky-tests` e flags capazes de ignorar snapshots ou permitir zero testes. Essas capacidades não indicam que o Auri as usa hoje. — [CLI do Playwright](https://playwright.dev/docs/test-cli).
- As assertions assíncronas Playwright reconsultam elementos até a condição ou timeout, o que permite esperar estados visíveis sem sleeps fixos. — [Assertions](https://playwright.dev/docs/test-assertions).

### Inferences

Primeiro catálogo proposto, 10 cenários com prioridade baseada em perda de dados, bloqueio de uso e informação incorreta:

| ID e prioridade sugerida | Resultado esperado independente | Camada inicial |
| --- | --- | --- |
| AURI-01 P0: inicialização real | Janela útil carrega, API do preload existe e leitura de dados fictícios por IPC responde sem erro; pacote distribuído também abre e reinicia | Smoke Electron do bundle por PR; smoke do pacote em ambos OS antes de release |
| AURI-02 P0: cadastro e edição | Nome obrigatório; CPF/data inválidos não são gravados; cadastro válido e edição mantêm todos os campos após fechar e abrir | Schema + SQLite; componente e uma jornada E2E pelos campos |
| AURI-03 P1: busca/inativação | “joao” encontra “João Fictício”; busca de mãe/CPF funciona; inativo sai do filtro padrão, aparece com inclusão e pode ser reativado | SQLite + componente; E2E focalizado |
| AURI-04 P1: janela de agenda | UI aceita 07:00+30 e 19:30+30; recusa 06:45, 20:00 e término 20:15, explicando o limite e mantendo banco igual | Componentes + E2E; contrato main se aprovado depois |
| AURI-05 P0: conflito/remarcação | Criar ou mover para intervalo ocupado é recusado sem perda de registro; a própria sessão não conflita consigo; 15:00 após 14:00–15:00 é aceito | SQLite + chamada real por IPC + UI de erro |
| AURI-06 P0: abandonar/excluir | “Cancelar” criação/edição deixa dados iguais; clicar “Excluir” sozinho não remove; confirmar remove apenas a sessão certa e libera horário | Componente + E2E + SQLite |
| AURI-07 P1: valores e idioma | 2026-10-14 aparece 14/10/2026 onde esse formato é contratado, hora 09:30 mantém 09:30; resumo e idade no relógio fixo correspondem aos dados, sem troca de dia por UTC | Utilitários + asserts da UI; testes em fusos explicitados |
| AURI-08 P1: preferências/tema | Claro/Escuro e sidebar escolhidos sobrevivem reinício; Sistema aplica tema nativo controlado; nenhum flash/tela inicial inútil encobre a operação | Prefs existente + E2E real; visual para Claro/Escuro |
| AURI-09 P0: backup/restore/configuração | Cópia sintética restaura exatamente pacientes/sessões esperados; desfazer restauração preserva estado anterior; entrada inválida e senha errada não destroem dados; importação de configuração aplica só contrato previsto | Ampliar/assertar suíte existente; SQLite em arquivo + Electron real |
| AURI-10 P1: apresentação e operação | Estados da matriz mantêm ações/valores visíveis em ambos temas e dimensão mínima; fluxo por teclado funciona; não há violações automáticas novas sem exceção revisada | Visual + axe + asserts E2E de foco/conteúdo |

- O catálogo não mede qualidade contando apenas testes. Cada ID crítico deve constar na coleta e no resultado, com evidência e status. Um arquivo renomeado não deve virar falso bloqueio; comparar IDs e intenção, mantendo histórico de substituição.
- Acrescentar, conforme risco do release, cenários próprios de banco antigo→novo, acesso entre computadores e tentativa concorrente com `updated_at` obsoleto; essas proteções não devem depender de um único cenário composto de backup.
- Cada PR deve indicar IDs afetados e intenção: preservação ou mudança de contrato. Bug corrigido recebe exemplo que falha no comportamento anterior quando isso for viável; requisito novo recebe resultado aprovado antes de “gravar a nova referência”.
- Bloqueio automático simples: erro de assert, cenário P0 não coletado, `only`, skip novo em crítico, redução não aprovada de proteção ou baseline ausente. Remover teste, mudar resultado esperado, reduzir exigência de cobertura ou elevar tolerância visual, adicionar máscara/exclusão de axe, alterar glob ou flags de execução são mudanças nos controles e precisam de diff e review visíveis.
- Comparar base e head: inventário de IDs/testes, skips/quarentenas, baselines e opções de execução; cobertura dos arquivos/ramos críticos usando ambiente e configuração equivalentes, junto com números absolutos/denominador. Percentual agregado sozinho pode esconder remoção de código/testes importantes ou cobertura por imports sem asserts.
- Uma opção mais forte é executar um subconjunto estável de aceitação da base aprovada contra o build do head. É proposta, com limitações: renomeações e mudanças deliberadas de contrato precisam de diagnóstico/aprovação, e mudanças de tooling exigem compatibilidade. Preservar o oráculo externo impede o mesmo PR de redefinir silenciosamente o que significa “passar”.
- Snapshots aprovados devem vir da base/release validada e não ser regenerados automaticamente durante o job obrigatório. CI gera “atual” e “diff”; mudança de baseline entra como artefato/commit explícito com justificativa, telas antes/depois e aprovação do responsável pelo produto. Evitar comando de atualizar todas as referências por conveniência.
- Um catálogo aprovado pode registrar a intenção da mudança; não aceitar automaticamente que “o autor mudou o YAML” é aprovação. Controles devem depender de regra externa confiável do repositório/pipeline. Mesmo para equipe de uma pessoa, a revisão humana explícita é um ponto distinto da sugestão da IA.
- Evidência por SHA: catálogo executado, JUnit/JSON, versões de runner/Electron/driver, fixture/hash, locale/fuso/clock, screenshots esperado/atual/diff, erros de main/preload/renderer e log do pacote. Anexar screenshot na falha e trace quando disponível, sem dados reais.
- Flakiness: começar com asserts por estado e fixtures isoladas, corrigir sleeps globais e dependências de ordem. Retry limitado serve ao diagnóstico; P0 flaky não deve ser promovido silenciosamente a verde. Quarentena apenas com justificativa, responsável, prazo e outra evidência do contrato, reportada separadamente e sem remover o ID do inventário.
- Depois de stable, fazer sempre os P0 por PR e os testes afetados adicionais; suíte completa e smoke de release nos OS suportados, com uma execução completa periódica para pegar interações não selecionadas. A escolha exata depende de duração/custo medidos, que não foram apurados aqui.

### Gaps

- Não foram definidos tempo máximo de feedback, orçamento de CI, políticas remotas atuais de aprovação ou cobertura mínima. Limiares arbitrários sem linha inicial medida podem gerar ruído e incentivar exceções.
- Um suite base→head protege somente contratos que ela cobre. Nem revisão humana nem teste automático garante ausência de regressão; a recomendação é uma coleção de evidências complementares com aprovação explícita das mudanças de expectativa.

## Se conteúdo futuramente significar respostas geradas por IA

### Takeaway

A pesquisa considera IA como autora de alterações do código, conforme a pergunta. Se o próprio produto passar a gerar textos com um modelo, será necessário um sistema de avaliações versionadas adicional; isso não deve ser presumido como capacidade atual do Auri.

### Cited Findings

- O package e os schemas/telas de pacientes e agenda inspecionados descrevem dados determinísticos, formulários e persistência, sem evidência nesses trechos de geração de respostas por LLM em runtime. Esta conclusão é limitada ao recorte lido. — [Package](/Users/guilherme/Developer/auri/package.json:1), [Schemas](/Users/guilherme/Developer/auri/src/shared/schemas.ts:21).

### Inferences

- Proposta condicional: versionar dataset de entradas e resultados/rubricas aprovados; registrar versão de prompt/modelo/configuração; manter checks determinísticos para estrutura, fatos/dados que precisam constar, conteúdo proibido e formatação; avaliar casos representativos e falhas anteriores.
- Para redação aberta, calibrar avaliador com revisão humana; usar comparação cega com baseline quando possível, repetições se houver variabilidade e critérios por risco. Um “LLM juiz” não deve aprovar sozinho segurança ou correção factual, especialmente quando o mesmo modelo gerou implementação e resposta.
- Não equiparar aprovação de redação por modelo a teste determinístico da API/SQLite. Evals seriam outra evidência com sua incerteza e custo, reservada à funcionalidade que realmente gerar conteúdo.

### Gaps

- Não se pesquisaram frameworks, fornecedores ou preços de evals porque não há requisito confirmado de IA no produto. A proposta condicional não é seleção de tecnologia nem benchmark.
- Rastreio de memória usado para orientar a leitura, com fatos depois confirmados no fonte atual: `MEMORY.md:76–79` (tema, preload e limites) e `MEMORY.md:572–575` (runner e sobreposição); IDs úteis `01a135c8-38b8-7711-9065-accbe109bd83` e `01a11e33-a19d-7d60-a0dc-5241a50292c5`. Não reutilizar resultados históricos de execução como prova de estado atual.
