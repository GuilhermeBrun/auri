# Identidade visual do Auri

**Grafite, sólido e retangular.** O Auri não imita nenhum sistema operacional: não usa vidro, transparência nem sombras de decoração, então fica igual no Mac, no Windows e numa página web. A identidade vem de três coisas: o grafite do ícone, a tipografia **Bricolage Grotesque** e as **três barras do logo**, que reaparecem na marca e nos estados de carregando e vazio.

Os valores ficam em `src/renderer/src/assets/main.css` (`@theme`). Use sempre os tokens, nunca cores soltas.

## Princípios

1. **Menos é mais.** Antes de acrescentar ícone, cor, borda ou rótulo, pergunte se ele informa algo. Se não informa, sai.
2. **Um único destaque.** O grafite (`accent`) marca a ação principal da tela e "hoje". Todo o resto é cinza.
3. **Plano e sólido.** Superfícies opacas, filetes finos e uma única sombra, só para o que flutua (diálogos e menus). Sem `backdrop-filter`.
4. **Tudo é retângulo de cantos arredondados.** Não há pílulas nem círculos: botões, busca, chips, "hoje" e avatares usam a mesma família de formas, com quatro raios (ver Forma). Nada de detalhes soltos nas bordas: sem barrinhas laterais em menus ou sessões.
5. **Dizer o que vai acontecer.** Botões com verbo ("Agendar", "Cadastrar paciente") e resumo antes de confirmar ("Sessão de 30 min com … na quarta-feira, 7 de outubro, das 14:00 às 14:30").
6. **Vazio convida a agir.** Lista vazia explica a situação e oferece o próximo passo; "nada encontrado" e "primeiro uso" são telas diferentes.

## Cores

| Token                                  | Valor                             | Uso                                                                                                                  |
| -------------------------------------- | --------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `accent`                               | `#1B1B22`                         | Botão principal, "hoje", barra lateral. **Para trocar a cor do app, mude `accent`, `accent-hover` e `accent-soft`.** |
| `accent-hover` / `accent-soft`         | `#34343F` / `#EEEEF3`             | Hover do botão principal; fundo das sessões e do avatar                                                              |
| `ink` / `ink-soft` / `ink-faint`       | `#1B1B22` / `#5B5B68` / `#6E6E7C` | Texto principal (17:1), secundário (6,7:1) e placeholders (5,0:1 sobre branco)                                       |
| `surface` / `canvas` / `subtle`        | `#FFFFFF` / `#F5F5F8` / `#F9F9FB` | Fundo do conteúdo; rodapé do diálogo e hover de linha; fim de semana na agenda                                       |
| `line` / `line-strong`                 | `#E6E6EC` / `#C9C9D4`             | Filetes (use pouco) e contorno dos botões                                                                            |
| `control`                              | `#8E8E9C`                         | Contorno dos campos: 3,2:1 contra o branco (WCAG 1.4.11)                                                             |
| `night` / `night-soft` / `night-faint` | `#1B1B22` / `#B7B7C6` / `#9C9CAE` | Barra lateral: fundo, texto dos itens (8,6:1) e rodapé (6,3:1)                                                       |
| `fill` / `fill-hover`                  | grafite a 5,5% / 9%               | Chips e preenchimentos neutros                                                                                       |
| `session` / `session-hover`            | `#E6E6EE` / `#DCDCE6`             | Sessões na agenda: um passo mais escuro que `accent-soft`, para se destacarem da grade (nome 14:1, horário 6,6:1)    |
| `danger`                               | `#C4271B`                         | Erros e exclusão (5,0:1 sobre o fundo avermelhado)                                                                   |
| `now`                                  | `#E5484D`                         | Linha do horário atual na agenda (gráfico: 3,9:1)                                                                    |

Não há cores decorativas, nem verde. Os avatares são monogramas cinza.

## Estrutura da janela

