# Validação de qualidade do Auri

A primeira etapa valida cada PR e push em `main`, além de execuções manuais e semanais.
O check final **`quality`** só aprova se política, Windows, macOS e segurança terminarem
com sucesso e as evidências esperadas estiverem presentes. O workflow Build depende desse
resultado antes de gerar os instaladores. Nenhum desses jobs publica versões ou usa certificados.

## Executar localmente

```bash
npm ci                  # instala e recompila SQLite para a versão do Electron
npm run quality         # formato, lint, guardião, testes, build, Electron e segurança
npm run quality:validate # revalida as evidências sem executar tudo novamente
```

A saída fica em `.quality/`, ignorada pelo Git. O scan local de segredos inclui arquivos
versionados e arquivos novos não ignorados, sem pesquisar pastas pessoais. No CI, o Gitleaks
verifica todo o histórico Git disponível. Seu binário tem versão e SHA-256 fixos; o scan
redige os valores encontrados. Falha de download, hash, scanner ou registry reprova o job.

`npm run check` executa formato, lint e análise de tipos com **Vite+** (`vp check`).
Build Electron, testes, regras de Oxlint e opções de Oxfmt ficam juntos em `vite.config.ts`.
Os comandos individuais são `format:check`, `lint:ci`, `test:quality`, `test:ci`,
`test:e2e` e `security:check`. `npm test` executa o CLI `vp test` no Node embutido no Electron;
usar `vp test` diretamente no Node do sistema não garante a ABI do `better-sqlite3`.
Os imports dos testes usam `vite-plus/test`, com o Vitest fornecido pelo Vite+.
O build segue via `electron-vite`, mantendo os alvos main/preload/renderer e sua compatibilidade
com Vite 7. `electron.vite.config.ts` é apenas um adaptador que reexporta a configuração central:
o electron-vite rejeita o nome padrão `vite.config.ts` como arquivo de configuração direto.
Vite+ fornece as demais ferramentas pelo arquivo central.
Use Node **22.18+** na linha 22 ou **24.11+** na linha 24, conforme `engines` do projeto.
A validação exige os testes do inventário e os cenários de `cenarios.json`;
não compara apenas a quantidade de testes. Teste novo pulado, todo, duplicado, relatório
antigo, SHA/plataforma incorretos ou zero testes reprovam. Retries automáticos não estão habilitados.
No CI, alteração dos arquivos do checkout durante instalação/testes também reprova a evidência.
Localmente o relatório indica alterações ainda não commitadas; esse resultado não equivale
a um check remoto aprovado no commit publicado.

## Critérios de bloqueio

| Controle           | Aprovação                                                                           |
| ------------------ | ----------------------------------------------------------------------------------- |
| Formato e lint     | Nenhum erro; lint sem avisos                                                        |
| TypeScript e build | Ambos concluídos no `npm run build`                                                 |
| Testes             | Inventário completo; todos aprovados ou skip de integração explicitamente permitido |
| Cenários           | Todas as evidências de cada ID aprovadas                                            |
| Electron           | Primeira abertura, IPC, SQLite, backup/restore e importação de configurações        |
| Dependências       | Nenhuma vulnerabilidade alta/crítica; moderadas registradas no relatório            |
| Segredos           | Nenhum finding; scanner e download também precisam concluir                         |
| Resultado final    | Jobs em `success`, relatórios completos e SHA/run/tentativa corretos                |

Os únicos skips permitidos estão no inventário, com plataforma e motivo. A verificação de
assinaturas Windows é obrigatória no Windows; os downloads de provedores ficam no Build
manual/tags, fora do PR. O catálogo cobre o que já é executado; não afirma cobertura completa
de formulários, acessibilidade ou apresentação. Horários 07–20 seguem como contrato da UI;
esta etapa não muda a regra do main/rede.

## Alterar testes ou a própria proteção

A revisão do SHA vale só para o que pode **afrouxar** a proteção. No PR, o verificador é
carregado do commit base, antes de instalar dependências, e decide arquivo por arquivo
(`needsReview` em `scripts/quality/checks.mjs`):

