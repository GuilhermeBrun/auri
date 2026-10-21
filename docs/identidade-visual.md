# Identidade visual do Auri

**Grafite, sólido e retangular.** O Auri não imita nenhum sistema operacional: não usa vidro, transparência nem sombras de decoração, então fica igual no Mac, no Windows e numa página web. A identidade vem do grafite, da tipografia **Bricolage Grotesque** e do **símbolo “a” que sugere escuta**. A assinatura da marca tem letras próprias em vetor; o símbolo reaparece nos estados de carregando e vazio.

Os valores ficam em `desktop/src/renderer/src/assets/main.css` (`@theme`) e se repetem em `BASE_TOKENS` (`desktop/src/shared/aparencia.ts`; um teste confere que os dois batem). Use sempre os tokens, nunca cores soltas. Os caminhos abaixo sem prefixo são relativos a `desktop/src/renderer/src/`.

O design system publicado (artifact "Auri") repete estas regras com prévias de cada componente. Ele não se atualiza sozinho: ao mudar um token ou um componente aqui, mude lá também.

## Princípios

1. **Menos é mais.** Antes de acrescentar ícone, cor, borda ou rótulo, pergunte se ele informa algo. Se não informa, sai.
2. **Um único destaque.** O grafite (`solid`, `accent`) marca a ação principal da tela, "hoje" e o que está escolhido. Todo o resto é cinza. A única cor livre é a das etiquetas, na agenda.
3. **Plano e sólido.** Superfícies opacas e uma única sombra forte (`shadow-pop`), só para o que flutua. Sem `backdrop-filter`.
4. **O espaço separa, nunca uma linha.** Sem filete entre conteúdos, com uma exceção: as opções das Configurações (ver "Espaço como divisor").
5. **Tudo é retângulo de cantos arredondados.** Botões, campos, chips, "hoje" e avatares usam a mesma família de formas (ver Forma). Redondo só o que é ponto ou alternância: Switch, pontos de estado e de cor, amostras de cor, contagem de não lidas.
6. **Dizer o que vai acontecer.** Botões com verbo ("Agendar", "Cadastrar paciente") e resumo antes de confirmar ("Sessão de 30 min com … na quarta-feira, 7 de outubro, das 14:00 às 14:30").
7. **Vazio convida a agir.** Lista vazia explica a situação e oferece o próximo passo; "nada encontrado" e "primeiro uso" são telas diferentes.

## Cores

Dois temas, **Claro** e **Escuro**, com os mesmos nomes de token. A escolha fica em **Configurações › Aparência › Tema** (Sistema, Claro ou Escuro; o padrão é Sistema) e é salva em `preferencias.json`. Quem aplica é o main (`nativeTheme.themeSource`); o CSS só lê `prefers-color-scheme`, então em "Sistema" o app acompanha o macOS e o Windows.

| Token                                    | Claro                             | Escuro                            | Uso                                                                                                                                           |
| ---------------------------------------- | --------------------------------- | --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `accent`                                 | `#1B1B22`                         | `#ECECF1`                         | Anel de foco e contornos de seleção                                                                                                           |
| `solid` / `-hover` / `-active`           | `#1B1B22` / `#34343F` / `#000000` | `#42424D` / `#4B4B57` / `#55555F` | Blocos cheios: botão principal, "hoje", escolha do `ChoiceButton`, etiqueta de horário do arraste. No escuro, grafite médio, para não ofuscar |
| `on-solid`                               | `#FFFFFF`                         | `#ECECF1`                         | Texto e ícone sobre `solid`                                                                                                                   |
| `accent-soft`                            | `#EEEEF3`                         | `#2A2A32`                         | Avatar, ícone do `EmptyState`, linha de paciente pressionada                                                                                  |
| `ink` / `ink-soft` / `ink-faint`         | `#1B1B22` / `#5B5B68` / `#6E6E7C` | `#ECECF1` / `#A9A9B7` / `#8A8A98` | Texto principal, secundário e apagado (placeholder, passos anteriores da trilha, horas da grade): 4,5:1 ou mais sobre `surface`               |
| `surface`                                | `#FFFFFF`                         | `#17171C`                         | Fundo do conteúdo e dos campos                                                                                                                |
| `sidebar`                                | `#F4F4F7`                         | `#101014`                         | Barra lateral: um tom abaixo do conteúdo, separada só pelo fundo                                                                              |
| `raised`                                 | `#FFFFFF`                         | `#212128`                         | O que flutua: diálogos, listas, menus, avisos                                                                                                 |
| `selected`                               | `#FFFFFF`                         | `#36363F`                         | Opção escolhida num trilho (`Segmented`, `ToggleGroup`, quem assina na chegada)                                                               |
| `canvas`                                 | `#F4F4F7`                         | `#212128`                         | Blocos de apoio dentro de diálogos (pagamento, confirmação), hover de linha das listas, campo desabilitado                                    |
| `subtle`                                 | `#F8F8FA`                         | `#1C1C22`                         | Horário fechado e dias fora do mês na agenda; fundo do compromisso                                                                            |
| `line` / `line-strong`                   | `#E6E6EC` / `#C9C9D4`             | `#2A2A32` / `#42424D`             | Grade do calendário, linhas das Configurações; `line-strong` em ponto de estado desligado e falta no gráfico                                  |
| `control`                                | `#8E8E9C`                         | `#6C6C7A`                         | Contorno dos campos (3:1); cor de uma sessão sem etiqueta                                                                                     |
| `fill` / `fill-hover`                    | grafite a 5,5% / 9%               | branco a 6% / 10%                 | Botão secundário, trilhos, busca, hover; `fill-hover` no item ativo do menu e na opção destacada das listas                                   |
| `scrim`                                  | grafite a 45%                     | preto a 60%                       | Fundo atrás de um diálogo                                                                                                                     |
| `session`                                | `#E6E6EC`                         | `#2F2F38`                         | Linha recém-salva (que se apaga). As sessões da agenda usam a cor da etiqueta (abaixo)                                                        |
| `danger`                                 | `#C4271B`                         | `#F0675B`                         | Erros e exclusão                                                                                                                              |
| `danger-soft` / `-hover`                 | `#FDEEEC` / `#F9D5D1`             | `#3A1B1A` / `#562826`             | Fundo de botão `danger`, `Callout` e `Badge` de erro                                                                                          |
| `warning` / `warning-soft`               | `#8A5300` / `#FDF3DC`             | `#F1B54A` / `#33270F`             | Atenção que não é erro (cópia parada, horário livre na confirmação): texto/ícone e fundo                                                      |
| `now` / `attention`                      | `#E5484D`                         | `#FF5A5F`                         | Linha do horário atual; ponto de "precisa de atenção"                                                                                         |

