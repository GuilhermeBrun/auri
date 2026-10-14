# Qualidade e regressão com IA

**Proposta pesquisada em 14/10/2026.** Referência: Auri, Electron/React/TypeScript/SQLite, repositório privado no GitHub; princípios transportáveis a outros sistemas. Inspeção local da branch `main`, commit `a04490a9fefb7ef6ac04ae2eafba9b9b2456b18a`. Não foram executados testes, builds ou scanners. Plano, proteções remotas, permissões e configuração de assinatura permanecem sem verificação.

Recomendo implementar **um processo de aceitação de PR protegido, com critérios versionados e evidências independentes da alteração produzida pela IA**. Ele deve bloquear regressões de código, comportamento, dados e conteúdo antes da integração, e exigir uma validação adicional do aplicativo que será distribuído. O Auri já oferece testes, build e E2E que podem sustentar a primeira etapa; precisamos ligá-los ao PR e proteger as regras que decidem a aprovação. A revisão por outra IA deve ajudar a encontrar problemas, com resultado consultivo. Essa combinação reduz o risco de regressão e vulnerabilidade, sem prometer correção ou segurança completas. A orientação de integrar práticas de segurança ao desenvolvimento é coerente com o [NIST SSDF](https://csrc.nist.gov/pubs/sp/800/218/final).

## O Auri já tem automação, mas falta a barreira de integração

O workflow atual roda manualmente ou por tags `v*`, com Windows/macOS, testes, empacotamento e E2E. **Não há gatilho de PR ou push em `main` no arquivo examinado.** Há 15 arquivos de testes inventariados, o que não informa quantos casos passam nem qual é sua cobertura. A pesquisa avaliou o desenho declarado, sem comprovar execução funcional. [Workflow atual](/Users/guilherme/Developer/auri/.github/workflows/build.yml:5), [configuração dos testes](/Users/guilherme/Developer/auri/vitest.config.ts:3).

| Área | Situação observada | Lacuna a resolver |
| --- | --- | --- |
| TypeScript, ESLint e Prettier | Existentes; build inclui typecheck | Lint fora do workflow; formato só tem modo de escrita |
| Regras, SQLite, rede e backup | Testes existentes em main/shared | Medir execução/cobertura e ampliar contratos críticos |
| Componentes React | Ausentes no recorte | Ambiente DOM e coleta explícita de `.test.tsx` |
| E2E Electron | Existente, parcial | Predomina backup/configurações; ampliar interação pelos formulários |
| Visual e conteúdo | Capturas e identidade documentada | Comparação aprovada, asserts de valores e revisão factual |
| PR/main e integridade da política | Gate local ausente | Workflow obrigatório e proteção no servidor |
| Segredos, SAST/SCA e mutação | Jobs locais ausentes | Scanners com critério efetivo de falha |
| Pacote distribuído e release | Empacotamento existente; entrega parcial | Smoke do pacote, instalação/upgrade e assinatura final |

Essa matriz se apoia nos [scripts existentes](/Users/guilherme/Developer/auri/package.json:7), no [E2E](/Users/guilherme/Developer/auri/scripts/e2e.mjs:17) e na [configuração de distribuição](/Users/guilherme/Developer/auri/electron-builder.yml:25). “Ausente” aqui significa não encontrado na configuração local, sem inferir o estado das opções externas do GitHub.

O comando **`npm test` precisa preservar `scripts/run-tests.mjs`**, que executa Vitest no runtime Electron por causa do `better-sqlite3`. Trocar pelo Vitest no Node comum pode invalidar o contrato dos módulos nativos. O provider de cobertura também precisa de um piloto nesse ambiente. [Runner atual](/Users/guilherme/Developer/auri/scripts/run-tests.mjs:1), [módulos nativos no Electron](https://www.electronjs.org/docs/latest/tutorial/using-native-node-modules), [cobertura do Vitest](https://vitest.dev/guide/coverage.html).

O E2E abre Electron de `node_modules` com `.` e o bundle em `out`; isso exercita o aplicativo compilado, **não o `.app` ou `.exe` distribuído**. `AURI_E2E_INSTALAR` instala Google Drive/OneDrive; não instala o Auri. Esses downloads devem sair do caminho rápido de PR. Já o smoke do pacote precisa conferir API do preload, operação real e reinício, além da janela aberta. Gerar Mac arm64/x64 não demonstra execução em ambas: antes da entrega, cada alvo suportado precisa de evidência própria. [Inicialização do E2E](/Users/guilherme/Developer/auri/scripts/e2e.mjs:35), [instalação dos provedores](/Users/guilherme/Developer/auri/scripts/e2e.mjs:326), [alvos locais](/Users/guilherme/Developer/auri/electron-builder.yml:25), [automação Electron](https://www.electronjs.org/docs/latest/tutorial/automated-testing).

Existe uma primeira correção concreta de conteúdo: o README declara ausência de backup automático, enquanto serviço, especificação e E2E escritos descrevem essa capacidade. É uma inconsistência documental confirmada por leitura; não é comprovação de backup executado nesta pesquisa. [README](/Users/guilherme/Developer/auri/README.md:12), [serviço](/Users/guilherme/Developer/auri/src/main/index.ts:171), [especificação](</Users/guilherme/Developer/auri/docs/superpowers/specs/2026-10-13-copia-de-seguranca-design.md:53>).

## A aprovação deve preservar resultados do usuário

“Conteúdo” inclui valores exibidos, mensagens, verbos das ações, datas, documentação, apresentação e acessibilidade. Um screenshot pode parecer correto enquanto o banco perde um registro; um teste de banco pode passar enquanto a UI informa sucesso após uma falha. Precisamos de contratos pequenos que conectem requisito, entrada fictícia, resultado esperado, criticidade e evidência.

O catálogo proposto deve ter IDs estáveis e expectativas aprovadas, sem calcular sua resposta a partir das constantes que o PR altera. Se o teste importar o limite de expediente da implementação para decidir o horário aceito, ambos podem mudar juntos sem detectar a regressão. Exemplos escritos antes da alteração tornam essa decisão visível. Nos componentes, testar ações e campos como a pessoa os usa, conforme os [princípios da Testing Library](https://testing-library.com/docs/guiding-principles/).

| ID proposto | Resultado de aceitação | Evidência principal |
| --- | --- | --- |
| AURI-01, crítico | Janela útil, preload e leitura real funcionam; reinício preserva estado | Electron por PR; pacote por release |
| AURI-02, crítico | Cadastro/edição válidos persistem; entrada inválida não grava | Schema, SQLite e formulário |
| AURI-03 | “joao” encontra “João Fictício”; filtros de inativos preservam histórico | SQLite e UI |
| AURI-04, crítico | Sobreposição é recusada; adjacência aceita; editar a própria sessão não gera falso conflito | SQLite, IPC e UI de erro |
| AURI-05, crítico | “Cancelar” abandona sem salvar; exclusão só ocorre após confirmação e afeta o registro correto | UI e banco |
| AURI-06 | Datas, horas, resumo e idade correspondem aos dados com relógio fixo; limites 07–20 são preservados na UI | Utilitários, componentes e E2E |
| AURI-07, crítico | Backup/restore/desfazer preservam o estado esperado; senha/arquivo inválidos não substituem o banco | Banco em arquivo e Electron |
| AURI-08, crítico | Banco de versão publicada migra preservando registros; reabertura é idempotente e versão futura é recusada | Fixtures históricas descartáveis |
| AURI-09, crítico | Edição concorrente, revogação e versão incompatível são recusadas; IPC mantém fronteiras aprovadas | Testes negativos de main/rede |
| AURI-10 | Tema persiste; ações e valores ficam visíveis no tamanho mínimo; teclado, foco e nomes acessíveis funcionam | E2E, visual e acessibilidade |

Essa é uma **prioridade proposta**, não cobertura já demonstrada. Os comportamentos observados estão em [pacientes](/Users/guilherme/Developer/auri/src/main/db/patients.ts:42), [agendamentos](/Users/guilherme/Developer/auri/src/main/db/appointments.ts:32), [diálogo](/Users/guilherme/Developer/auri/src/renderer/src/components/AppointmentDialog.tsx:307), [migrações](/Users/guilherme/Developer/auri/src/main/db/migrations.ts:9) e [testes de rede](/Users/guilherme/Developer/auri/src/main/net/sync.test.ts:100). Não há status persistido de cancelamento clínico no modelo examinado: “Cancelar” fecha o diálogo, e “Excluir” remove.

Dois contratos exigem decisão explícita antes de endurecimento. **07–20 é aplicado hoje no formulário, não uniformemente no schema/main**; torná-lo obrigatório para IPC/rede é uma alteração de domínio proposta. Os handlers IPC examinados ignoram o evento; validar remetente é hardening recomendado, sem alegar exploração comprovada. [Formulário](/Users/guilherme/Developer/auri/src/renderer/src/components/AppointmentDialog.tsx:38), [schema](/Users/guilherme/Developer/auri/src/shared/schemas.ts:73), [IPC](/Users/guilherme/Developer/auri/src/main/ipc.ts:9), [checklist de segurança Electron](https://www.electronjs.org/docs/latest/tutorial/security).

Exemplo de contrato de conteúdo independente, **arquivo proposto**:

```yaml
id: AURI-04-conflito
fixture:
  existente: { paciente: João Fictício, inicio: '2026-10-14T14:00', fim: '2026-10-14T15:00' }
  tentativa: { paciente: Ana Teste, inicio: '2026-10-14T14:30', fim: '2026-10-14T15:30' }
esperado:
  registros_apos: 1
  mensagem_identifica: [João Fictício, '14:00', '15:00']
  sucesso_visivel: false
```

A redação flexível pode receber revisão humana; valores, consequência e ação devem ter asserts direcionados. Evitar importar a própria mensagem do componente como expectativa ou congelar todo o DOM. Documentação precisa de revisão factual quando uma capacidade muda; um scanner de palavras não demonstra que todo manual está correto.

Para visual, iniciar com poucos estados de Pacientes, Agenda, diálogos e backup, em Claro/Escuro. Fixar fixtures, relógio, locale, fuso, fontes, viewport, escala e versões; manter referências por plataforma quando necessário. O CI produz esperado/atual/diff e falha na divergência relevante; a atualização entra em revisão explícita. Tolerância global pode esconder um horário errado em poucos pixels. [Comparação visual do Playwright](https://playwright.dev/docs/test-snapshots), [opções de screenshot](https://playwright.dev/docs/api/class-pageassertions).

Acessibilidade requer scan nos estados realmente abertos e jornadas por teclado, foco e mensagens de erro. Axe e imagens complementam VoiceOver/NVDA nas mudanças relevantes; passar a automação não certifica conformidade integral. [Testes de acessibilidade](https://playwright.dev/docs/accessibility-testing), [WCAG: teclado](https://www.w3.org/WAI/WCAG22/Understanding/keyboard.html).

Critérios operacionais iniciais, **propostos e sujeitos a calibração**:

| Controle | Condição para passar |
| --- | --- |
| Instalação, formato, lint e build | Lockfile consistente; nenhum erro; lint sem avisos no escopo aprovado |
| Cenários obrigatórios | Todos coletados e aprovados; nenhum crítico ausente, desabilitado ou flaky sem decisão formal |
| Cobertura | Após piloto, alvo inicial de 80% das linhas alteradas; piso de branches por módulo separado e aprovado |
| Mutação | Começar nos módulos críticos; piso igual ao baseline aprovado e nenhuma queda sem revisão dos sobreviventes |
| Performance | Após medir um ambiente fixo, orçamento por operação; proposta inicial: p95 até 20% acima do baseline aprovado |
| Segurança | Nenhum segredo novo ou achado alto/crítico novo sem exceção válida |
| Evidência | Relatórios esperados presentes, íntegros e associados ao SHA validado |

Os percentuais são escolhas de política, não padrões universais nem medições do Auri. Cobertura global e `npm audit` isolados não comprovam comportamento. Mutação verifica se mudanças deliberadas na lógica são percebidas pelos testes; sua integração com o runner Electron precisa ser pilotada. [StrykerJS](https://stryker-mutator.io/docs/stryker-js/introduction/), [limiares de mutação](https://stryker-mutator.io/docs/stryker-js/configuration/).

## A IA não pode redefinir silenciosamente o que passa

O risco central é alterar implementação e enfraquecer simultaneamente assertions, fixtures, snapshots, globs, skips, tolerâncias ou workflow. **Testes verdes só têm valor quando a proteção esperada continuou existindo.** A OWASP descreve o comprometimento do pipeline por alterações nos arquivos executados pelo CI. [Poisoned Pipeline Execution](https://owasp.github.io/www-project-top-10-ci-cd-security-risks/CICD-SEC-04-Poisoned-Pipeline-Execution).

Tratar `.github/**`, runners, configurações, contratos, baselines e exceções como arquivos sensíveis. Comparar base/head pelo catálogo de IDs, testes coletados, exclusões, skips e opções; uma renomeação justificada mantém o histórico do cenário. Mudanças de expectativa devem mostrar motivo e evidência anterior/nova. Proibir atualização indiscriminada de snapshots no job de validação. `CODEOWNERS` encaminha revisão, mas depende da proteção adequada e pode ser alterado; não é uma fronteira imutável. [Code owners](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-code-owners), [snapshots Vitest](https://vitest.dev/guide/snapshot.html).

O status final `quality` deve executar sempre e exigir **`success` de todas as verificações aplicáveis**, além de validar relatórios e cenários. Falha, ausência, cancelamento, `skipped` ou `neutral` em check exigido reprovam. Isso é necessário porque required checks do GitHub podem aceitar `skipped`/`neutral`. Classificação “não aplicável” deve vir da política confiável e deixar evidência. Selecionar o GitHub App de origem do check ajuda, mas não impede alteração de workflow que publica verde pelo mesmo App. [Proteções de branch](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches).

Na primeira fase, combinar proteção remota, revisão explícita e controles versionados. Quando houver necessidade de maior independência, executar um subconjunto de aceitação da base aprovada contra o build candidato, usando verificador da base ou referência imutável administrada separadamente. Isso exige compatibilidade e procedimento para mudança legítima de contrato; um script novo no mesmo PR não pode atestar sozinho sua integridade.

Para trabalho solo, configurar PR e checks obrigatórios com **zero aprovação humana adicional**, acompanhados de revisão manual documentada das mudanças sensíveis e da release, é viável. Exigir outra aprovação bloquearia os próprios PRs: o autor não pode aprová-los. Um segundo humano pode ser introduzido para alterações críticas; outra IA permanece consultiva. A limitação é explícita: quem administra o repositório ainda pode mudar a política, e credencial administrativa entregue à IA não distingue suas ações das do mantenedor. [Revisão obrigatória](https://docs.github.com/en/pull-requests/how-tos/review-pull-requests/approving-a-pull-request-with-required-reviews), [limites da revisão Copilot](https://docs.github.com/en/copilot/responsible-use/agents).

Baseline permite registrar passivo anterior, sem justificar novas vulnerabilidades. Exceções precisam de finding/escopo, razão, mitigação, responsável, aprovador, prazo e correção vinculada; vencimento reprova. Não excluir pastas ou categorias inteiras indefinidamente. Dependências embarcadas e de build entram na triagem. Scan completo periódico detecta advisories posteriores, e `npm audit fix` deve gerar mudança revisável fora do gate. [npm audit](https://docs.npmjs.com/cli/v11/commands/npm-audit/).

## O CI deve distribuir custo e evidência por evento

Começar com ferramentas nativas e GitHub Actions evita montar uma plataforma antes de provar bloqueios. Acrescentar scanner de segredos, como Gitleaks, e escolher um SAST principal. [Gitleaks](https://github.com/gitleaks/gitleaks).

| Opção | Uso recomendado | Limite a verificar |
| --- | --- | --- |
| Stack atual + Actions | Base obrigatória: regras, build, Electron e relatórios | Minutos, runners e proteção remota |
| SonarQube Cloud | Painel de qualidade e análise de código novo | Free documenta até 50 mil LOC privados e cinco membros; customizações dependem de plano |
| Semgrep CE | Regras versionadas, inclusive padrões Electron/IPC | Scanner local; achados exigem `--error`/política; SCA avançada é produto separado |

As condições de privado foram verificadas na documentação, sem confirmar contratação no Auri. Sonar self-hosted acrescentaria operação própria sem necessidade demonstrada. Recursos privados de CodeQL/Secret Protection e upload ao code scanning também dependem de elegibilidade/licença. [Planos SonarQube Cloud](https://docs.sonarsource.com/sonarqube-cloud/administering-sonarcloud/managing-subscription/subscription-plans), [Semgrep CE no CI](https://docs.semgrep.dev/deployment/oss-deployment), [CLI Semgrep](https://docs.semgrep.dev/cli-reference/), [segurança GitHub](https://docs.github.com/en/code-security/getting-started/github-security-features).

| Evento | Validação proposta |
| --- | --- |
| PR | Integridade da política, instalação, formato/lint/build, testes e cenários críticos; Electron rápido Windows/macOS; segurança e evidências |
| `main` | Reexecutar no commit integrado; cobertura completa, conteúdo/visual e smoke empacotado |
| Agendamento | Mutação dirigida, performance, scans completos, rede/TZ/arquiteturas e instaladores externos em ambiente descartável |
| Release | SHA confiável com gates completos; pacote final, instalação/upgrade, assinatura e publicação restrita |

O caminho de PR não recebe certificados, tokens de publicação ou dados pessoais. Actions devem ser fixadas por SHA verificado, runtime/OS calibrados e token mínimo. Não executar a cabeça de PR via `pull_request_target` privilegiado. `npm ci` preserva lockfile, mas instala código: desabilitar todo postinstall sem piloto pode quebrar o contrato Electron/nativo atual. [Segurança Actions](https://docs.github.com/en/actions/reference/security/secure-use), [pull_request_target](https://docs.github.com/en/actions/reference/security/securely-using-pull_request_target), [npm ci](https://docs.npmjs.com/cli/v11/commands/npm-ci/).

Esboço lógico, **não um workflow pronto**; referências e verificadores precisam de implementação:

```yaml
on: [pull_request, push_main] # push_main representa push em main
permissions: { contents: read }
jobs:
  policy:
    run: verificar_catalogo_base_head_com_politica_aprovada # NOVO
  checks:
    matrix: [windows, macos]
    steps:
      - checkout_sem_credencial_persistida # actions fixadas por SHA
      - configurar_Node_Electron_aprovados
      - run: npm ci
      - run: npm run format:check # NOVO script; hoje format escreve
      - run: npm run lint -- --max-warnings=0 # argumento proposto
      - run: npm test # existente: manter runner Electron
      - run: npm run build # existente: inclui typecheck
      - run: node scripts/e2e.mjs e2e-saida # existente; sem flags de instaladores
      - publicar_evidencias_sempre # ampliar relatórios existentes
  security:
    run: scanners_com_exit_code_e_relatorios # NOVO
  quality:
    always: true
    needs: [policy, checks, security]
    run: exigir_success_e_validar_evidencias # NOVO; verificador confiável
```

O agregador não deve aceitar `continue-on-error`, zero testes ou relatório vazio inesperado. Cada execução guarda SHA/base SHA, versões, IDs/status, fixture/hash, logs sanitizados, cobertura, findings e screenshots/diffs; release acrescenta plataforma/arquitetura e hashes dos binários. Retry serve ao diagnóstico; falha crítica seguida de sucesso não deve desaparecer como “verde”. [Retries](https://playwright.dev/docs/test-retries).

## A implantação começa no PR e termina no artefato validado

A primeira entrega recomendada é **ligar PR/main aos comandos atuais, acrescentar formato em modo check, relatório de testes, agregador e comparação do catálogo**, introduzir scanner de segredos e corrigir a documentação de backup. Validar em Windows/macOS antes de exigir os checks remotos. Essa fase já oferece uma barreira observável; não depende de Sonar, mutação ou uma reescrita do E2E.

Depois, acrescentar fixtures SQLite de versões publicadas, jornadas reais de paciente/agenda/reabertura, cobertura medida e contratos IPC/rede aprovados. A terceira etapa traz baselines visuais, acessibilidade, smoke empacotado e upgrade/restore. Mutação e performance começam agendadas e tornam-se seletivas por PR somente quando seu custo e estabilidade forem conhecidos.

```text
.github/workflows/quality.yml             novo: PR/main e agregador
.github/workflows/build.yml               existente: reaproveitar empacotamento
.github/workflows/scheduled-quality.yml   novo: verificações caras
.github/CODEOWNERS                        novo: encaminhar revisão sensível
docs/qualidade/politica.md                 novo: critérios e exceções
docs/qualidade/cenarios.yml                novo: catálogo independente
scripts/run-tests.mjs                     existente: preservar runtime
scripts/e2e.mjs                           existente: ampliar caminho rápido
scripts/check-quality-policy.mjs          novo: inventário e integridade
scripts/smoke-packaged.mjs                 novo: pacote e dados temporários
tests/fixtures/sqlite/                    novo: fixtures históricas fictícias
tests/visual/                             novo: referências revisadas
```

Antes da implementação, confirmar plano/ownership GitHub, recursos privados, Node compatível, arquiteturas suportadas e requisitos de distribuição. **A última etapa operacional** é cadastrar os checks reais como obrigatórios, exigir PR atualizado contra a base, restringir force push/deleção/bypass e verificar permissões de publicação. Rulesets privados dependem de plano; escrever YAML não ativa proteção de merge. [Rulesets GitHub](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/about-rulesets).

Testar também o guardião: em branches/fixtures descartáveis, inverter a comparação de conflito, remover assertion relevante, alterar limite exibido, adicionar skip crítico, mudar glob, elevar tolerância e omitir relatório. Cada caso deve reprovar com diagnóstico útil. Não integrar nem publicar esses defeitos. Primeiro provar que o bloqueio funciona; depois autorizar sua exigência no fluxo normal.

Na entrega, validar a origem do SHA e publicar **o mesmo artefato final testado**, sem reconstrução posterior. Separar jobs que usam credenciais e verificar assinatura por plataforma. A configuração atual declara assinatura Mac ad-hoc e notarização desativada; não é o estágio final proposto. Manifesto, hashes e SBOM ajudam a rastrear conteúdo; declarar seu escopo e incluir Electron/Chromium, módulos nativos e componentes distribuídos além da árvore npm. Assinatura autentica distribuição, e proveniência precisa ser verificada para trazer benefício. Attestations privadas do GitHub exigem Enterprise Cloud, sem presumir disponibilidade. [Configuração local](/Users/guilherme/Developer/auri/electron-builder.yml:35), [assinatura Electron](https://www.electronjs.org/docs/latest/tutorial/code-signing), [SLSA](https://slsa.dev/spec/v1.2/build-track-basics), [disponibilidade de attestations](https://docs.github.com/en/enterprise-cloud%40latest/actions/how-tos/secure-your-work/use-artifact-attestations/use-artifact-attestations).

Upgrade e recuperação usam bancos fictícios ou fixtures sanitizadas autorizadas, nunca dados de produção neste CI. Uma fixture antiga não deve ser regenerada pela implementação nova. Testar integridade, registros, versão, reinício e restauração consistente. **Rollback do executável e rollback de dados são operações diferentes**: a versão antiga pode recusar o schema novo, e restaurar backup exige reconciliar gravações posteriores. Cópia ingênua de banco ativo não substitui snapshot consistente. [SQLite Backup API](https://www.sqlite.org/backup.html), [recusa de versão futura](/Users/guilherme/Developer/auri/src/main/db/migrations.ts:9).

Caso o produto futuramente gere textos por LLM, acrescentar avaliações com dataset/rubricas aprovados e versão de prompt/modelo. Isso é condicional: a proposta atual trata IA como autora do código. A autoridade para alterar contratos e liberar o aplicativo deve permanecer explícita, sustentada pela evidência do candidato. Esta pesquisa criou somente a proposta; não alterou pipeline ou código, não fez commit/push e não publicou release.