| Mudança                                                                                       | Revisão do SHA                     |
| --------------------------------------------------------------------------------------------- | ---------------------------------- |
| `.github/`, `scripts/`, `vite.config.ts`, tsconfig, lint, `electron-builder.yml`, IPC         | Sempre                             |
| JSON de `docs/qualidade/` (inventário, cenários, cobertura, mutação, gates, SAST, desempenho) | Só se remover ou alterar algo      |
| `package.json` fora de `version`, `dependencies` e `devDependencies`                          | Sempre (ex.: `scripts`, `engines`) |
| Fixture histórica alterada ou removida, `gitleaks.toml`                                       | Sempre                             |
| Arquivos `.test.*` (novos, alterados, renomeados ou removidos) e código comum                 | Não                                |
| `package-lock.json`, versão e dependências no `package.json`                                  | Não (o job security audita)        |
| Referências visuais, textos `.md` e fixture nova                                              | Não (aparecem no diff do PR)       |

Acrescentar ao JSON (teste, cenário, mutação, fonte de cobertura, regra de SAST, módulo crítico)
não pede revisão: listas só podem ganhar itens idênticos aos novos, e itens existentes precisam
continuar idênticos; um `reason` novo num teste ou um número de mínimo trocado já conta como
alteração. Nesse caso as expectativas do candidato substituem as da base na própria execução.
Teste é livre porque o inventário obrigatório vem da base: remover, renomear ou pular um teste
listado reprova sem a revisão que reduziria o inventário, e nos módulos de `mutacoes.json` a
mutação reprova assertion enfraquecida. Fica aceito o risco de enfraquecer a assertion de um
teste fora desses módulos sem revisão; registre teste novo no inventário para protegê-lo.

Quando a revisão é exigida, publique uma revisão GitHub **COMMENTED** ou **APPROVED**, de alguém
com permissão write/maintain/admin, no commit exato, com o corpo:

```text
quality-policy-reviewed: SHA_COMPLETO_DO_HEAD_DO_PR
```

O workflow **Revisão da política** (`revisao.yml`) reexecuta o Qualidade desse commit sozinho
quando a revisão chega; não precisa mais de "Re-run all jobs".

Na interface de revisão do PR, escolha **Comment** quando você for o autor, confira o diff e
registre a razão da mudança fora dessa revisão de corpo exato (na descrição do PR, por exemplo).
A nova tentativa sai pelo workflow **Revisão da política**.
Um novo commit exige nova revisão; comentário comum na conversa
não conta. Não publique essa revisão automaticamente por IA. Compare assertions, skips,
globs, exclusões, dependências e resultados anteriores/novos antes de registrar a revisão.

O agregador e o scanner usam a versão do verificador da base. Uma expectativa atualizada só
entra no artefato de política após revisão do SHA. Alteração no código do verificador passa
pelo verificador antigo no PR e pelo novo no push em main. A adoção inicial já foi integrada. A ausência da base
agora reprova a execução, sem copiar silenciosamente o verificador candidato.

CODEOWNERS encaminha mudanças sensíveis ao mantenedor. Para mantenedor solo, a proteção exige
PR/checks sem pedir outra aprovação humana impossível de fornecer. Essa política não impede
um administrador de alterar regras, nem substitui revisão independente quando disponível.
O próprio workflow pode ser alterado por quem tem poder para integrar: restrição remota e
revisão continuam necessárias, mesmo usando verificador da base.

## Ativar a barreira no GitHub

A inspeção em 14/10/2026 encontrou `main` sem proteção e nenhum ruleset. Criar YAML local
não muda esse estado. Depois de publicar estes arquivos e obter **quality aprovado no HEAD
remoto de main**, execute:

```bash
npm run quality:protect
```