O escuro **não é o claro invertido**: o conteúdo é um grafite quase preto, a barra lateral fica um tom abaixo e o que flutua, um tom acima; como a sombra quase não aparece no escuro, `shadow-pop` ganha um contorno claro de 1px. Mudam com o tema também, em `main.css`: `--elevation-pop`/`-lift` (sombras), `--selection`, `--scrollbar`, `--grid-faint` (meia hora da grade), `--session-edge`, `--slot-selection` (faixa sendo selecionada na grade e vaga) e `--tinta` (22% no claro, 30% no escuro). **No tema claro não há nenhuma área escura.**

**Aumentar contraste** (`prefers-contrast: more`) troca, nos dois temas, `ink-soft`, `ink-faint`, `line`, `line-strong`, `control`, `danger` e `warning` por versões mais fortes.

Não há cores decorativas, nem verde, nem cor de sucesso: o que deu certo é dito em texto ou num aviso. O gráfico de frequência fica em grafite (`ink`, `line-strong`, hachura e tracejado): os tipos se distinguem pela forma, não pela cor. Exceções à regra de "só tokens": a cor das etiquetas, as amostras e a roda de cor (`ui/cor.tsx`, `ui/roda-de-cor.tsx`, com contorno e ✓ brancos sobre a cor) e as miniaturas da Aparência, que mostram cada tema independente do atual.

### Etiquetas

A clínica cadastra as etiquetas em **Clínica › Etiquetas**, em quatro grupos (Sessões, Avaliações, Exames e Compromissos), cada uma com nome, duração e cor. A cor vem de 12 prontas (`CORES_PRONTAS` em `desktop/src/shared/tipos.ts`) ou da roda de cor, guardada como hex `#rrggbb`.

A cor só aparece de três jeitos: ponto de 8px (`CorPonto`, `TipoMarca`, filtro da agenda), barra de 4px na borda esquerda da sessão e fundo tingido dela (ver Agenda). Nunca em texto, botão ou fundo de tela.

### Cores da clínica

**Configurações › Aparência › Cores** é uma seção só, porque é uma escolha só: as 6 prontas (Grafite, que é o padrão, Oceano, Íris, Rosa, Terracota e Petróleo), depois os campos **destaque** e **fundo** (roda de cor e código), e "Ajustar cada cor" recolhido no fim.

O resto sai das duas cores (`desktop/src/shared/aparencia.ts`), nos dois temas e no contraste alto:

- **Destaque** vira `solid-*`, `accent` e `accent-soft`. Se a cor deixar o texto do botão abaixo de 4,5:1, o tom é ajustado; o foco fica com pelo menos 3:1 sobre o fundo. O texto do botão é branco ou grafite, o que contrastar.
- **Fundo** dá a matiz de todos os neutros, com croma baixo. Cor clara vira o `surface` do claro (L entre 0,94 e 1 em OKLCH); escura, o do escuro; o outro tema só herda a matiz. O texto secundário é corrigido até 4,5:1.
- Sem cor escolhida nada é injetado e vale o `main.css`. Com cor, o renderer põe um `<style id="auri-cores">` fora das camadas, que vence os tokens.
- **Ajustar cada cor:** 17 papéis em 5 grupos (Telas, Texto, Ações, Agenda, Avisos), separados para o claro e o escuro. A cor escolhida é usada exata; as vizinhas saem dela (botão → hover, pressionado e texto; linha de agora → ponto do menu lateral; erro e atenção → fundos suaves; fundo das telas → menus, linhas e texto). Cada linha avisa em âmbar quando o contraste cai abaixo do mínimo, sem bloquear. A prévia acima da lista é uma miniatura do app; clicar numa parte abre a cor dela. Trocar para uma cor pronta apaga os ajustes, com "Desfazer" no aviso.
- **Barra lateral própria:** se a barra lateral ou o texto dela (`sidebar-ink`, que só existe nos ajustes) forem mudados, o CSS redefine texto, preenchimentos e foco só dentro de `#sidebar` e do botão de recolher.
- A escolha fica em `preferencias.json` (`colors`) e vai junto ao exportar as configurações.