- **Barra lateral** (`Layout.tsx`): coluna sólida de grafite, de 192px, até as bordas da janela. De cima para baixo: a faixa dos botões da janela e do botão de recolher, a marca ("auri" em minúsculas e as três barras), o menu e o aviso "Salvo neste computador".
- **Item ativo:** preenchimento mais claro e texto branco, além de `aria-current="page"`.
- **Recolher:** um botão só, sempre no mesmo lugar (depois dos botões da janela no Mac; no canto no Windows e na web). Atalho ⌃⌘S no Mac e Ctrl+B nos outros. A escolha fica salva pelo processo main (`preferencias.json`, ao lado do banco), que a entrega pronta na abertura; o `localStorage` fazia a primeira tela esperar o disco.
- **Cabeçalho da página** (`Page`): uma linha só de 48px, em fluxo normal. Título de 20px à esquerda; ferramentas e ação principal à direita. Um filete aparece embaixo quando o conteúdo rola. A barra é um `@container`: abaixo de 860px o título encolhe e o botão principal da agenda vira só o "+"; abaixo de 960px somem o selo "Semana" e o atalho **N**. Testado de 1000px (largura mínima) a 1280px.
- **Mac:** barra de título integrada; os botões da janela ficam sobre o grafite, centralizados nos 48px do cabeçalho (`trafficLightPosition` y = 17, ou seja, (48 − 14) / 2). **Windows e web:** o mesmo layout, sem o espaço dos botões.

## Escala (densidade)

A interface é de **produtividade**, não de toque: tudo foi dimensionado para uma janela de 1000–1400px com 13px de corpo. Em 2026-10-08 a escala toda foi reduzida (10–20% conforme o elemento: botões 36→32px, campos 40→36, linhas 64→56, cabeçalho 56→48, título 24→20), porque componentes de 40px e linhas de 64px pareciam grandes demais.

| Elemento                    | Tamanho                                      |
| --------------------------- | -------------------------------------------- |
| Botão `sm` / `md` / `lg`    | 28 / 32 / 36px                               |
| Campo de texto, `Select`    | 36px (busca da lista: 32px)                  |
| Item do menu lateral        | 34px, ícone de 16px                          |
| Cabeçalho da página         | 48px                                         |
| Barra lateral               | 192px                                        |
| Linha da lista de pacientes | 56px; avatar de 32px                         |
| Hora na agenda              | 56px; número do dia em quadrado de 32px      |
| Diálogo                     | 480px de largura                             |
| Alvo mínimo (WCAG 2.5.8)    | 24px, também no número do dia e em "+N mais" |

Para mexer na escala inteira, os pontos são: `body` e os tamanhos de `ui/button.tsx`, `ui/input.tsx` e `ui/avatar.tsx`; `SIDEBAR_WIDTH`, `TOGGLE_SIZE` e `h-12` do cabeçalho em `Layout.tsx` (e `trafficLightPosition` em `src/main/index.ts`, que depende da altura do cabeçalho); e `.rbc-timeslot-group` em `main.css`.

## Tipografia

**Bricolage Grotesque**, família única, embutida no app (funciona offline) com o eixo óptico `opsz`: nos títulos grandes ela ganha caráter e no texto miúdo fica mais firme. Corpo em 13px; números de horário e data em `tabular-nums`. A cauda longa do "Q" ("Qua", "Qui") é desenho da fonte, não sublinhado.

| Papel                                 | Tamanho / peso                              |
| ------------------------------------- | ------------------------------------------- |
| Nome na ficha                         | 26px, semibold                              |
| Marca "auri"                          | 22px, semibold                              |
| Título da página                      | 20px, semibold (18px com a janela estreita) |
| Título de diálogo                     | 17px, semibold                              |
| Título de seção da ficha              | 15px, semibold                              |
| Título de estado vazio e de erro      | 16px, semibold                              |
| Número do dia na agenda               | 18px, semibold                              |
| Corpo, tabela, campos, botões, menu   | 13px                                        |
| Rótulo de campo, complemento, sessões | 12–12,5px (rótulo medium)                   |
| Atalhos e chips                       | 12px                                        |