Esse comando administrativo verifica o check do GitHub Actions no SHA atual, exige que não
haja proteção anterior a preservar, aplica a regra e consulta o servidor novamente. A regra
exige PR, check `quality` do GitHub Actions (sem exigir a branch atualizada com `main`: o
push em `main` roda o Qualidade de novo), conversas resolvidas e aplicação
a administradores; proíbe force push e deleção. Não faz commit/push. Requer permissão admin,
GitHub CLI autenticado e plano que permita proteção em repositório privado; falha de licença
ou permissão não é contornada. Se já houver regra, revise-a separadamente em vez de sobrescrevê-la.

## Evidências e testes do bloqueio

O CI mantém por 14 dias JSON/JUnit dos testes, metadados de execução, capturas/resultados do
Electron, relatórios de dependências e segredos redigidos, política usada e resumo final.
Cenários de testes de `scripts/quality/checks.test.mjs` provocam remoção de teste, skip novo,
zero testes, relatório antigo, SHA errado, job skipped/neutral/cancelado e finding alto;
todos precisam impedir aprovação. Mudanças nesse guardião são sensíveis como as demais.

`docs/qualidade/fixtures/v1.sql` é um schema histórico com dados fictícios congelado nesta
adoção. Não o gere novamente usando as migrations candidatas. Seus testes conferem registros,
integridade, reabertura e recusa de versão futura sem mudança no arquivo. Adicione fixtures
históricas quando houver novas versões publicadas, mantendo as anteriores.

## Validações ampliadas

`npm run quality` inclui cobertura de todas as fontes TS/TSX, os testes de proteção,
E2E de integração, jornadas pela interface, mutação, pacote executável e segurança.
`npm run quality:validate` revalida esse conjunto completo, incluindo audit e segredos.
O CI usa Node 24.15.0 e o npm que vem com ele.
A configuração de formato, lint, testes e cobertura continua em `vite.config.ts`.

- `cobertura.json` registra o inventário das fontes de produção, a referência global medida
  e mínimos por módulo crítico. Arquivos não importados continuam visíveis com cobertura zero.
  A cobertura global ainda é baixa porque a interface e o processo principal são exercitados
  também por E2E; isso não é contado como cobertura unitária. Não reduza mínimos para liberar PR.
- `gates.json` exige as jornadas de formulário, validação de datas, busca sem acento,
  cancelamento, erro real de gravação, conflitos, exclusão confirmada, tema e reabertura.
  Os dados e perfis usados são fictícios/temporários; o teste confere o caminho de userData
  antes de gravar. O preload e a interface não são substituídos por mocks nessas jornadas.
- Axe verifica os estados críticos em WCAG A/AA, e o teclado é usado nos controles compostos.
  A integração usa o modo compatível com Electron e recusa iframes; isso não substitui uma
  avaliação com VoiceOver/NVDA.
- As referências PNG por sistema ficam em `visual/`. A data é fixa, as fontes são as do app,
  a área tem 1024×640 pixels e animações/avisos transitórios são retirados das comparações.
  A troca do tema precisa aparecer no CSS antes da captura. O diff e a razão de pixels alterados
  ficam nos artefatos, com tolerância de 0,1% e comparação de antialiasing.
- `mutacoes.json` lista erros deliberados nas regras de agenda, CPF, compatibilidade do banco
  e isolamento IPC. Todos devem ser detectados por assertions; erro de importação não conta.
  A execução usa uma cópia temporária e o runtime Electron, preservando o checkout original.
  Esse catálogo mede os erros selecionados; não representa mutação exaustiva de todo o sistema.
- O pacote real `.app`/`.exe` precisa abrir o SQLite, criar dados pela interface, reabrir
  e ler o banco histórico v1. O ASAR não pode conter fontes, scripts, políticas ou pesquisas.
  No Build de distribuição, o DMG da arquitetura atual é montado somente para leitura,
  ou o NSIS é instalado em pasta temporária no runner descartável; os mesmos testes abrem
  o aplicativo distribuído. O relatório inclui o SHA-256 do instalador.
- Tags precisam corresponder à versão do `package.json` e só geram distribuição quando
  apontam para o HEAD de `main` com Qualidade aprovado
  naquele push. Build manual continua gerando artefatos para validação, sem publicar release.
  Ver "Release e atualização automática".

## Revisar referências visuais

