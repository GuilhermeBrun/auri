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
A validação exige os testes do inventário e os dez cenários de `cenarios.json`;
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

`.github/`, scripts, inventário, cenários, fixtures, `vite.config.ts`,
package/lockfile e arquivos `.test.*` são sensíveis. No PR, o verificador é carregado do commit
base, antes de instalar dependências. Mudança nesses arquivos exige uma revisão GitHub
**COMMENTED** ou **APPROVED** de alguém com permissão write/maintain/admin, no commit exato,
com o corpo:

```text
quality-policy-reviewed: SHA_COMPLETO_DO_HEAD_DO_PR
```

Na interface de revisão do PR, escolha **Comment** quando você for o autor, confira o diff e
registre a razão da mudança fora dessa revisão de corpo exato (na descrição do PR, por exemplo).
Depois reexecute **todos os jobs** (Re-run all jobs), para renovar as evidências da tentativa.
Um novo commit exige nova revisão; comentário comum na conversa
não conta. Não publique essa revisão automaticamente por IA. Compare assertions, skips,
globs, exclusões, dependências e resultados anteriores/novos antes de registrar a revisão.

O agregador e o scanner usam a versão do verificador da base. Uma expectativa atualizada só
entra no artefato de política após revisão do SHA. Alteração no código do verificador passa
pelo verificador antigo no PR e pelo novo no push em main. Na primeira introdução, não existe
base anterior: o job registra `bootstrap`; essa adoção inicial precisa ser conferida manualmente.

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
exige PR, base atualizada, check `quality` do GitHub Actions, conversas resolvidas e aplicação
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

## Próximas camadas

Esta entrega não inclui cobertura percentual, SAST especializado, mutação, orçamento de
performance, diff visual, axe/VoiceOver/NVDA, teste do instalador distribuído, assinatura
com certificados ou publicação automática. Esses controles exigem baselines medidos,
revisão das telas e configuração de distribuição; não há um status verde fictício para eles.
O E2E atual abre o Electron com o bundle `out`, não instala o `.app`/`.exe` do Auri.
Assinar ou voltar o executável não prova restauração dos dados; upgrade e recuperação
continuam exigindo evidência separada.