Sem caixa alta em rótulos. Títulos usam `text-wrap: balance`.

## Forma

- **Raios** (nunca `rounded-full`, exceto o ponto da linha do horário atual e as barras de carregando):
  - `chip` 6px: chips e selos, sessões da agenda, opção ativa do seletor de visão, "hoje" no mês, avatares pequenos e médios;
  - `control` 8px: botões, campos, busca, itens do menu, seletor de visão, "hoje" na semana;
  - `card` 12px: alertas, menus, linhas da tabela, avatar grande;
  - `sheet` 16px: diálogos;
  - teclas de atalho (`Kbd`): 6px, por serem minúsculas. O avatar cresce com o tamanho (5, 6, 6 e 12px).
- **Campos:** brancos, com contorno `control` (3:1). No foco o contorno vira grafite com um anel suave; no erro, vermelho, com ícone e mensagem embaixo (nunca só cor).
- **Ícones:** [Lucide](https://lucide.dev), traço 1.75, 16–18px. Só na navegação e em ações, nunca em cabeçalhos de tabela.
- **Profundidade:** plano. Só diálogos e menus têm sombra (`shadow-pop`); o seletor de visão tem uma sombra mínima (`shadow-lift`) para destacar a opção ativa.
- **Movimento:** só em resposta a uma ação (abrir diálogo ou lista, 140ms) ou para indicar carregando (as barras pulsam, só com `transform`).

## O motivo das barras

As três barras do logo (esquerda baixa, centro alta, direita média) aparecem em três lugares, e só nesses:

1. **Marca** na barra lateral.
2. **Carregando** (`ui/bars.tsx`): `Loading` só aparece depois de 400ms, porque o banco é local e um indicador que pisca atrapalha. No botão com `loading`, as barras ficam à esquerda do rótulo.
3. **Estado vazio de primeiro uso**, com as barras estáticas.

Elas não são usadas como marcador de item ativo nem como faixa das sessões: ali ficavam parecendo uma linha solta no componente.

## Componentes

- `ui/button.tsx`: `primary` (grafite), `outline` (padrão das barras de ferramentas; branco com contorno), `secondary` (preenchimento neutro), `ghost`, `night` (sobre a barra lateral), `danger`, `danger-ghost`. Prop `loading`: mostra as barras à esquerda do rótulo, mantém a largura e bloqueia o clique. Um botão principal por tela. Alturas 28/32/36px (`sm`/`md`/`lg`); em tela de toque (`pointer-coarse`) crescem para 40–48px.
- `ui/input.tsx`: `Input`, `Select`, `Textarea` e `Field` (rótulo sempre visível acima do campo; erro com ícone fora do `<label>`; controles compostos usam `Field as="group"`).
- `ui/avatar.tsx`: monograma cinza em quadrado arredondado, com o raio proporcional ao tamanho.
- `ui/dialog.tsx`: folha branca sólida, escurecendo o resto da janela (`night` a 45%). Rodapé em faixa cinza com filete: atalho ⌘/Ctrl+↵ à esquerda, botões à direita.
- `ui/empty.tsx`: `EmptyState` (título, explicação e próximo passo).
- `ui/error.tsx`: `ErrorState` (ícone vermelho, título, texto técnico em cinza e "Tentar de novo"). Falha de tela inteira usa este componente, nunca um parágrafo solto. Não promete que os dados estão salvos: a falha de leitura não garante isso.
- `ui/bars.tsx`: `Bars` e `Loading`.
- `ui/kbd.tsx`: tecla de atalho. Use `MOD_KEY` de `lib/platform.ts` para ⌘ ou Ctrl.
- `Layout.tsx`: `Layout` (barra lateral recolhível e área do conteúdo) e `Page` (cabeçalho de uma linha com `title`, `lead`, `badge`, `toolbar` e `actions`).

### Agenda

- **Dias:** o dia da semana em três letras, pequeno, e o número grande embaixo; "hoje" é um quadrado arredondado grafite.
- **Grade:** 56px por hora (a semana de 07:00 às 20:00 cabe numa janela de 820px sem rolar), linha da meia hora tracejada e bem fraca, fim de semana levemente sombreado, linha do horário atual em `now`.
- **Sessões:** bloco cinza (`session`) com contorno fino. Em **Semana e Mês** mostram o **nome curto** (os dois primeiros nomes, sem "de/da/do": "Maria Eduarda", `shared/names.ts`), porque as colunas são estreitas e o nome cortado ("Helena Pra…") não identifica ninguém; na visão **Dia** mostram o nome completo e, nas curtas, o horário à direita. O balão ao passar o mouse mostra horário, nome completo e observação. Sessões de menos de 45 min ficam em uma linha, sem horário (ele já está na grade); as maiores mostram o intervalo embaixo. No mês o horário vem antes do nome. Com a janela estreita (visão com menos de 800px) o texto vai a 12px.
- **Controles:** dois grupos de 32px: **‹ Hoje ›** num contorno único e **Dia/Semana/Mês** num trilho cinza com a opção ativa em branco. Atalho **N** para novo agendamento.
- **Alvos:** número do dia e "+N mais" no mês têm no mínimo 24px (WCAG 2.5.8) e retorno ao passar o mouse.
- **Erro:** a grade some e dá lugar ao `ErrorState` com "Tentar de novo"; uma grade vazia pareceria "sem agendamentos". Se uma atualização falhar mas já houver dados, eles continuam na tela.

### Pacientes e ficha

- **Busca:** placeholder curto ("Nome, mãe ou CPF") e botão de limpar próprio (o "x" nativo é azul e some com `appearance: none`).
- **Lista:** quatro colunas, cada célula com duas linhas: paciente e idade; mãe e celular; escola e série; entrada. Linhas de 56px com hover em quadrado arredondado; a contagem fica no cabeçalho. Nome e complementos cortados têm `title` com o texto inteiro.
- **Ficha:** enquanto carrega (ou se falhar) só aparecem o cabeçalho e o `Loading`/`ErrorState`, nunca o formulário vazio com "Novo paciente". Sem cartões. Cada seção é separada por um filete, com título e descrição fixos à esquerda (`sticky`) e os campos à direita. O cabeçalho da página diz "Novo paciente" ou "Ficha do paciente"; o nome grande fica no corpo.

## Acessibilidade

- Texto de apoio com pelo menos 4,5:1, inclusive placeholders (o `ink-faint` anterior tinha 2,6:1). Conferido com o `contrast.py` da skill `ui-design-craft`.
- Contorno dos campos a 3:1; anel de foco de 2px em grafite (branco sobre a barra lateral).
- Erro de tela inteira com ícone, título e ação; erro de campo com cor, ícone e texto; estado do filtro "Mostrar inativos" com ✓ além do preenchimento; "Inativo" sempre em texto.
- **Aumentar contraste** (`prefers-contrast: more`) escurece texto secundário, filetes, contornos e erro. **Reduzir movimento** desliga as animações. Como não há transparência, **Reduzir transparência** não muda nada.
- `nativeTheme.themeSource = 'light'` mantém os controles nativos (barras de rolagem, seletor de data) claros no Modo Escuro; as barras de rolagem do app são finas e iguais em todos os sistemas (`scrollbar-width: thin`).
- **Ainda não feito:** tema escuro (exige variantes de todos os tokens; os tokens já estão por papel, então é incremento pequeno), passagem com leitor de tela e teste real no Windows.

## Referências

- Tipografia: [Bricolage Grotesque](https://fonts.google.com/specimen/Bricolage+Grotesque) (OFL), pacote `@fontsource-variable/bricolage-grotesque`. Comparada com Geist, Instrument Sans, Funnel Sans, Rethink Sans, Onest e Host Grotesk; Schibsted (dois-pontos largos nos horários), Atkinson Hyperlegible (zero cortado em "08:00") e Familjen foram descartadas.
- Acessibilidade e estados: WCAG 2.2 AA e o checklist da skill `ui-design-craft`.