A atualização de imagens é uma operação de revisão, sem aprovação automática. No Mac:

```bash
AURI_UPDATE_VISUAL=1 npm run test:ui
```

As imagens propostas ficam em `.quality/ui/reference/<plataforma>/`. Para as dos dois sistemas,
depois do push da branch:

```bash
gh workflow run referencias-visuais.yml --ref NOME_DA_BRANCH
npm run visual:aceitar
```

O workflow **Referências visuais** só captura e guarda as imagens como artefato; não aprova
nada (o agregador continua reprovando o modo de referência). `visual:aceitar` confere que as
capturas são do commit atual e copia para `docs/qualidade/visual/`. Inspecione o diff das
imagens antes do commit, que passa pelo Qualidade normal sem revisão do SHA. Uma IA não deve
atualizar referências para esconder regressões.

## Integridade e distribuição

A adoção inicial já aconteceu. A ausência da base aprovada agora reprova a execução;
o bootstrap automático foi removido. O CI testa o verificador aprovado antes de usá-lo,
além de testar o verificador candidato. Os artefatos precisam corresponder ao commit,
sistema operacional e tentativa atuais; remover uma jornada, mutação ou fonte de cobertura
impede a aprovação. Mudanças nas políticas e referências continuam exigindo revisão do SHA.

O que exige revisão está em "Alterar testes ou a própria proteção".

O que o PR precisa rodar também vem do verificador da base, pelas saídas do job `policy`:

- Empacotar e testar o pacote (`build:unpack`, `test:package`, `quality:delivery`) só quando o
  PR toca o que vai no pacote: `src/main`, `src/preload`, `src/shared`, dependências,
  `electron-builder.yml`, `build/`, `resources/`, configuração do Vite, `scripts/` ou
  `.github/`. Push em `main`, execução manual e semanal sempre empacotam.
- A mutação roda só no macOS: os erros dirigidos não dependem do sistema.

Sem essas saídas (verificador anterior) o workflow roda tudo, como antes. O `node_modules`
fica em cache por sistema e lockfile; o `npm ci` só roda quando o lockfile muda.

A proteção da branch precisa ser ativada somente depois do sucesso remoto em Windows e macOS.
O arquivo do workflow ainda pode ser alterado por quem administra o repositório; revisão
independente e um workflow obrigatório gerenciado externamente são controles adicionais
quando houver essa estrutura. A revisão vinculada ao commit não deve ser publicada automaticamente
por IA, e CODEOWNERS sozinho não torna uma revisão obrigatória.

O pacote macOS usa assinatura ad-hoc consistente; Developer ID/notarização e certificado
Windows continuam dependendo de credenciais do responsável pela distribuição. Esta configuração
não publica uma versão pública nem afirma que um certificado ad-hoc identifica o fabricante.
Os testes abrem somente a arquitetura nativa do runner; outros alvos gerados precisam de
execução em hardware correspondente antes de prometer compatibilidade. Performance e avaliação
manual com leitores de tela continuam tendo evidências próprias.

## Release e atualização automática

1. Suba a versão num PR comum (sem revisão do SHA): `npm version minor --no-git-tag-version`.
2. Com o PR integrado e o Qualidade aprovado no push de `main`, em `main` atualizado:
   `npm run release`. O script confere as mesmas regras do Build e envia a tag `vX.Y.Z`.
3. O Build não repete o Qualidade: o job `origem aprovada` exige o Qualidade aprovado no push
   desse commit. Em cada sistema ele testa os instaladores oficiais das nuvens, gera o
   instalador, testa o aplicativo instalado e roda o E2E (no Windows com a instalação real do
   Google Drive). O job `release` publica a release da tag com `.exe`, `.dmg` e `latest*.yml`, e o
   job `atualização` leva os mesmos arquivos ao GitHub Pages.

O Auri instalado no Windows procura versão nova 30 s depois de abrir e a cada 4 horas, baixa
sozinho e instala ao sair ou por Configurações › Atualizações ("Reiniciar e atualizar"). Como
os dois computadores conectados precisam estar na mesma versão, isso evita o estado "versões
diferentes" da Conexão. No Mac a troca automática exige app assinado: lá a tela mostra a
versão e a nova é instalada por cima.