### Tamanho do texto

**Configurações › Aparência › Texto › Tamanho**: Padrão, Médio, Grande e Muito grande (100, 110, 120 e 130%; ⌘ + / ⌘ − / ⌘ 0, ou Ctrl). É o zoom do Electron (`setZoomFactor`), não o `font-size` da raiz: o app mistura `px` e `rem`, e mudar só a fonte desalinharia alturas fixas.

**A área útil nunca fica menor que 1000×640 px de CSS.** O mínimo da janela cresce com o zoom, os tamanhos que não cabem na tela aparecem desativados ("Os tamanhos maiores não cabem nesta tela.") e, se a janela for para uma tela menor, o zoom baixa sozinho (a escolha continua salva). No Mac os botões da janela acompanham o cabeçalho (`trafficLightPosition` y = 24 × tamanho − 7, também reaplicado ao trocar) e o botão de recolher fica a 84px de tela deles, dividido pelo zoom.

## Estrutura da janela

- **Barra lateral** (`components/Layout.tsx`): coluna sólida em `sidebar`, de 216px, até as bordas da janela. De cima para baixo:
  1. a faixa de 48px com a assinatura vetorial (48px, na cor do texto) e o botão de recolher;
  2. o menu, com 6px entre os itens;
  3. o botão **⋯** (`SidebarEditor`);
  4. no rodapé, **Configurações** (engrenagem e nome, atalho ⌘, ou Ctrl+,). Com a cópia de segurança parada, ganha o ponto de atenção e leva direto à cópia.
- **Itens do menu:** Agenda, Pacientes, Financeiro, Clínica e WhatsApp (`desktop/src/shared/sidebar.ts`). O ⋯ abre, à direita, a lista dos itens para reordenar (arrastando ou com ↑↓ na alça) e esconder (Switch); "Restaurar o padrão" aparece quando a ordem mudou. Clínica some no computador da recepção; WhatsApp só aparece quando ligado em Geral, e escondido pelo ⋯ fica parado sem sair da conta. Pelo menos um item continua visível. A dica de cada item mostra o atalho ("ir para").
- **Item:** 34px, ícone de 16px, 13px médio em `ink-soft`; hover `fill`; ativo em `fill-hover` e `ink`, com `aria-current="page"`, e o fundo do ativo **desliza** entre itens. Ponto de atenção de 6px em `attention`; o WhatsApp mostra as não lidas numa contagem redonda `fill-hover` ("99+" acima de 99).
- **Em Configurações** a barra lateral mostra as seções **Geral**, **Aparência**, **Atalhos** e **Armazenamento**, e o rodapé vira **← Voltar** (última tela fora das Configurações) com o botão de atualização (`UpdateCorner`) ao lado. Cada seção tem endereço próprio (`/configuracoes/aparencia`; `/configuracoes` abre Geral).
- **Recolher:** um botão só (32px, ícone de 18px), sempre no mesmo lugar: depois dos botões da janela no Mac, no canto nos outros. Com a barra aberta, `PanelLeftClose`; recolhida, `PanelLeft`. Atalho configurável (padrão ⌃⌘S no Mac, Ctrl+B nos outros). A escolha fica em `preferencias.json`, entregue pelo main na abertura.
- **Cabeçalho da página** (`Page`): uma linha de 48px, em fluxo normal, sem filete embaixo. À esquerda, a **trilha**: passos anteriores em `ink-faint`, clicáveis (hover `fill`), separados por "/", e o atual em `ink`, peso médio, que é o `h1`. À direita, `toolbar` e `actions`. Sem botão Voltar e sem selo ao lado da trilha.
  - Paciente: "Pacientes / Nome / Aba" (o nome é link, exceto na Ficha); paciente novo, "Pacientes / Novo paciente".
  - Páginas com seções (`PageSection`): a trilha ganha a seção à vista na rolagem ("Configurações / Aparência / Cores"), e o passo atual vira um botão que volta ao topo.
- **Mac:** barra de título integrada; os botões da janela ficam sobre a barra lateral, centralizados no cabeçalho. **Windows e web:** o mesmo layout, sem o espaço dos botões.

## Escala

A interface é de **produtividade**, não de toque: tudo foi dimensionado para uma janela de 1000–1400px com 13px de corpo. Em tela de toque (`pointer-coarse`) botões, campos e opções crescem para 40–48px.

| Elemento                            | Tamanho                                                                                               |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Botão `sm` / `md` / `lg`            | 28 / 32 / 36px; só ícone: `icon-sm` 28, `icon` 32                                                     |
| Campo de texto, data, hora, duração | 36px; busca, opção de lista e `Select compact`: 32px                                                  |
| Item do menu lateral                | 34px, ícone de 16px                                                                                   |
| Cabeçalho da página                 | 48px                                                                                                  |
| Barra lateral                       | 216px                                                                                                 |
| Lista de pacientes                  | linha de 56px, cabeçalho de 36px, avatar de 32px                                                      |
| Hora na agenda                      | 56px; número do dia em quadrado de 32px                                                               |
| Diálogo                             | 560px (`size="wide"`: 720px); no máximo a tela menos 16px de cada lado, só o corpo rola               |
| Colunas das páginas                 | Configurações 720px; paciente e Clínica 840px (`PATIENT_COLUMN`); título de seção de formulário 200px |
| Alvo mínimo (WCAG 2.5.8)            | 24px, também no número do dia e em "+N mais"                                                          |

