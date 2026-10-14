# Barreiras de qualidade e segurança para código com IA

Pesquisa em fontes primárias consultadas em 14 de outubro de 2026. Este texto distingue recursos documentados dos fornecedores e propostas de política para o Auri. Não verificou regras remotas, licenças, configuração do Sonar nem executou pipelines. O inventário local pertence à outra frente de pesquisa; aqui não se presume que o repositório esteja sem CI.

## Que evidências devem bloquear regressões de código e segurança?

### Takeaway

Uma defesa útil combina verificações com falhas diferentes: integridade da política, análise estática, execução de cenários de aceitação, testes contra banco real descartável e validação do aplicativo Electron. A autoria por IA não muda a necessidade de demonstrar requisitos; aprovar código e testes produzidos juntos só é convincente quando há critérios de aceitação preservados fora da interpretação daquela implementação.

### Cited Findings

- O NIST SSDF recomenda incorporar práticas de desenvolvimento seguro ao ciclo de vida, para reduzir vulnerabilidades, mitigar exploração e tratar causas recorrentes. Trata-se de referência de processo, não certificação de um CI específico. [NIST SP 800-218](https://csrc.nist.gov/pubs/sp/800/218/final).
- Mutation testing altera intencionalmente o código e observa se os testes detectam essas alterações; isso revela fragilidades que executar linhas não demonstra. [StrykerJS introduction](https://stryker-mutator.io/docs/stryker-js/introduction/).
- StrykerJS pode retornar falha quando o mutation score fica abaixo de `thresholds.break`; com `break: null`, a pontuação não interrompe o build. O command runner executa um comando de testes configurável, enquanto a análise por teste depende do suporte do runner. [StrykerJS configuration](https://stryker-mutator.io/docs/stryker-js/configuration/).
- `npm ci` exige lockfile e falha quando este diverge de `package.json`, em vez de reescrevê-lo para acomodar a divergência. [npm ci](https://docs.npmjs.com/cli/v11/commands/npm-ci/).

### Inferences

Política proposta, a calibrar com medições do projeto; números abaixo são escolhas de implantação, não limites universais publicados por NIST ou OWASP:

| Verificação | Disparo sugerido | Critério de bloqueio proposto | Evidência arquivada |
| --- | --- | --- | --- |
| Política e ferramentas | Todo PR | Checker alterado sem revisão específica; exclusão nova; teste crítico desabilitado; waiver vencido | Diff da política, versões, lista de exceções |
| Dependências reproduzíveis | Todo PR | Lockfile inconsistente; instalação falha | Node/npm/Electron, lockfile hash, log |
| Typecheck e lint | Todo PR | Erro; aviso promovido a erro no escopo definido; configuração relaxada sem autorização registrada | Logs e relatório |
| Build | Todo PR | Falha de main, preload ou renderer | Manifesto dos outputs e commit |
| Unitários e integração SQLite | Todo PR | Cenário obrigatório falha; suíte prevista não executa; dados não persistem ou corrompem | JUnit/JSON, casos executados, relatório de banco |
| Cobertura de alterações | Todo PR com código | Alvo inicial de 80% das linhas novas/alteradas; piso de branches dos módulos alterados calibrado separadamente | LCOV/JSON + diff e cálculo |
| Segurança e segredos | Todo PR + completo periódico | Segredo novo; achado SAST alto/crítico novo sem exceção válida; dependência alta/crítica nova sem análise | Relatório sanitizado, SARIF/JSON, triagem |
| Contratos críticos Electron | Mudança em main/preload/IPC + release | Renderer recebe capacidade indevida; sender inválido aceito; entrada inválida altera banco | Testes negativos e smoke Electron |
| Mutation testing | Primeiro periódico e módulos críticos; depois PRs seletivos | Queda em piso aprovado; sobreviventes relevantes sem análise | HTML/JSON dos mutantes |
| Release | Commit confiável e candidato final | Gates incompletos; assinatura falha quando exigida; artefato final não abre; atualização incompatível | Hashes, assinatura, SBOM, smoke, plano de recuperação |

Cobertura de linhas alteradas e cobertura de branches são métricas distintas. Não propor “80% de branches do diff” sem escolher ferramenta e definição capazes de calcular isso. Para regras críticas, exigir explicitamente cada caso de fronteira, mesmo quando o percentual global já passa. Não substituir testes existentes por versões mais permissivas para alcançar o limiar. Mutation testing deve começar restrito à lógica de maior risco; não inventar tempo de execução ou compatibilidade sem um piloto com o runner Electron/SQLite.

Exemplo hipotético aplicado à Agenda: trocar `inicio < ate AND fim > de` por comparações inclusivas compila e pode passar lint/build, mas passa a considerar conflito uma sessão que começa exatamente ao fim de outra. Um teste novo que copie a mesma premissa do código confirma o erro. Casos independentes devem demonstrar adjacência permitida, interseção bloqueada, alteração do próprio agendamento sem falso conflito e persistência após reabrir o banco. Critérios, fixtures e respostas esperadas precisam vir de regras aprovadas, não de outputs da nova implementação.

### Gaps

- Não medi a cobertura atual, branches críticos, runtime dos testes ou compatibilidade Stryker do Auri. Pisos definitivos e gates seletivos dependem desse piloto.
- Testes de acessibilidade, conteúdo, screenshots e jornadas detalhadas são tratados pela outra frente de pesquisa; a matriz integra esses relatórios ao gate final sem duplicar seu desenho.

## Como proteger as regras que aprovam o próprio código?

### Takeaway

O verificador também é parte da superfície de alteração. Um arquivo de CI presente no repositório não impõe bloqueio por si só; é preciso regra do servidor e proteção da política, com revisão explícita de mudanças que possam torná-la permissiva.

### Cited Findings

- OWASP descreve Poisoned Pipeline Execution: acesso ao controle de versão pode permitir manipular configuração ou scripts executados no CI; o risco inclui ferramentas e configuração de análise. [OWASP CICD-SEC-4](https://owasp.github.io/www-project-top-10-ci-cd-security-risks/CICD-SEC-04-Poisoned-Pipeline-Execution).
- `CODEOWNERS` pode exigir revisão de arquivos quando associado a proteção apropriada. O próprio `CODEOWNERS` deve ter dono; havendo vários donos na mesma regra, aprovação de qualquer um basta. [GitHub code owners](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-code-owners).
- Regras GitHub permitem required checks, descarte de revisões antigas, validação da atualização mais recente e aplicação das restrições a administradores. Checks obrigatórios aceitam resultados `successful`, `skipped` ou `neutral`; a origem do status pode ser limitada a um GitHub App. [GitHub protected branches](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches).
- Rulesets privados são disponibilizados em GitHub Pro, Team e Enterprise Cloud. Pessoas com permissão administrativa/edição de regras podem alterar a política, e rulesets admitem atores com bypass. [GitHub rulesets](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/about-rulesets).
- Autores não podem aprovar o próprio PR. [GitHub required reviews](https://docs.github.com/en/pull-requests/how-tos/review-pull-requests/approving-a-pull-request-with-required-reviews).

### Inferences

Proposta concreta para `main`: exigir PR e checks nomeados, validar contra a base atual, bloquear force push/deleção, desabilitar bypass rotineiro e incluir administradores quando aplicável. Cadastrar os checks após sua execução real; uma lista de nomes em documentação não os torna obrigatórios. Um tag `v*` criado de um commit arbitrário não deve ser suficiente para publicar.

Tratar como política sensível `.github/**`, `package.json`, lockfile, configuração TypeScript/lint/testes, scripts de verificação, regras SAST, exclusões de cobertura, fixtures de aceitação, snapshots aprovados e waivers. Mudança legítima pode ocorrer, mas deve mostrar motivo, impacto sobre a evidência e revisão. Evitar atualizar screenshots, assertions e implementação no mesmo passo sem inspecionar o que deixou de ser validado.

Criar um check final que sempre rode, exija `success` dos checks aplicáveis e confira relatórios/cenários esperados. Gates seletivos devem justificar “não aplicável” com classificação calculada por política confiável; `skipped` não pode significar automaticamente qualidade validada. Proibir `continue-on-error` nos gates e scripts que engolem o exit code. Limitar a origem do status é útil, mas não impede um workflow do próprio PR de publicar resultado verde por meio do mesmo GitHub Actions.

Exemplo de lógica do job agregador, sem prometer YAML pronto: obter da política aprovada a lista de verificações exigidas para o diff; exigir resultado `success` em cada uma; validar presença dos relatórios e IDs dos cenários obrigatórios; falhar se um resultado exigido for `skipped`, `neutral`, `cancelled`, ausente ou `failure`. Para E2E seletivo, a política pode concluir que não se aplica, mas deve produzir decisão auditável; para lint, typecheck e testes básicos, a proposta é executar em todo PR. O agregador precisa de execução incondicional após suas dependências; o estado dele sozinho não substitui a inspeção desses resultados.

Para maior independência, executar regras e suites de aceitação a partir da versão aprovada da base ou de workflow/template com referência imutável em repositório administrado separadamente. Separar política confiável do código candidato. Incluir políticas no `npm test` do PR não é suficiente: scripts e runners ali também podem ser alterados. No projeto pequeno, começar com revisão explícita dos arquivos sensíveis e fixtures aprovadas; criar infraestrutura externa somente se o risco e a capacidade de manutenção justificarem.

Com um único mantenedor, exigir uma aprovação humana adicional pode bloquear todos os próprios PRs. Opções honestas: checks obrigatórios com zero aprovação adicional para o trabalho solo e revisão manual documentada da release; incorporar outro revisor humano para alterações críticas; ou submeter candidatos a ambiente protegido com aceite do mantenedor, quando o plano oferecer esse recurso. Autorrevisão e um segundo modelo ajudam, mas não constituem segregação humana. Não criar conta/bot para produzir aprovação fictícia. Se a IA usa a credencial administrativa do mantenedor, o servidor não consegue distingui-la dele; restringir credenciais e não lhe dar poderes de editar regras/publicar é parte do desenho.

### Gaps

- Não verifiquei plano, ownership pessoal/organização, rulesets, bypass list ou apps reais do repositório. A aplicação exata depende dessas informações.
- A definição ideal de check final precisa contemplar quais PRs exigem E2E completos e quais relatórios já podem ser exportados pelos scripts existentes.

## Que ferramentas fazem sentido para um repositório privado pequeno?

### Takeaway

Começar pelo conjunto nativo de testes e build, adicionar scanner de segredos e SAST/SCA com critérios explícitos, e escolher no máximo um painel principal. SonarQube Cloud Free pode atender um privado pequeno; Semgrep CE atende verificação local/CI sem conta, mas não inclui automaticamente os recursos comerciais de alcance de dependências.

### Cited Findings

| Opção | Capacidade documentada | Restrição relevante |
| --- | --- | --- |
| GitHub + ferramentas no CI | Dependabot alerts, security/version updates e dependency graph/SBOM estão entre recursos disponíveis sem comprar Code Security/Secret Protection | Os controles premium privados dependem de elegibilidade e licença. [GitHub security features](https://docs.github.com/en/code-security/getting-started/github-security-features) |
| GitHub Code Security e Secret Protection | Code Security oferece code scanning/CodeQL; Secret Protection oferece ferramentas de segredos | Privados de organizações elegíveis requerem o produto contratado; não presumir inclusão no Pro pessoal. [GitHub security quickstart](https://docs.github.com/en/code-security/getting-started/quickstart-for-securing-your-repository) |
| SonarQube Cloud Free | Até 50k LOC privados, cinco membros; análise principal e PRs para main | Branches adicionais, gates e perfis customizados dependem de planos superiores. A tabela atual separa também os produtos Advanced SAST/SCA. [Sonar Cloud plans](https://docs.sonarsource.com/sonarqube-cloud/administering-sonarcloud/managing-subscription/subscription-plans) |
| SonarQube Server | Painel próprio e integração com plataformas CI/PR | Community Build é livre; análise de branches/PR é característica da edição Developer ou superior, além do custo operacional de hospedar. [Sonar downloads](https://www.sonarsource.com/products/sonarqube/downloads/) |
| Semgrep CE | Scanner e regras próprios, executáveis no CI; scans locais sem exigir conta | `semgrep scan` não falha por achados por padrão: usar `--error` e verificar erros do scanner. [Semgrep CLI](https://docs.semgrep.dev/cli-reference/); [Semgrep CE in CI](https://docs.semgrep.dev/deployment/oss-deployment) |
| Semgrep Supply Chain | SCA, classificação de alcance, inventário/SBOM e políticas | Capacidade comercial separada do scanner CE; cobertura varia por linguagem, CVE e condições. [Semgrep Supply Chain](https://docs.semgrep.dev/semgrep-supply-chain/overview); [Semgrep usage](https://semgrep.dev/docs/usage-limits/) |
| Gitleaks | Scanner CLI de segredos em histórico/arquivos | Ferramenta configurável: exclusões e baselines também precisam de proteção. [Gitleaks project](https://github.com/gitleaks/gitleaks) |

### Inferences

Para Auri, a escolha inicial com menor operação própria é expandir o CI existente, preservar `npm test` do projeto e rodar um scanner local de segredos mais um SAST configurado. Avaliar SonarQube Cloud Free quando LOC e revisão de privacidade permitirem; ele oferece painel útil sem montar servidor. Semgrep CE pode concentrar regras específicas Electron/IPC, desde que o conjunto de regras fique versionado/protegido. Sem necessidade demonstrada, não operar Sonar self-hosted nem empilhar três painéis com findings repetidos.

Scanner que apenas imprime achados não é gate. Publicar relatórios e aplicar exit code/política são responsabilidades distintas. Disponibilidade da ferramenta fora do GitHub é diferente de permissão para executar CodeQL comercialmente ou enviar SARIF à aba de code scanning privada; não recomendar contornar a licença. Tokens de serviços de análise precisam ser mínimos e não expostos a execução arbitrária do PR.

### Gaps

- Preços, licenças contratadas e orçamento de minutos não foram verificados; não há estimativa de custo baseada em planos presumidos.
- Não medi LOC com a definição comercial do Sonar nem avaliei saída de código privado para serviços externos.

## Como tratar baseline, vulnerabilidades e exceções sem aceitar dívida nova?

### Takeaway

Bloquear piora nova e manter o passivo antigo visível permite implantação gradual. Baseline não elimina risco, e “não alcançável” é evidência de priorização sujeita a limites de análise, não prova universal de ausência de exploração.

### Cited Findings

- Sonar PR analysis usa métricas de código novo; problemas em linhas antigas ou no nível do arquivo podem ficar fora do PR e aparecer na análise completa após merge. [Sonar PR analysis](https://docs.sonarsource.com/sonarqube-server/discovering/code-analysis/pull-request-analysis.md).
- `npm audit --audit-level` define o nível que provoca falha; o comando contempla advisories de dependências. `npm audit fix` executa instalação e pode alterar a árvore. [npm audit](https://docs.npmjs.com/cli/v11/commands/npm-audit/).
- Semgrep Supply Chain distingue achados alcançáveis, não alcançáveis e sem análise de alcance. Condições ambientais nem sempre são decididas automaticamente e requerem avaliação manual. [Semgrep Supply Chain overview](https://docs.semgrep.dev/semgrep-supply-chain/overview).
- Semgrep aceita baseline por commit e suppressions `nosem`; sua CLI oferece parâmetros para controlar esses comportamentos. [Semgrep CLI reference](https://docs.semgrep.dev/cli-reference/).

### Inferences

Política proposta: segredo novo bloqueia; segredo confirmado deve ser revogado/rotacionado, não somente apagado do arquivo. SAST alto/crítico novo e dependência alta/crítica introduzida ou tornada alcançável bloqueiam sem waiver aprovado. Achado antigo com exploração plausível alta não pode esperar indefinidamente por limpeza gradual: abrir correção com responsável/prazo e decidir release pelo risco. Scanner indisponível ou relatório vazio inesperado significa evidência ausente, não resultado limpo.

Registrar exceção granular com `id do finding`, ferramenta, pacote/versão ou regra/arquivo, justificativa, risco residual, mitigação, aprovador, dono, data de expiração e issue de correção. Prazo inicial sugerido: 30 dias para exceções não urgentes, reavaliado pelo risco. Não autorizar “ignorar todos high”, excluir pasta completa ou baixar limiar. Mudança de scanner/ruleset exige recalibração revisada; aumento de achados por atualização de regra é diferente de vulnerabilidade introduzida pelo PR.

Fazer scan completo em main e periodicamente, pois um novo advisory pode afetar uma dependência que não mudou. Comparar PR e base com mesmas ferramentas/regras quando possível, mantendo inventário total. Separar dependências embarcadas e de desenvolvimento para triagem, mas recordar que uma dependência dev executada no build pode comprometer o artefato. `--omit=dev` isolado não avalia essa cadeia de construção. Não aplicar `npm audit fix` dentro do gate: a validação deve medir o commit, e remediação merece alteração revisável.

### Gaps

- Não houve scan atual; não existe classificação confirmada de vulnerabilidades do Auri nesta pesquisa.
- SLAs e severidades definitivos dependem da distribuição do aplicativo, dados armazenados e ameaças pertinentes.

## Como separar CI de PR, publicação confiável e recuperação?

### Takeaway

Todo código candidato precisa executar em ambiente sem privilégios de produção. Release exige origem confiável, evidência do commit final e verificação do binário distribuído; reinstalar uma versão anterior não desfaz alterações de dados SQLite.

### Cited Findings

- GitHub recomenda mínimo privilégio de token, cuidado com código não confiável, pinagem imutável de actions e revisão de terceiros. Workflows privilegiados e runners próprios ampliam consequências de checkout/executar conteúdo de PR. [GitHub secure use](https://docs.github.com/en/actions/reference/security/secure-use).
- O uso de `pull_request_target` para checkout/build/test da cabeça do PR pode conceder execução de código não confiável em contexto privilegiado. [GitHub pull_request_target](https://docs.github.com/en/actions/reference/security/securely-using-pull_request_target).
- `ignore-scripts` desabilita lifecycle scripts de instalação, mas comandos explícitos como `npm test`/`npm run` ainda executam o script solicitado. [npm ci options](https://docs.npmjs.com/cli/v11/commands/npm-ci/).
- Electron recomenda isolamento de contexto/sandbox, restrição de navegação e APIs expostas, CSP e validação do sender de IPC. [Electron security checklist](https://www.electronjs.org/docs/latest/tutorial/security).
- Assinatura de código autentica a distribuição e se integra às proteções Windows/macOS; notarização faz parte do fluxo macOS descrito pelo Electron. [Electron code signing](https://www.electronjs.org/docs/latest/tutorial/code-signing).
- SLSA build track aumenta confiança na origem do build. Attestations relacionam artefato, origem e instruções; não garantem segurança do código, e a verificação é necessária para obter benefício. [SLSA build track](https://slsa.dev/spec/v1.2/build-track-basics); [GitHub artifact attestations](https://docs.github.com/en/actions/concepts/security/artifact-attestations).
- GitHub attestations privadas/internas requerem Enterprise Cloud. [GitHub attestation availability](https://docs.github.com/en/enterprise-cloud%40latest/actions/how-tos/secure-your-work/use-artifact-attestations/use-artifact-attestations).
- SQLite Online Backup API permite criar snapshot consistente do banco; uma cópia externa ingênua durante atividade não oferece as mesmas garantias. [SQLite backup API](https://www.sqlite.org/backup.html).

### Inferences

CI de PR: token com `contents: read` como padrão; checkout sem persistir credencial quando possível; nenhum certificado de assinatura, segredo de produção ou `id-token: write`; runner descartável; actions auditadas e fixadas por SHA completo; `npm ci` com versão de runtime fixada. Instalar dependências e rodar scripts é executar código. `--ignore-scripts` ajuda em um job de análise separado, mas não é configuração pronta para todo o build Auri: Electron e módulos nativos podem precisar de instalação/rebuild explícitos. Validar um allowlist/prática compatível em piloto e preservar o runner do projeto.

CD: aceitar commit em branch confiável com gates concluídos, produzir candidato ligado a SHA e executar smoke do candidato final. Publicar o mesmo artefato validado, verificando hash e origem; não reconstruir outro pacote no passo de publicação. Permissões de escrita/segredos apenas no job necessário. Certificados de assinatura e publicação ficam fora do contexto PR. Hash sem assinatura ajuda a detectar troca acidental, mas não autentica origem sozinho.

Prioridade prática: manifesto com SHA/hash/versões e retenção dos relatórios; SBOM do aplicativo/release; assinatura do binário por plataforma conforme a distribuição; proveniência verificável quando infraestrutura/plano comportarem. Não vender export do dependency graph como inventário completo do Electron/Chromium, biblioteca nativa e instalador: definir escopo do SBOM e complementar os componentes realmente distribuídos. Assinatura e proveniência evidenciam identidade/origem; não substituem testes de comportamento.

Critérios Electron específicos: negar IPC de origem inesperada, validar payload no main mesmo com validação no renderer, expor API estreita no preload, impedir acesso arbitrário ao filesystem/shell e preservar configurações seguras da BrowserWindow. Revisão automatizada de padrões ajuda, porém um teste negativo de sender e smoke Electron fornecem evidência adicional. O E2E atual informado pelo inventário executa Electron de `node_modules` com o app compilado, portanto o gate de release proposto precisa testar também `.app`/`.exe`/instalador real; não tratar esse teste como já existente.

Mudança SQLite: validar esquema antigo → novo em fixture descartável, integridade, retenção dos registros e reabertura. Backup consistente antes de transformação real; plano para restaurar e reconciliar registros posteriores ao backup. Preferir mudanças aditivas quando viáveis. Se a versão antiga não lê o esquema novo ou houve remoção de dados, retornar o executável não restaura o estado. A recuperação pode exigir correção para frente ou restore com perda/reconciliação de gravações. Não copiar banco ativo com `cp` e chamar isso de rollback testado.

### Gaps

- Assinatura, backup automático, esquema, canais de atualização e compatibilidade entre versões não foram auditados. São requisitos de proposta, não controles confirmados.
- A disponibilidade de environments/reviewers em privados também depende do plano; não prometo o recurso sem verificá-lo.

## Como transportar a política ao Azure DevOps?

### Takeaway

Os comandos de validação devem continuar portáveis; o servidor impõe quem pode integrar e usar credenciais de publicação. Azure DevOps oferece checks de recursos separados do YAML, uma distinção relevante para impedir que alterações do próprio PR modifiquem a aprovação do ambiente.

### Cited Findings

- Azure Repos oferece políticas de branches, validação por build e revisores obrigatórios, com opções para impedir aprovação pelo solicitante e revisar mudanças novas. [Microsoft branch policies](https://learn.microsoft.com/en-us/azure/devops/repos/git/branch-policies?view=azure-devops).
- Approvals/checks de recursos Azure Pipelines não são definidos no YAML e são administrados pelo dono do recurso; incluem branch control e required template. O autor do YAML não modifica esses checks somente editando o pipeline. [Microsoft approvals and checks](https://learn.microsoft.com/en-us/azure/devops/pipelines/process/approvals?view=azure-devops).

### Inferences

Manter scripts de validação e relatórios JUnit/LCOV/SARIF no repositório, com invocação equivalente por GitHub Actions ou Azure Pipelines. No Azure, configurar build validation obrigatório na branch e revisão por caminho de arquivos sensíveis; administrar permissões de bypass com precisão. Separar pool de PR e pool/job que usa service connection ou secure files. Ambiente/recurso protegido exige branch confiável e, se necessário, template controlado em repositório separado. Um administrador que possa editar ambas as políticas continua sendo autoridade final; a proteção não elimina esse limite.

### Gaps

- Não se configura Azure DevOps para Auri nesta pesquisa. As equivalências propostas não são afirmação de infraestrutura atualmente existente.

## Revisão por outra IA é suficiente?

### Takeaway

Usar outro modelo como revisão consultiva pode encontrar falhas, mas não estabelece uma garantia de segurança ou de fidelidade ao produto. A autoridade para mudar a regra de negócio e liberar uma release crítica deve permanecer explícita, acompanhada de evidências reproduzíveis.

### Cited Findings

- GitHub documenta que a revisão Copilot pode perder problemas, gerar falsos positivos e sugerir código incorreto/inseguro; recomenda revisão humana e testes. [GitHub responsible use of agents](https://docs.github.com/en/copilot/responsible-use/agents).
- Na documentação atual, Copilot não conta como aprovação obrigatória por padrão, mas existe opção em preview para habilitar aprovações que satisfazem a regra. Logo, a governança deve decidir explicitamente como tratar esse recurso. [GitHub Copilot approvals](https://docs.github.com/en/copilot/concepts/agents/code-review).
- O perfil NIST SP 800-218A é dirigido ao desenvolvimento de modelos/sistemas de IA; não deve ser apresentado como norma específica que exige determinado gate para qualquer aplicação escrita com assistente de código. [NIST SSDF project](https://csrc.nist.gov/projects/ssdf).

### Inferences

Proposta: IA pode sugerir código, gerar casos adicionais, revisar diff e ajudar na triagem; resultados permanecem consultivos. Não considerar a aprovação automática de modelo a segunda aprovação humana. Toda alteração deve informar cenário, resultado esperado, áreas afetadas, evidências e mudanças de regra/contrato. Para mudança crítica, o responsável compara com critérios de aceitação preservados e valida o candidato. O teste de segurança da política inclui propor um erro controlado e confirmar que o CI bloqueia: tirar assertion relevante, inverter comparação de intervalo ou desabilitar teste crítico em branch descartável deve produzir falha, sem publicar nada.

Fazer isso gradualmente: primeiro PR gates e proteção efetiva; depois cobertura/contratos críticos/conteúdo; então mutations seletivas e release final com cadeia de evidência. Esta ordem permite observar bloqueios reais antes de investir em dashboard ou atribuir selo de “garantia de IA” ao processo.

Prioridade enxuta proposta: fase 1, levar as verificações existentes para PR/main, incorporar lint/typecheck/segredos e configurar a regra de merge com job agregador; fase 2, estabilizar critérios independentes, cobertura e contratos críticos SQLite/IPC/jornadas/conteúdo, pilotando mutation testing apenas onde traz sinal; fase 3, validar o pacote final por plataforma, restringir publicação, guardar SBOM/hashes/assinaturas e testar recuperação de dados. Sonar, Semgrep comercial e proveniência avançada entram conforme necessidade demonstrada e disponibilidade real, não como pré-condição para começar.

### Gaps

- Não há evidência nesta pesquisa de que dois modelos produzam falhas estatisticamente independentes ou de que a soma deles certifique segurança. Não atribuir porcentagem de redução de risco sem estudo aplicável e medição do projeto.