Este repositório é privado, então o Auri instalado procura versões no GitHub Pages dele
(`https://guilhermebrun.github.io/auri/`, em `publish` do `electron-builder.yml`), que é
público. O job `atualização` do Build publica lá, só com o token do próprio workflow, o
`.exe`, o `.dmg`, os `.blockmap`, o `latest.yml` e uma página de download. Fica só a versão
atual. Nenhum token vai dentro do app nem em secret. O ambiente `github-pages` aceita a branch
`main` e as tags `v*`. Instaladores gerados antes desta mudança não se atualizam sozinhos:
instale uma vez a primeira versão publicada pelo Build. Sem certificado, o Windows ainda
mostra o aviso do SmartScreen ao instalar à mão; a atualização automática não passa por ele.

## Dependências moderadas em 14/10/2026

O audit registra oito entradas moderadas decorrentes do mesmo advisory
[GHSA-hp3w-g68c-fv3c](https://github.com/advisories/GHSA-hp3w-g68c-fv3c),
na cadeia `electron-builder → @electron/get → global-agent → roarr → sprintf-js`.
A versão publicada mais recente de `sprintf-js` é 1.1.3 e o advisory não informa
versão corrigida. `npm audit fix --dry-run --ignore-scripts` não propõe atualização.
A cadeia pertence às ferramentas de empacotamento; a inspeção do ASAR deve confirmar
que essas ferramentas não acompanham o aplicativo. Achados altos/críticos continuam
bloqueantes e o audit semanal permite reavaliar quando houver correção publicada.

## Controles adicionais de código e entrega

O fluxo local e a matriz Windows/macOS agora exigem os seguintes comandos adicionais:

```sh
npm run test:coverage-changed
npm run test:performance
npm run quality:delivery
```

O job de segurança Linux também instala Python 3.12.15 e Semgrep CE 1.180.0 e executa
`npm run security:sast`. Para executar `npm run quality` localmente, instale essa versão do
Semgrep em um ambiente Python separado; o executável pode ser informado por `AURI_SEMGREP`.
O ambiente precisa ficar fora de `.quality`, que é apagada no início da validação.
Por exemplo, com Python 3.12 disponível:

```sh
python3.12 -m venv /tmp/auri-semgrep
/tmp/auri-semgrep/bin/python -m pip install semgrep==1.180.0
AURI_SEMGREP=/tmp/auri-semgrep/bin/semgrep npm run quality
```

O scanner usa somente as regras locais de `sast.json`, sem enviar métricas ou código a um serviço.
São oito regras dirigidas a isolamento Electron, código dinâmico, TLS, shell, criptografia,
HTML, capacidades do preload e remetentes IPC. Cada regra precisa detectar seu exemplo inseguro
e aceitar seu exemplo seguro antes de verificar todas as fontes de produção. Erro de parsing,
timeout, fonte omitida e achado reprovam; comentários `nosemgrep` não suprimem os resultados.
Esse conjunto dirigido não constitui uma análise completa de fluxo entre arquivos.
[Opções e limites do Semgrep CE](https://docs.semgrep.dev/cli-reference).

`cobertura.json` exige 80% das **linhas executáveis alteradas**, além dos mínimos globais e dos
módulos críticos. A comparação usa a base do PR ou o commit anterior do push; execução manual
sem alterações legítimas pode ter zero linhas e recebe 100% nesse indicador. Comentários,
tipos e linhas sem ponto executável no relatório Istanbul não entram no denominador.
A política extraída da base aprovada registra as linhas esperadas; o agregador recalcula os
resultados a partir da cobertura bruta, recusando outro SHA/base ou um percentual falsificado.
Arquivos novos, renomeações e fontes não importadas não podem desaparecer da verificação.

Os testes por propriedades usam uma seed reproduzível e mil casos gerados por execução:
datas/conversão brasileira, busca sem alteração da lista, conflitos/adjacência e autenticidade
do backup. São complementares aos exemplos existentes e aos E2E. O catálogo de mutação foi
ampliado de 13 para 17 erros dirigidos, incluindo backup, restauração, preferências e calendário.

Os componentes de data, horário e calendário têm testes DOM de conteúdo, entrada inválida,
reset de rascunho, foco e teclado. O runtime dos testes permanece o Electron por causa do SQLite
nativo; jsdom é usado somente nos arquivos de teste de componentes, dentro do mesmo `vite.config.ts`.

`desempenho.json` define dois orçamentos iniciais: JavaScript do renderer comprimido em gzip até
330.000 bytes e p95 da busca sobre 10.000 pacientes fictícios até 16 ms, com 100 amostras após
aquecimento e conferência dos resultados. A referência local macOS arm64 foi 280.460 bytes e
p95 inferior a 1 ms; o limite de tempo é um orçamento de operação, ainda sem referência medida
no Windows para esta alteração. Os limites são versionados e sua mudança exige revisão.
O benchmark transpila as funções de produção e usa o Node do Electron; não mede renderização,
abertura completa, memória ou tempo de acesso à rede.

O pacote aprovado gera `delivery/sbom.cdx.json` (CycloneDX 1.6) e um manifesto com commit,
plataforma, arquitetura, versão, hash do SBOM, ASAR e módulos nativos. O build registra os
pacotes npm presentes nos chunks do renderer, incluindo bibliotecas compiladas que não ficam
em `node_modules` no aplicativo. O inventário também lê os módulos de produção do ASAR e as
versões de Electron, Chromium, Node e V8 medidas no aplicativo aberto. As bibliotecas internas
desses runtimes e do sistema operacional não são enumeradas individualmente.

O Build executa `npm run quality:delivery -- --installer` depois do teste do instalador. O hash
do instalador e do ASAR precisam corresponder aos arquivos testados; o inventário e o manifesto
são guardados junto do artefato, sem reconstruí-lo depois. Isso não identifica o fabricante:
Developer ID/notarização, certificado Windows e publicação continuam sendo etapas externas.

O Dependabot propõe atualizações semanais de npm e GitHub Actions; essas propostas atravessam
os mesmos checks e revisão da política. Não há merge automático. Sua ativação depende de esta
configuração estar na branch padrão.

As Actions oficiais são fixadas por SHA e usam runtime Node.js 24, inclusive checkout,
setup e transferência de artefatos. Esse runtime pertence às Actions; a versão usada pelos
comandos do projeto continua explícita em `node-version`. Os jobs Linux usam `ubuntu-24.04`
para que a troca do rótulo `ubuntu-latest` não altere o ambiente sem revisão. Atualizações
precisam conferir as notas de migração, o `runs.using` da Action e os checks completos.

Notices de capacidade dos runners macOS ARM são emitidos pela infraestrutura do GitHub.
Eles podem aparecer mesmo com todos os checks aprovados e indicam possibilidade de fila.

## Recuperação diante de falhas

A restauração prepara e valida uma cópia no mesmo volume antes de fechar o banco atual, verifica
integridade/relacionamentos, aplica as migrações e confere o contrato atual de tabelas. A troca é
por rename, após checkpoint do WAL. Uma conexão externa que impede o checkpoint cancela a troca.
Falha ao promover ou reabrir repõe o arquivo anterior e não anuncia sucesso às telas.
Se também falhar o rollback, o arquivo `.previous` com os dados anteriores é preservado e o
serviço não continua atendendo sobre a base substituída; o erro informa o caminho para recuperação.
O procedimento de contingência é fechar o Auri, preservar os dois arquivos e restaurar a cópia
anterior após diagnosticar permissões, espaço e bloqueios de disco.

As preferências são gravadas em um temporário exclusivo, sincronizadas e só então substituídas
por rename. Falha de escrita parcial ou de substituição mantém os bytes e a memória anteriores.
Esses testes exercitam falhas de processo/disco; não simulam perda física do dispositivo ou
interrupção elétrica em todos os sistemas de arquivos.