Para mexer na escala inteira: `body` e os tamanhos de `ui/button.tsx`, `ui/input.tsx`, `ui/field-style.ts` e `ui/avatar.tsx`; `NAV_ITEM_HEIGHT` em `lib/sidebar.ts`; `SIDEBAR_WIDTH`, `TOGGLE_SIZE` e `h-12` do cabeçalho em `Layout.tsx` (e `trafficLightPosition` em `desktop/src/main/index.ts`); `.rbc-timeslot-group` em `main.css`.

## Espaço como divisor

**O que separa conteúdo é o espaço, nunca uma linha.** Sem filete, `border-t`/`border-b` de separação, `divide-y` ou `<hr>`. Quando o espaço não basta, use, nesta ordem: **alinhamento** (colunas que começam no mesmo x), **fundo** (a barra lateral, um bloco `canvas` num diálogo) e **tipografia** (título em peso maior). Linha só onde ela é o conteúdo: a grade do calendário e o contorno dos campos.

**A exceção são as Configurações**, em linhas como as preferências de um app de computador: cada parte (`SettingsGroup`) fica separada da de cima por uma linha `line`, e uma parte com várias opções (`rows`) também separa cada opção com linha.

**O espaço entre grupos é pelo menos o dobro do espaço dentro deles**, e um título fica mais perto do que ele nomeia do que do bloco anterior.

| Relação                                   | Espaço                                                    |
| ----------------------------------------- | --------------------------------------------------------- |
| Rótulo e campo, título e descrição        | 4px (`gap-1`)                                             |
| Itens irmãos (botões, campos lado a lado) | 8–12px                                                    |
| Linhas de um formulário                   | 16px                                                      |
| Partes de uma página de Configurações     | 20px acima e abaixo da linha; 16px entre opções em linhas |
| Seções da ficha (`FormSection`)           | 28px acima e abaixo de cada uma                           |
| Assuntos de uma página de Configurações   | 56px                                                      |

Teste: olhe a tela de longe, com os olhos semicerrados. Os itens de um grupo devem virar uma mancha só e os grupos devem continuar separados.

## Tipografia

**Bricolage Grotesque** (OFL, pacote `@fontsource-variable/bricolage-grotesque`), família única, embutida (funciona offline), com o eixo óptico `opsz` ligado: os títulos grandes ganham caráter e o texto miúdo fica firme. Corpo em 13px; horários e datas em `tabular-nums`. A cauda longa do "Q" ("Qua", "Qui") é desenho da fonte.

| Papel                                                             | Tamanho / peso                                         |
| ----------------------------------------------------------------- | ------------------------------------------------------ |
| Nome na ficha e na assinatura da chegada                          | 26px, semibold                                         |
| Trilha do cabeçalho                                               | 14px; passo atual em peso médio                        |
| Número do dia na agenda                                           | 18px, semibold                                         |
| Título de diálogo                                                 | 17px, semibold                                         |
| Dia do `DateBlock`                                                | 17px, semibold                                         |
| Título de estado vazio e de erro                                  | 16px, semibold                                         |
| Título de seção (ficha, Configurações, painel da lista de espera) | 15px, semibold                                         |
| Corpo, tabela, campos, botões, menu                               | 13px                                                   |
| Rótulo de campo, descrição, sessões                               | 12–12,5px (rótulo e sessões em peso médio ou semibold) |
| Atalhos, chips, selos                                             | 12px                                                   |

Sem caixa alta em rótulos. Títulos usam `text-wrap: balance` e `letter-spacing` levemente negativo.

## Forma

- **Raios:**
  - `mark` 4px: etiqueta de horário do arraste;
  - `chip` 6px: chips, selos, sessões, opções de trilho, teclas (`Kbd`), avatares pequenos e médios, "hoje" no mês;
  - `control` 8px: botões, campos, itens do menu, abas do paciente, `ChoiceButton`, `DateBlock`;
  - `card` 12px: avisos, listas flutuantes, linhas de lista, `Callout`, avatar grande;
  - `sheet` 16px: diálogos e avisos da agenda.
- **Redondo** (`rounded-full`) só em: Switch (trilho e polegar), `StatusDot` e pontos de atenção, ponto da linha do horário atual, `CorPonto` e amostras de cor, roda de cor, contagem de não lidas, dica do `Sensitive`, indicador de passos das boas-vindas e barras de progresso.
- **Campos:** fundo `surface`, contorno `control` (3:1). No foco o contorno vira grafite com um anel suave; no erro, vermelho, com ícone e mensagem embaixo (nunca só cor). **Data, hora, duração e escolhas também:** nada de `<input type="date">`, `type="time"` ou `<select>` nativos. O que abre de um campo é sempre a mesma lista: `raised`, `card`, `shadow-pop`, opções de 32px com o destaque em `fill-hover` e ✓ à direita na escolhida. Ícone do campo à direita, 16px, `ink-soft`. (Ainda há duas caixas de seleção nativas: no diálogo da recepção e na cópia de segurança.)
- **Ícones:** [Lucide](https://lucide.dev), traço 1.75, 16–18px. Só na navegação e em ações, nunca em cabeçalhos de tabela. Dentro da sessão, 12px com traço 2.
- **Profundidade:** plano. `shadow-pop` em diálogos, listas, menus, avisos e no cartão erguido pelo arraste; `shadow-lift` no bloco `selected` dos trilhos, no polegar do Switch e na dica do `Sensitive`.
- **Movimento:** só em resposta a uma ação ou para indicar carregando. Ver "Feedback das ações".

## Feedback das ações

Toda ação tem uma resposta visível. Movimento é para **estado, retorno e orientação**, nunca decoração; curto quanto mais frequente a ação; só `transform` e `opacity` (exceções pequenas: o fundo da linha salva e a largura do bloco do seletor).

| Ação                                                | Resposta                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| --------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Qualquer botão                                      | Encolhe a 97% ao pressionar (150ms); habilitar e desabilitar suaviza o preenchimento                                                                                                                                                                                                                                                                                                                                                                     |
| Botão com `loading`                                 | O rótulo some e o símbolo da Auri aparece no lugar, se preenchendo de baixo para cima; ao terminar completa, some e o rótulo volta. A largura não muda                                                                                                                                                                                                                                                                                                   |
| Cadastrar ou salvar paciente                        | Aviso ("Paciente cadastrado", "Alterações salvas"); na lista a linha começa em `session` e se apaga em 1,8s, e a lista rola até ela                                                                                                                                                                                                                                                                                                                      |
| Inativar ou reativar                                | Aviso com "Desfazer"; o selo "Inativo" entra com `pop-in`                                                                                                                                                                                                                                                                                                                                                                                                |
| Agendar ou editar sessão                            | O diálogo sai (110ms); aviso com nome curto e horário ("Ana Beatriz · sex, 9 de out às 19:30"); a grade rola até a sessão, que entra crescendo com um contorno `accent` que se apaga em 1,4s                                                                                                                                                                                                                                                             |
| Arrastar sessão ou compromisso                      | Começa depois de 5px. O cartão é erguido (escala 1,02, `shadow-pop`) com o horário numa etiqueta `solid` em cima; o original fica a 35%; o destino ganha a cor da etiqueta a 12% e contorno de 1,5px. Destino recusado fica hachurado com o horário riscado. Perto da borda a grade rola sozinha. Ao soltar o cartão pousa (180ms) e fica no destino enquanto grava; aviso "Sessão remarcada" (ou "Duração alterada", "Compromisso movido") com Desfazer |
| Excluir agendamento                                 | Confirmação em dois passos no próprio botão; aviso com lixeira e "Desfazer"                                                                                                                                                                                                                                                                                                                                                                              |
| Campo recusado                                      | Tremor de 3px (240ms, uma vez) e a mensagem entra de cima (160ms)                                                                                                                                                                                                                                                                                                                                                                                        |
| Trocar de tela                                      | Fade e subida de 6px (180ms); o fundo do item ativo do menu desliza (250ms)                                                                                                                                                                                                                                                                                                                                                                              |
| Trocar de opção num trilho                          | O bloco `selected` desliza até a opção nova                                                                                                                                                                                                                                                                                                                                                                                                              |
| Mudar o período da agenda, trocar a seção na trilha | Fade (140ms)                                                                                                                                                                                                                                                                                                                                                                                                                                             |

**Avisos** (`ui/toast.tsx`, Radix Toast): `raised` com `shadow-pop` e `card`, embaixo no centro (até 440px), ícone num quadrado `fill`, até 3 ao mesmo tempo, 4s (6s com ação). Param com o mouse ou o foco em cima e saem por botão, Esc ou deslizando para baixo; o leitor de tela os anuncia sem tirar o foco (F8). O ✓ se desenha em 320ms. Só confirmam o que deu certo: erro de gravação fica no próprio diálogo ou ficha (`Callout`), porque aviso que some sozinho não serve para erro. Use `useToast()` de `lib/toast.ts`.

**Avisos da agenda** (`components/AgendaNotices.tsx`): mudanças feitas em outro computador. Ficam no canto de cima à direita (360px), `raised`, `sheet`, `shadow-pop`, ícone de 32px em `fill`; até 3, 8s cada, entram deslizando da direita (260ms) e saem para a direita; Alt+N vai até eles. O clique abre a Agenda no dia da sessão.

**Entrada e saída:** entrar é rápido e desacelera (`cubic-bezier(0.2, 0.8, 0.2, 1)`), sair é mais curto e acelera (`cubic-bezier(0.4, 0, 1, 1)`); deslizar entre posições usa `ease-slide` (`cubic-bezier(0.32, 0.72, 0, 1)`). Diálogo: 140ms entra, 110ms sai; aviso: 220ms entra, 160ms sai. Quem fecha um diálogo mantém o conteúdo montado até a saída acabar (ver `AppointmentDialog`).

**Cuidado com o rodapé:** o aviso ocupa os 72px de baixo da janela. A lista de pacientes e o painel da lista de espera têm folga no fim (`pb-20`); a grade da agenda não, então uma sessão no último horário fica sob o aviso durante os 4s.

## A marca e o símbolo

O símbolo é um “a” orgânico que sugere escuta. Na assinatura ele substitui a primeira letra e se une a “uri”. A assinatura e o símbolo são desenhados em vetor em `ui/brand.tsx` (`AuriLogo`, `AuriSymbol`, `AuriSymbolFill`), com `currentColor`. O logo tem nome acessível “Auri”; o símbolo é decorativo.

1. **Marca** na barra lateral: assinatura completa na cor do texto.
2. **Carregando** (`ui/loading.tsx`): `Loading` só aparece depois de 400ms, porque o banco é local e um indicador que pisca atrapalha. O símbolo pulsa só em opacidade; com movimento reduzido fica parado. No botão, o símbolo se preenche (ver "Feedback das ações").
3. **Estado vazio de primeiro uso**, com o símbolo parado. Busca sem resultados e erros usam ícones de contexto.

Não distorça nem gire a marca, nem a use como marcador. Os arquivos ficam em `desktop/resources/brand/auri-v1` (fora do pacote); `desktop/build/icon.png` e `desktop/resources/icon.png` são o ícone de 1024px do empacotamento e do app; o favicon é `assets/auri-icon.svg`. **Ícone do aplicativo:** símbolo branco de cerca de 530px centralizado num quadrado grafite de cantos contínuos, com 100px de margem no canvas de 1024px, contorno iluminado e sombra discreta. Esse acabamento é só do ícone nativo.

## Botões e ferramentas

Um padrão só para tudo que é clicável. **Nenhum botão tem contorno**; contorno é só dos campos.

| Nível                         | Visual                                           | Onde                                                         |
| ----------------------------- | ------------------------------------------------ | ------------------------------------------------------------ |
| Ação do cabeçalho e da janela | Só o ícone (`ghost`), sem fundo; `fill` no hover | +, imprimir, lista de espera, confirmações, recolher, fechar |
| Ligado                        | `fill-hover` e ícone `ink` (`aria-pressed`)      | Mostrar inativos                                             |
| Conclusão de formulário       | Bloco cheio `solid` (`primary`), um por tela     | Salvar, Cadastrar paciente, Agendar                          |
| Secundário com texto          | Preenchimento `fill` (`secondary`)               | Inativar, Tentar de novo, perguntas-guia                     |
| Excluir                       | `danger` (fundo `danger-soft`) ou `danger-ghost` | Excluir, Remover                                             |

Trilhos (**‹ Hoje ›**, Dia/Semana/Mês, Estável/Beta) ficam em `fill`, com a opção ativa em `selected`, que desliza. A busca do cabeçalho é `fill` sem contorno e, no foco, ganha o fundo e o contorno de campo. As ações do cabeçalho são **só ícone** (32×32), com `aria-label` e `title` (com o atalho, quando há).

## Componentes

**Base** (`components/ui/`):

- `button.tsx`: `primary`, `secondary`, `ghost`, `danger`, `danger-ghost`; tamanhos `sm`/`md`/`lg`/`icon`/`icon-sm`; `loading`.
- `input.tsx`: `Input`, `Textarea` e `Field` (rótulo sempre visível acima; erro com ícone fora do `<label>`; `Field htmlFor` para controles compostos com um campo principal, `Field as="group"` para os sem).
- `field-style.ts`: o visual comum de campos e listas (`controlClass`, `popupClass`, `optionClass`, `openClass`). Campo novo usa estes.
- `date-field.tsx` + `calendar.tsx`: data digitada com máscara (dd/mm/aaaa) ou escolhida no calendário (6 semanas, teclado WAI-ARIA, "Hoje" no rodapé). Enquanto o texto é uma data incompleta, o valor é o próprio texto, para o formulário recusar em vez de gravar vazio.
- `time-field.tsx`: hora com máscara ("930" vira 09:30) ou escolhida de 15 em 15 minutos do horário de funcionamento do dia (`horariosDoDia`).
- `select.tsx`: escolha entre poucas opções (Radix Select); `compact` com 32px ao lado de botões.
- `segmented.tsx`: uma opção entre poucas, com o bloco `selected` que desliza (`useThumb` em `lib/hooks.ts`).
- `toggle-group.tsx`: várias opções ligadas ao mesmo tempo, no mesmo trilho, opções de 28px (dias e períodos da lista de espera).
- `choice-button.tsx`: escolha grande (44px) com nome e complemento; escolhida em `solid` (Enviar termo › Para quem).
- `switch.tsx`: `Switch` (36×20) e `SwitchField` (texto à esquerda, para o que vale na hora).
- `section.tsx`: `PageSection` (assunto de uma página, com `data-crumb` para a trilha), `SettingsGroup` e `SettingRow` (Configurações), `FormSection` (seção de cadastro: título fixo à esquerda em 200px, campos numa grade de 6 colunas), `ErrorText`, `StatusDot` (8px; ligado `ink`, desligado `line-strong`) e `GroupText`.
- `dialog.tsx`: folha `raised` um pouco acima do centro, com `scrim` atrás. Rodapé na mesma cor da folha, sem faixa nem filete: atalho ou ações secundárias (Excluir, Remarcar) à esquerda, botão principal à direita. Sem "Cancelar" que só fecha: o X e o Esc já fecham. `dismissible={false}` tira o X e impede fechar por fora; `media` põe uma imagem acima do título.
- `callout.tsx`: aviso que fica na página até ser resolvido (`neutral`, `warning`, `danger`), fundo suave inteiro, sem barra lateral.
- `badge.tsx`: selo de uma ou duas palavras (`neutral`, `outline`, `strong`, `warning`, `danger`).
- `toast.tsx`: `ToastProvider` (já no `Layout`); `useToast()` em `lib/toast.ts`, com `action` para "Desfazer" ou "Resolver".
- `confirm-action.tsx`: confirmação em dois passos no lugar, onde há espaço na linha.
- `search-field.tsx`: busca do cabeçalho (`fill`, lupa, limpar próprio; Esc limpa). Pacientes: "Nome, família ou CPF".
- `sensitive.tsx`: valor borrado sobre `fill` até um clique (código de recuperação, endereço da conexão).
- `cor.tsx` + `roda-de-cor.tsx`: `CorPonto`, `CorEscolha` (12 amostras, "Outra cor" com a roda HSV e o código hex) e `RodaDeCor` (teclado: setas, Shift pula 10, Home/End).
- `avatar.tsx`: monograma em `accent-soft` (acompanha o destaque da clínica), raio 6px até o médio e 12px no grande.
- `empty.tsx` (`EmptyState`), `error.tsx` (`ErrorState`: ícone, título, texto técnico em cinza e "Tentar de novo"; nunca promete que os dados estão salvos), `loading.tsx`, `kbd.tsx` (use `MOD_KEY` de `lib/platform.ts`), `brand.tsx`.

**Do app** (`components/`): `Layout`/`Page`, `SidebarEditor`, `PatientHeader`, `DateBlock` (dia em quadrado de 44px; `muted` para o que passou), `TipoMarca` e `TipoSelect` (etiqueta com o ponto), `AgendaNotices`, `UpdateCorner`/`UpdateReady`, `SignaturePad`, `ArrivalSignature`, `AttendanceChart`.

### Agenda

- **Dias:** o dia da semana em três letras, pequeno, e o número grande embaixo; "hoje" é um quadrado arredondado `solid`.
- **Grade:** 56px por hora, meia hora tracejada e bem fraca (`--grid-faint`), linha do horário atual em `now` (1,5px, ponto de 8px). Na régua, a meia hora aparece menor e mais fraca.
- **Funcionamento:** o horário vem da Clínica. A semana mostra só os dias abertos (um dia fechado só aparece se tiver sessão); o que fica fora do horário de cada dia tem fundo `subtle` e não pode ser selecionado. Na visão Dia, ‹ › pulam os dias fechados.
- **Sessões:** fundo tingido pela cor da etiqueta (`color-mix` da cor com `surface` a `--tinta`: 22% no claro, 30% no escuro), contorno de 1px com a cor a 30%, **barra de 4px na cor** na borda esquerda, texto 12,5px semibold em `ink`. Hover soma 8%; selecionada, 12% e contorno de 1,5px na cor. Sem etiqueta, a cor é `control`.
  - Em **Semana e Mês**, o **nome curto** (dois primeiros nomes, sem "de/da/do": `shared/names.ts`); na visão **Dia**, o completo e, nas curtas, o horário à direita. No Mês o horário vem antes do nome.
  - O nome da etiqueta vem em texto fraco: ao lado do nome nas de menos de 45 min, embaixo com o intervalo nas maiores.
  - Marcas de 12px depois do nome: caneta (chegada assinada), ✓ (confirmada pela família), relógio (aguardando resposta) ou cronômetro cortado (sem resposta). O bolo, antes do nome, marca aniversário.
  - **Falta ou desmarcou:** tinta de 10%, texto `ink-soft` peso médio e nome riscado.
  - Com a visão estreita (menos de 800px) o texto vai a 12px.
- **Compromissos:** listras a 135° de `fill-hover` sobre `subtle`, texto `ink-soft` peso médio ("Etiqueta · título"), barra na cor da etiqueta (sem cor, `line-strong`). Hover e seleção em `canvas`.
- **Vaga:** com a lista de espera aberta e um horário escolhido, um bloco "Vaga" em `--slot-selection` com contorno de 1,5px em `accent`, sem clique.
- **Redimensionar:** puxador só embaixo, com um traço de 16×3px.
- **Cabeçalho:** trilhos **‹ Hoje ›** e **Dia/Semana/Mês** (32px), o filtro **Todas as etiquetas** (`Select compact`, 192px, só sessões; aparece se houver etiquetas de sessão, avaliação ou exame) e as ações só ícone, nesta ordem: aniversariantes (só quando há), confirmações, lista de espera (painel de 288px à direita; não no Mês) e **+** novo agendamento (atalho **N**).
- **Faixas da confirmação**, acima da grade: `card`, 13px; "Horário livre…" em `warning-soft` com "Encaixar", "Outra resposta" em `fill`; as duas com X.
- **Alvos:** número do dia e "+N mais" no mês têm no mínimo 24px e retorno ao passar o mouse.
- **Erro:** a grade some e dá lugar ao `ErrorState`; uma grade vazia pareceria "sem agendamentos". Se uma atualização falhar mas já houver dados, eles ficam na tela.

### Pacientes e ficha

- **Lista:** quatro colunas com duas linhas por célula, menos a última: **Paciente** (nome, selo Inativo e idade), **Responsável** (nome e "parentesco · celular", ou "Próprio paciente"), **Escola** (escola e série) e **Entrada**. Linhas de 56px com hover `canvas` e pressionada `accent-soft`, raio `card`; nome e complementos cortados têm `title` com o texto inteiro.
- **Cabeçalho do paciente** (`PatientHeader`): avatar grande, nome de 26px (acompanha o que se digita), selos de idade e "Inativo", e as **abas** logo embaixo do nome, no corpo: **Ficha, Anamnese, Sessões, Evoluções, Termos e Financeiro** (no computador da recepção, sem Anamnese e Evoluções). Abas de 32px, `control`, a ativa em `fill-hover` e `ink`, `aria-current="page"`; Ctrl+Tab e Ctrl+Shift+Tab passam de uma para outra. À direita, o botão da lista de espera quando o paciente está ativo. Todas as abas usam a mesma coluna de 840px, então nome, abas e o começo do conteúdo ficam no mesmo lugar; enquanto uma aba carrega, nome e abas continuam na tela.
- **Ficha:** enquanto carrega (ou se falhar) só aparecem o cabeçalho e o `Loading`/`ErrorState`, nunca o formulário vazio. Seções em `FormSection`, sem cartões.
- **Anamnese como roteiro da conversa:** a data e a lista dos 9 temas numa coluna de 200px à esquerda; à direita, **um tema por vez** ("Tema 2 de 9", título, dica, perguntas-guia e o campo). Na lista, tema escrito = quadrado cheio, vazio = só o contorno (a forma diz, não a cor; o leitor de tela ouve "escrito"/"vazio"). As perguntas-guia são botões `secondary` pequenos que põem a pergunta no fim do texto. Embaixo, **‹ tema anterior** e **próximo tema ›** com o nome. Se salvar falhar num tema escondido, abre o primeiro tema com erro.
- **Sessões e Evoluções:** cada item começa com o `DateBlock`; a etiqueta aparece com `TipoMarca`.
- **Assinatura da chegada** (`ArrivalSignature`): tela cheia em `surface` (coluna de 900px, título de 26px). "Quem está assinando" é um trilho `fill` numa linha só, com o bloco `selected` que desliza; as pessoas da ficha dividem a largura (nome em cima, papel embaixo) e "Outra pessoa" fica no fim. O texto "Ao assinar, …" fica na linha de "Desfazer traço" e "Limpar" (`SignaturePad` com `note`, área 5:2 em `fill`).

### Configurações

Coluna de 720px, um `PageSection` por assunto (título de 15px; descrição de 13px opcional), 56px entre eles:

- **Geral:** Atualizações, WhatsApp, Este computador, Levar para outro computador (exportar e importar as configurações) e Relatórios de erro.
- **Aparência:** Tema, Cores e Texto.
- **Atalhos:** um assunto por grupo (Geral, Ir para, Agenda, Pacientes) e "Fixos", só leitura. Cada atalho é uma `SettingRow` com um botão de 32px que mostra as teclas (`Kbd`) ou "Pressione as teclas…" enquanto grava, e ↺ para voltar ao padrão.
- **Armazenamento:** Conexão e Cópia de segurança numa página só, rolando.

Dentro de cada assunto, as partes (`SettingsGroup`) e as opções (`SettingRow`: título e descrição à esquerda, controle à direita, centralizado na altura do texto) seguem "Espaço como divisor". O rótulo de 12px em cima de uma parte só aparece quando ela junta várias opções (Rede, Acesso dos outros computadores). Painéis passageiros dentro de uma parte (código de pareamento, troca de pasta, resumo de importação) usam `fill`, com confirmar e cancelar à direita; ações soltas ficam à esquerda, alinhadas ao texto (um `ghost` compensa o próprio respiro com `-ml-3.5`). Todo botão da página tem 32px e um seletor ao lado de botões usa a versão compacta, para a linha ter uma altura só. O passo a passo de ligar a cópia também usa partes ("Passo 1 de 3 · Onde guardar as cópias").

## Acessibilidade

- Texto de apoio com pelo menos 4,5:1, inclusive placeholders; contorno dos campos e foco a 3:1; anel de foco de 2px em `accent`.
- Erro de tela inteira com ícone, título e ação; erro de campo com cor, ícone e texto; filtro ligado com ✓ além do preenchimento; "Inativo" sempre em texto; marcas da sessão com `aria-label`.
- **Aumentar contraste** tem variantes nos dois temas (ver Cores). **Reduzir movimento** tira deslocamento, escala e transição (`--shift` vira 0) mas mantém os fades; o símbolo de carregando fica parado e o ✓ do aviso aparece já desenhado. Como não há transparência, **Reduzir transparência** não muda nada.
- `color-scheme: light dark` faz os controles nativos acompanharem o tema; barras de rolagem finas e iguais em todos os sistemas.
- **Ainda não feito:** passagem com leitor de tela e teste real no Windows (inclusive do tema escuro).
