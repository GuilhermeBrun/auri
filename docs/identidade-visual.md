# Identidade visual do Auri

**Grafite, sólido e retangular.** O Auri não imita nenhum sistema operacional: não usa vidro, transparência nem sombras de decoração, então fica igual no Mac, no Windows e numa página web. A identidade vem do grafite, da tipografia **Bricolage Grotesque** na interface e do **símbolo “a” que sugere escuta**. A assinatura da marca tem letras próprias em vetor; o símbolo reaparece nos estados de carregando e vazio.

Os valores ficam em `src/renderer/src/assets/main.css` (`@theme`). Use sempre os tokens, nunca cores soltas.

## Princípios

1. **Menos é mais.** Antes de acrescentar ícone, cor, borda ou rótulo, pergunte se ele informa algo. Se não informa, sai.
2. **Um único destaque.** O grafite (`accent`) marca a ação principal da tela e "hoje". Todo o resto é cinza.
3. **Plano e sólido.** Superfícies opacas, sem filetes de separação (áreas se separam por espaço, alinhamento ou fundo) e uma única sombra, só para o que flutua (diálogos e menus). Sem `backdrop-filter`.
4. **Tudo é retângulo de cantos arredondados.** Não há pílulas nem círculos: botões, busca, chips, "hoje" e avatares usam a mesma família de formas, com quatro raios (ver Forma). Nada de detalhes soltos nas bordas: sem barrinhas laterais em menus ou sessões.
5. **Dizer o que vai acontecer.** Botões com verbo ("Agendar", "Cadastrar paciente") e resumo antes de confirmar ("Sessão de 30 min com … na quarta-feira, 7 de outubro, das 14:00 às 14:30").
6. **Vazio convida a agir.** Lista vazia explica a situação e oferece o próximo passo; "nada encontrado" e "primeiro uso" são telas diferentes.

## Cores

Dois temas, **Claro** e **Escuro**, com os mesmos nomes de token. A escolha fica em **Configurações → Aparência** (Sistema, Claro ou Escuro; o padrão é Sistema) e é salva em `preferencias.json`. Quem aplica é o main (`nativeTheme.themeSource`); o CSS só lê `prefers-color-scheme`, então em "Sistema" o app acompanha o macOS/Windows, inclusive quando ele troca sozinho ao anoitecer. Componentes usam só os tokens, nunca uma cor fixa (a única exceção são as miniaturas da tela de Configurações, que mostram cada tema independente do atual).

| Token                                    | Claro                             | Escuro                            | Uso                                                                                                                         |
| ---------------------------------------- | --------------------------------- | --------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `accent`                                 | `#1B1B22`                         | `#ECECF1`                         | Anel de foco e contornos de seleção. **Para trocar a cor do app, mude `accent`, `accent-soft` e `solid-*` dos dois temas.** |
| `solid` / `-hover` / `-active`           | `#1B1B22` / `#34343F` / `#000000` | `#42424D` / `#4B4B57` / `#55555F` | Blocos cheios: botão principal, "hoje", sessão selecionada. No escuro, grafite médio: um bloco quase branco ofuscava        |
| `on-solid`                               | `#FFFFFF`                         | `#ECECF1`                         | Texto e ícone sobre `solid` (17:1 no claro, 8,4:1 no escuro)                                                                |
| `accent-soft`                            | `#EEEEF3`                         | `#2A2A32`                         | Avatar, filtro ligado                                                                                                       |
| `ink` / `ink-soft` / `ink-faint`         | `#1B1B22` / `#5B5B68` / `#6E6E7C` | `#ECECF1` / `#A9A9B7` / `#8A8A98` | Texto principal, secundário e placeholders (escuro sobre `surface`: 15,2 / 7,7 / 5,3:1)                                     |
| `surface`                                | `#FFFFFF`                         | `#17171C`                         | Fundo do conteúdo                                                                                                           |
| `sidebar`                                | `#F4F4F7`                         | `#101014`                         | Barra lateral: um tom abaixo do conteúdo, separada só pelo fundo                                                            |
| `selected`                               | `#FFFFFF`                         | `#34343E`                         | Opção escolhida num trilho (Dia/Semana/Mês; 10,5:1 com o texto no escuro)                                                   |
| `raised`                                 | `#FFFFFF`                         | `#212128`                         | O que flutua: diálogos, listas, avisos, bloco do seletor (no escuro, um tom acima do conteúdo)                              |
| `canvas` / `subtle`                      | `#F5F5F8` / `#F9F9FB`             | `#1F1F25` / `#1B1B21`             | Hover de linha; horário fechado na agenda                                                                                   |
| `line` / `line-strong`                   | `#E6E6EC` / `#C9C9D4`             | `#2B2B33` / `#3C3C46`             | Contorno dos botões e linhas da grade do calendário; nunca como divisor                                                     |
| `control`                                | `#8E8E9C`                         | `#6C6C7A`                         | Contorno dos campos: ≥ 3:1 contra o fundo (WCAG 1.4.11)                                                                     |
| `fill` / `fill-hover`                    | grafite a 5,5% / 9%               | branco a 6% / 10%                 | Chips, preenchimentos neutros, item ativo do menu, opção destacada das listas                                               |
| `scrim`                                  | grafite a 45%                     | preto a 60%                       | Fundo atrás de um diálogo                                                                                                   |
| `session` / `session-hover`              | `#E6E6EE` / `#DCDCE6`             | `#2C2C35` / `#35353F`             | Sessões na agenda                                                                                                           |
| `danger`                                 | `#C4271B`                         | `#F0675B`                         | Erros e exclusão (escuro: 5,8:1)                                                                                            |
| `now`                                    | `#E5484D`                         | `#FF5A5F`                         | Linha do horário atual na agenda                                                                                            |
| `danger-soft` / `-hover`                 | `#FDEEEC` / `#F9D5D1`             | `#3A1B1A` / `#562826`             | Fundo de botão `danger`, `Callout` e `Badge` de erro, ícone do `ErrorState`                                                 |
| `warning` / `warning-soft`               | `#8A5300` / `#FDF3DC`             | `#F1B54A` / `#33270F`             | Atenção que não é erro (cópia de segurança parada): texto/ícone e fundo. 4,5:1 nos dois temas                               |
| `attention`                              | `#E5484D`                         | `#FF5A5F`                         | Ponto de "precisa de atenção" no menu lateral                                                                               |
| `chart-strong` / `chart` / `chart-faint` | `#1B1B22` / `#8E8E9C` / `#DCDCE5` | `#ECECF1` / `#6C6C7A` / `#36363F` | Gráficos, só em grafite; os tipos se distinguem pela forma                                                                  |

O escuro **não é o claro invertido**: o conteúdo é um grafite quase preto, a barra lateral fica um tom abaixo e o que flutua, um tom acima; como a sombra quase não aparece no escuro, `shadow-pop` ganha um contorno claro de 1px. O destaque (foco, contornos) vira o claro, mas os blocos cheios (`solid`) ficam num grafite médio, para não ofuscar. Sombras, seleção de texto, barras de rolagem e traços finos da agenda também mudam com o tema (`--elevation-*`, `--selection`, `--scrollbar`, `--grid-faint`, `--session-edge`, em `main.css`). **No tema claro não há nenhuma área escura**: barra lateral, avisos e diálogos são claros.

Não há cores decorativas, nem verde, nem cor de sucesso. O âmbar (`warning`) é só para atenção que não é erro. Os avatares são monogramas cinza. Estes valores seguem a v2 do design system (artifact "Auri"), que organiza as cores em escalas primitivas (`gray-0..12`, `red-*`, `amber-*`) e papéis.

## Estrutura da janela

- **Barra lateral** (`Layout.tsx`): coluna sólida em `sidebar` (cinza-claro no claro, quase preto no escuro), de 216px, até as bordas da janela, separada do conteúdo só pelo tom. De cima para baixo: a faixa dos botões da janela e do botão de recolher, a assinatura vetorial da Auri (na cor do texto), o menu (vão de 6px entre os itens) e, no rodapé, o item **Configurações** (engrenagem e nome, no estilo dos itens do menu; atalho ⌘, no Mac, Ctrl+, no Windows).
- **Em Configurações** a barra lateral mostra onde se está: o menu principal dá lugar às seções de Configurações (**Geral**, **Aparência** e **Armazenamento**, que junta Conexão e Cópia de segurança numa página só, rolando; exportar e importar as configurações ficam em Geral) e o rodapé vira **← Voltar**, que leva à última tela fora das Configurações. Cada seção tem endereço próprio (`/configuracoes/aparencia`; `/configuracoes` abre a primeira) e a trilha do cabeçalho segue as outras telas: **Configurações / Aparência**. A página é uma coluna só. Cada assunto (Atualizações, Conexão, Cópia de segurança, Tema) tem título de 15px e descrição (`PageSection`). Dentro dele, cada parte é um `SettingsGroup`: rótulo cinza de 12px em cima (Situação, Quando copiar, Este computador) e os controles num bloco de fundo `fill` com cantos de 12px, sem contorno. Painéis passageiros dentro de um bloco (código de pareamento, troca de pasta, resumo de importação) usam fundo `surface`, para não somar dois `fill`. Esse é o padrão de toda página de configuração nova. O bloco de fundo é só das páginas de Configurações. Telas de cadastro (ficha do paciente, Clínica) seguem a ficha: cada seção em duas colunas (`FormSection`), título e descrição fixos à esquerda em 200px e os campos à direita, sem fundo, separadas só por espaço. Alinhamento dentro dos blocos: todo botão de uma página de configuração tem 32px (`md`), e um seletor ao lado de botões ou de um Segmented usa a versão compacta (`compact`, 32px), para a linha ter uma altura só. Numa linha com texto à esquerda e controle à direita (Switch, botões, seletor), o controle fica centralizado na altura do texto. Um ponto de estado acompanha a primeira linha do texto. Botões de confirmar ou cancelar de um painel passageiro ficam à direita; ações soltas de um grupo ficam à esquerda, alinhadas ao texto, e um botão `ghost` compensa o próprio respiro (`-ml-3.5`) para o ícone cair na mesma coluna do texto. O passo a passo de ligar a cópia também usa grupos: o rótulo diz o passo ("Passo 1 de 3 · Onde guardar as cópias").
- **Item ativo:** preenchimento `fill-hover` e texto `ink`, além de `aria-current="page"`.
- **Recolher:** um botão só, sempre no mesmo lugar (depois dos botões da janela no Mac; no canto no Windows e na web). O ícone mostra o que o clique faz: com a barra aberta, `PanelLeftClose` (painel com a seta "‹"); recolhida, `PanelLeft` (painel simples). Atalho ⌃⌘S no Mac e Ctrl+B nos outros. A escolha fica salva pelo processo main (`preferencias.json`, ao lado do banco), que a entrega pronta na abertura; o `localStorage` fazia a primeira tela esperar o disco.
- **Cabeçalho da página** (`Page`): uma linha só de 48px, em fluxo normal. À esquerda, a **trilha** (`trail`), como um caminho: passos anteriores em `ink-faint` e clicáveis (levam àquela tela), separados por "/", e o atual em `ink`, peso médio, que é o `h1` da página (ex.: "Pacientes / Pedro Souza Oliveira", "Agenda / 4 a 10 de outubro 2026"). Sem botão Voltar: o passo anterior faz esse papel. Ferramentas e ação principal à direita. Sem filete embaixo. Sem selo ao lado da trilha (contagem, número da semana). O botão principal não leva a tecla de atalho desenhada (ela aparece na dica). A barra é um `@container`: abaixo de 860px o botão principal da agenda vira só o "+". Testado de 1000px (largura mínima) a 1280px.
- **Mac:** barra de título integrada; os botões da janela ficam sobre a barra lateral, centralizados nos 48px do cabeçalho (`trafficLightPosition` y = 17, ou seja, (48 − 14) / 2). **Windows e web:** o mesmo layout, sem o espaço dos botões.

## Escala (densidade)

A interface é de **produtividade**, não de toque: tudo foi dimensionado para uma janela de 1000–1400px com 13px de corpo. Em 2026-10-08 a escala toda foi reduzida (10–20% conforme o elemento: botões 36→32px, campos 40→36, linhas 64→56, cabeçalho 56→48, título 24→20), porque componentes de 40px e linhas de 64px pareciam grandes demais.

| Elemento                            | Tamanho                                           |
| ----------------------------------- | ------------------------------------------------- |
| Botão `sm` / `md` / `lg`            | 28 / 32 / 36px                                    |
| Campo de texto, data, hora, duração | 36px (busca da lista: 32px; opção de lista: 32px) |
| Item do menu lateral                | 34px, ícone de 16px                               |
| Cabeçalho da página                 | 48px                                              |
| Barra lateral                       | 216px                                             |
| Linha da lista de pacientes         | 56px; avatar de 32px                              |
| Hora na agenda                      | 56px; número do dia em quadrado de 32px           |
| Diálogo                             | 480px de largura                                  |
| Alvo mínimo (WCAG 2.5.8)            | 24px, também no número do dia e em "+N mais"      |

Para mexer na escala inteira, os pontos são: `body` e os tamanhos de `ui/button.tsx`, `ui/input.tsx` e `ui/avatar.tsx`; `SIDEBAR_WIDTH`, `TOGGLE_SIZE` e `h-12` do cabeçalho em `Layout.tsx` (e `trafficLightPosition` em `src/main/index.ts`, que depende da altura do cabeçalho); e `.rbc-timeslot-group` em `main.css`.

## Espaço como divisor

**Regra: o que separa conteúdo é o espaço, nunca uma linha.** Sem filete, `border-t`/`border-b` de separação, `divide-y` ou `<hr>`, em nenhuma tela. Quando o espaço não basta, use, nesta ordem: **alinhamento** (colunas que começam no mesmo x), **fundo** (a barra lateral) e **tipografia** (título de seção em peso maior). Linha só onde ela é o próprio conteúdo: a grade do calendário e o contorno de botões e campos.

Por quê: pelo princípio de proximidade (Gestalt), coisas próximas são lidas como um grupo e coisas afastadas como grupos diferentes. O espaço já comunica a separação, e cada linha a mais é ruído que disputa atenção com o conteúdo. O Material só admite divisor "se os elementos não puderem ser separados com espaço em branco"; a Apple cita espaço negativo, contêineres e linhas como opções para agrupar, sem obrigar a linha.

Como aplicar: **o espaço entre grupos tem de ser visivelmente maior que o espaço dentro deles** (pelo menos o dobro). Um título fica mais perto do conteúdo que ele nomeia do que do bloco anterior.

| Relação                                   | Espaço                                           |
| ----------------------------------------- | ------------------------------------------------ |
| Rótulo e campo, título e descrição        | 4px (`gap-1`)                                    |
| Itens irmãos (botões, campos lado a lado) | 8–12px (`gap-2`, `gap-x-3`)                      |
| Campos de um mesmo grupo (linhas do form) | 16px (`gap-y-4`)                                 |
| Seções (ficha do paciente)                | 56px (`py-7` em cada seção)                      |
| Cabeçalho da página e conteúdo            | a altura de 48px do cabeçalho, sem linha embaixo |

Teste: olhe a tela de longe, com os olhos semicerrados. Os itens de um grupo devem virar uma mancha só e os grupos devem continuar separados. Se não continuarem, aumente o espaço entre grupos (ou reduza o de dentro), em vez de pôr uma linha.

## Tipografia

**Bricolage Grotesque**, família única, embutida no app (funciona offline) com o eixo óptico `opsz`: nos títulos grandes ela ganha caráter e no texto miúdo fica mais firme. Corpo em 13px; números de horário e data em `tabular-nums`. A cauda longa do "Q" ("Qua", "Qui") é desenho da fonte, não sublinhado.

| Papel                                 | Tamanho / peso                                 |
| ------------------------------------- | ---------------------------------------------- |
| Nome na ficha                         | 26px, semibold                                 |
| Marca "auri" (faixa da janela)        | Vetor de 48px, centro visual alinhado ao botão |
| Trilha do cabeçalho                   | 14px; passo atual em peso médio                |
| Título de diálogo                     | 17px, semibold                                 |
| Título de seção da ficha              | 15px, semibold                                 |
| Título de estado vazio e de erro      | 16px, semibold                                 |
| Número do dia na agenda               | 18px, semibold                                 |
| Corpo, tabela, campos, botões, menu   | 13px                                           |
| Rótulo de campo, complemento, sessões | 12–12,5px (rótulo medium)                      |
| Atalhos e chips                       | 12px                                           |

Sem caixa alta em rótulos. Títulos usam `text-wrap: balance`.

## Forma

- **Raios** (nunca `rounded-full`, exceto o ponto da linha do horário atual):
  - `chip` 6px: chips e selos, sessões da agenda, opção ativa do seletor de visão, "hoje" no mês, avatares pequenos e médios;
  - `control` 8px: botões, campos, busca, itens do menu, seletor de visão, "hoje" na semana;
  - `card` 12px: alertas, menus, linhas da tabela, avatar grande;
  - `sheet` 16px: diálogos;
  - teclas de atalho (`Kbd`): 6px, por serem minúsculas. O avatar cresce com o tamanho (5, 6, 6 e 12px).
- **Campos:** brancos, com contorno `control` (3:1). No foco o contorno vira grafite com um anel suave; no erro, vermelho, com ícone e mensagem embaixo (nunca só cor). **Todo campo tem esse visual, inclusive data, hora e duração:** nada de `<input type="date">`, `type="time"` ou `<select>` nativos, que abrem o calendário e o menu do navegador (em inglês, com o azul padrão, diferentes em cada sistema). O que abre de um campo é sempre a mesma lista: `raised`, `card` de 12px, `shadow-pop`, opções de 32px com o destaque em `fill-hover` e ✓ à direita na escolhida. Ícone do campo à direita (calendário, relógio, seta), 16px, `ink-soft`.
- **Ícones:** [Lucide](https://lucide.dev), traço 1.75, 16–18px. Só na navegação e em ações, nunca em cabeçalhos de tabela.
- **Profundidade:** plano. Só diálogos e menus têm sombra (`shadow-pop`); o seletor de visão tem uma sombra mínima (`shadow-lift`) para destacar a opção ativa.
- **Movimento:** só em resposta a uma ação ou para indicar carregando (as barras pulsam, só com `transform`). Ver "Feedback das ações" abaixo.

## Feedback das ações

Toda ação do usuário tem uma resposta visível. A regra é a da skill `ui-design-craft`: movimento para dar **estado, retorno e orientação**, nunca decoração; curto quanto mais frequente a ação; só `transform` e `opacity` (exceções pequenas e anotadas: o fundo da linha salva e a largura do polegar do seletor, em elementos minúsculos).

| Ação                               | Resposta                                                                                                                                                                                                                       |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Qualquer botão                     | Encolhe a 97% ao pressionar (150ms, interrompível); habilitar e desabilitar suaviza o preenchimento                                                                                                                            |
| Cadastrar ou salvar paciente       | Aviso ("Paciente cadastrado", "Alterações salvas"); na lista a linha do paciente se apaga do cinza das sessões em 1,8s, e a lista rola até ela se estiver fora da vista                                                        |
| Inativar ou reativar               | Aviso; o selo "Inativo" entra com `pop-in`                                                                                                                                                                                     |
| Agendar ou editar sessão           | O diálogo sai (110ms); aviso com nome curto e horário ("Ana Beatriz · sex, 9 de out às 19:30"); a grade rola até a sessão se estiver fora da vista e a sessão entra crescendo, com um contorno por dentro que se apaga em 1,4s |
| Excluir agendamento                | Confirmação em dois passos (o botão troca com fade); aviso com ícone de lixeira                                                                                                                                                |
| Campo recusado                     | Tremor de 3px (240ms, uma vez) e a mensagem entra de cima (160ms). Um campo que continua inválido não treme de novo                                                                                                            |
| Trocar de tela                     | Fade e subida de 6px (180ms); no menu o fundo do item ativo **desliza** (250ms) em vez de pular                                                                                                                                |
| Trocar de visão (Dia/Semana/Mês)   | O bloco `selected` do seletor desliza até a opção nova                                                                                                                                                                         |
| Mudar o período da agenda          | O título entra com fade (140ms)                                                                                                                                                                                                |
| Escolher o paciente no agendamento | O chip do paciente entra com fade                                                                                                                                                                                              |
| Tela vazia ou com erro             | Fade                                                                                                                                                                                                                           |

**Avisos** (`ui/toast.tsx`, Radix Toast): em `raised` com `shadow-pop` (como os menus; nada escuro no tema claro), embaixo no centro, até 3 ao mesmo tempo, 4s de duração. Param enquanto o mouse ou o foco estão em cima e saem por botão, Esc ou deslizando para baixo; o leitor de tela os anuncia sem tirar o foco (F8 vai até eles). O check se desenha por 320ms. Só confirmam o que deu certo: erro de gravação continua inline, no próprio diálogo ou ficha, porque aviso que some sozinho não serve para erro. Use `useToast()` de `lib/toast.ts`; funciona mesmo de uma tela que se fecha logo em seguida.

**Entrada e saída:** entrar é rápido e desacelera (`cubic-bezier(0.2, 0.8, 0.2, 1)`), sair é mais curto e acelera (`cubic-bezier(0.4, 0, 1, 1)`); deslizar entre posições usa `ease-slide` (`cubic-bezier(0.32, 0.72, 0, 1)`). Diálogo: 140ms entra, 110ms sai; aviso: 220ms entra, 160ms sai. Quem fecha um diálogo precisa manter o conteúdo montado até a saída acabar (ver `AppointmentDialog`).

**Cuidado com o rodapé:** o aviso fica nos 72px de baixo da janela. A tabela de pacientes tem folga no fim (`pb-20`) para a última linha subir acima dele; a grade da agenda não tem como subir a última meia hora antes de fechar, então uma sessão nesse horário fica sob o aviso durante os 4s.

## A marca e o símbolo

O símbolo é um “a” orgânico que sugere escuta. Na assinatura, ele substitui a primeira letra e se une a “uri”, com altura e linha de base ajustadas às letras. A assinatura completa e o símbolo são desenhados em vetor em `ui/brand.tsx`, com `currentColor` para acompanhar a superfície. O logo tem nome acessível “Auri”; o símbolo é decorativo, acompanhado do rótulo do estado.

1. **Marca** na barra lateral: assinatura completa na cor do texto, sem depender de fonte instalada.
2. **Carregando** (`ui/loading.tsx`): `Loading` só aparece depois de 400ms, porque o banco é local e um indicador que pisca atrapalha. O símbolo pulsa apenas em opacidade; com movimento reduzido fica estático. No botão com `loading` ele não pulsa: o rótulo some e o símbolo da Auri aparece centralizado no lugar dele, se preenchendo de baixo para cima enquanto a ação acontece; ao terminar, completa o preenchimento, some, e o rótulo volta. O botão fica bloqueado só enquanto a ação acontece.
3. **Estado vazio de primeiro uso**, com o símbolo estático. Busca sem resultados e erros preservam seus ícones de contexto.

Não distorça nem gire a marca. Ela não é usada como marcador de item ativo nem como faixa das sessões. Os arquivos aprovados ficam em `resources/brand/auri-v1`; `build/icon.png` e `resources/icon.png` usam o ícone de 1024px para o empacotamento e o app. O favicon é `assets/auri-icon.svg`. No macOS, o mesmo ícone também é aplicado ao Dock em desenvolvimento.

**Ícone do aplicativo:** o símbolo branco fica centralizado, com aproximadamente 530px de largura, sobre um quadrado grafite de cantos contínuos, com margem transparente de 100px no canvas de 1024px. Um contorno iluminado e uma sombra discreta definem o quadrado sobre o Dock, com escala visual semelhante à dos outros aplicativos. Esse acabamento pertence ao ícone nativo; a assinatura usada na interface continua plana.

## Botões e ferramentas

Um padrão só para tudo que é clicável. **Nenhum botão tem contorno**; contorno é só dos campos de formulário (3:1).

| Nível                      | Visual                                                      | Onde                                                                                                 |
| -------------------------- | ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Ação do cabeçalho e janela | Só o ícone (`ghost`), sem fundo; fundo `fill` só no hover   | **+** de novo paciente e novo agendamento, mostrar inativos, recolher a barra, Configurações, fechar |
| Ligado                     | Fundo `fill-hover` e ícone `ink`, como o item ativo do menu | Mostrar inativos ligado (`aria-pressed`)                                                             |
| Conclusão de formulário    | Bloco cheio `solid` (`primary`), um por tela                | Salvar, Cadastrar paciente, Agendar                                                                  |
| Botão de texto secundário  | Preenchimento neutro `fill` (`secondary`)                   | Cancelar, Inativar, Tentar de novo                                                                   |

Grupos de opções (**‹ Hoje ›** e Dia/Semana/Mês) ficam num trilho `fill`, com a opção ativa em `selected`; a busca do cabeçalho também é `fill` sem contorno e, no foco, ganha o fundo e o contorno de campo. As ações do cabeçalho são **só ícone** (32×32), com `aria-label` e `title` (com o atalho, quando há), e seguem o mesmo estilo dos ícones da barra lateral (pedido do usuário: "gosto deles sem fundo igual do menu lateral"). Placeholder sobre o preenchimento: 4,5:1 nos dois temas.

## Componentes

- `ui/button.tsx`: `ghost` (só ícone, sem fundo; ligado com `aria-pressed`), `primary` (bloco cheio), `secondary` (preenchimento neutro), `danger`, `danger-ghost`; ver "Botões e ferramentas". Prop `loading`: o rótulo some e o símbolo da Auri aparece centralizado no lugar dele, se preenchendo de baixo para cima enquanto a ação acontece; ao terminar, completa o preenchimento, some, e o rótulo volta. O botão fica bloqueado só enquanto a ação acontece (a largura do botão não muda). Um botão principal por tela. Alturas 28/32/36px (`sm`/`md`/`lg`); em tela de toque (`pointer-coarse`) crescem para 40–48px.
- `ui/input.tsx`: `Input`, `Textarea` e `Field` (rótulo sempre visível acima do campo; erro com ícone fora do `<label>`; controles compostos com um campo principal usam `Field htmlFor`, e os sem campo principal, `Field as="group"`).
- `ui/field-style.ts`: o visual que todos os campos e listas compartilham (`controlClass`, `popupClass`, `optionClass`, `openClass`). Campo novo usa estes, não classes próprias.
- `ui/date-field.tsx` + `ui/calendar.tsx`: data digitada com máscara (dd/mm/aaaa; essencial para data de nascimento) ou escolhida no calendário (botão ou seta ↓). O valor é AAAA-MM-DD; enquanto o texto é uma data incompleta ou inexistente, o valor é o próprio texto, para o formulário recusar em vez de gravar vazio. Calendário de 6 semanas, teclado do padrão WAI-ARIA (setas, Home/End, PageUp/PageDown, Shift para o ano), "Hoje" no rodapé.
- `ui/time-field.tsx`: hora digitada com máscara ("9" vira 09, "930" vira 09:30) ou escolhida numa lista de 15 em 15 minutos do horário de funcionamento daquele dia (`horariosDoDia`, em `shared/agenda.ts`). Combobox: o foco fica no campo; Enter escolhe o destacado pelas setas, e sem setas só confirma o digitado.
- `ui/select.tsx`: escolha entre poucas opções (Radix Select), no lugar do `<select>` nativo.
- `ui/avatar.tsx`: monograma cinza em quadrado arredondado, com o raio proporcional ao tamanho.
- `ui/dialog.tsx`: folha sólida em `raised`, escurecendo o resto da janela (`scrim`). Rodapé em faixa cinza, sem filete: atalho ⌘/Ctrl+↵ à esquerda, botões à direita.
- `ui/empty.tsx`: `EmptyState` (título, explicação e próximo passo).
- `ui/error.tsx`: `ErrorState` (ícone vermelho, título, texto técnico em cinza e "Tentar de novo"). Falha de tela inteira usa este componente, nunca um parágrafo solto. Não promete que os dados estão salvos: a falha de leitura não garante isso.
- `ui/brand.tsx`: `AuriLogo` e `AuriSymbol`.
- `ui/loading.tsx`: `Loading`.
- `ui/toast.tsx`: `ToastProvider` (já no `Layout`) e, em `lib/toast.ts`, `useToast()`.
- `ui/segmented.tsx`: `Segmented`, seletor de uma opção entre poucas, com o bloco `selected` deslizante (medido na opção ativa, sem deslize na abertura).
- `ui/badge.tsx`: `Badge`, selo de uma ou duas palavras ("Inativo", idade): `neutral`, `outline`, `strong`, `warning`, `danger`.
- `ui/callout.tsx`: `Callout`, aviso que fica na página até ser resolvido (`neutral`, `warning`, `danger`), fundo suave inteiro, sem barra lateral. Erros de gravação da ficha, da anamnese e do diálogo de agendamento, e os problemas da cópia de segurança, usam este componente.
- `ui/search-field.tsx`: `SearchField`, a busca do cabeçalho (`fill`, lupa, limpar próprio; Esc limpa).
- `ui/confirm-action.tsx`: `ConfirmAction`, confirmação em dois passos no lugar ("Cortar o acesso?" · Cancelar · Remover), onde há espaço na linha (lista de computadores em Conexão). No rodapé do diálogo de agendamento, que é estreito, o "Excluir" continua virando "Confirmar exclusão" no próprio botão.
- Avisos com ação (`useToast` com `action`): "Desfazer" depois de excluir um agendamento (agenda de novo com os mesmos dados) e de inativar um paciente; "Resolver" no aviso da cópia parada. Com ação o aviso fica 6s.
- `ui/kbd.tsx`: tecla de atalho. Use `MOD_KEY` de `lib/platform.ts` para ⌘ ou Ctrl.
- `Layout.tsx`: `Layout` (barra lateral recolhível e área do conteúdo) e `Page` (cabeçalho de uma linha com `trail`, `badge`, `toolbar` e `actions`; subtelas passam o caminho inteiro, ex.: `[{ label: 'Pacientes', to: '/pacientes' }, { label: nome }]`).

### Agenda

- **Dias:** o dia da semana em três letras, pequeno, e o número grande embaixo; "hoje" é um quadrado arredondado grafite.
- **Grade:** 56px por hora (a semana de 07:00 às 20:00 cabe numa janela de 820px sem rolar), linha da meia hora tracejada e bem fraca, linha do horário atual em `now`. Na régua, a meia hora ("09:30") aparece menor e mais fraca que a hora cheia.
- **Funcionamento:** o horário vem da tela Clínica. A semana mostra só os dias abertos (um dia fechado só aparece se tiver sessão marcada); a grade vai da primeira abertura ao último fechamento desses dias, e o que fica fora do horário de cada dia (sábado à tarde) tem fundo `subtle` e não pode ser selecionado. Na visão Dia, ‹ › pulam os dias fechados.
- **Sessões:** bloco cinza (`session`) com contorno fino. Em **Semana e Mês** mostram o **nome curto** (os dois primeiros nomes, sem "de/da/do": "Maria Eduarda", `shared/names.ts`), porque as colunas são estreitas e o nome cortado ("Helena Pra…") não identifica ninguém; na visão **Dia** mostram o nome completo e, nas curtas, o horário à direita. O balão ao passar o mouse mostra horário, nome completo e observação. Toda sessão mostra o tipo (Sessão, Avaliação) em texto fraco: nas de menos de 45 min, ao lado do nome, sem horário (ele já está na grade); nas maiores, antes do intervalo, embaixo. Depois do nome, um ✓ fraco marca a sessão confirmada pela família, e a caneta, a chegada assinada (a caneta substitui o ✓). No mês o horário vem antes do nome. Com a janela estreita (visão com menos de 800px) o texto vai a 12px.
- **Controles:** dois grupos de 32px no mesmo trilho de preenchimento neutro: **‹ Hoje ›** e **Dia/Semana/Mês** (`Segmented`), com a opção ativa em `selected`, que desliza. Novo agendamento é o **+** só com ícone, sem fundo (atalho **N**).
- **Alvos:** número do dia e "+N mais" no mês têm no mínimo 24px (WCAG 2.5.8) e retorno ao passar o mouse.
- **Erro:** a grade some e dá lugar ao `ErrorState` com "Tentar de novo"; uma grade vazia pareceria "sem agendamentos". Se uma atualização falhar mas já houver dados, eles continuam na tela.

### Pacientes e ficha

- **Busca:** placeholder curto ("Nome, mãe ou CPF") e botão de limpar próprio (o "x" nativo é azul e some com `appearance: none`).
- **Lista:** quatro colunas, cada célula com duas linhas: paciente e idade; mãe e celular; escola e série; entrada. Linhas de 56px com hover em quadrado arredondado; a contagem fica no cabeçalho. Nome e complementos cortados têm `title` com o texto inteiro.
- **Ficha:** enquanto carrega (ou se falhar) só aparecem o cabeçalho e o `Loading`/`ErrorState`, nunca o formulário vazio com "Novo paciente". Sem cartões. Cada seção é separada só por espaço, com título e descrição fixos à esquerda (`sticky`) e os campos à direita. A trilha diz "Pacientes / Novo paciente" ou "Pacientes / <nome salvo>"; o nome grande (que acompanha o que se digita) fica no corpo.
- **Partes do paciente (Ficha, Anamnese, Sessões):** abas logo embaixo do nome, no corpo, e não no cabeçalho (lá elas andavam junto com os botões de cada parte, que mudam de largura). São links (`aria-current="page"` na atual), com a ativa no mesmo fundo do item ativo do menu lateral. As três partes usam a mesma coluna (`PATIENT_COLUMN`, 840px), então nome, abas e o começo do conteúdo ficam no mesmo lugar; enquanto uma parte carrega, nome e abas continuam na tela.
- **Anamnese como roteiro da conversa:** a data e a lista dos 9 temas ficam numa coluna de 200px à esquerda; à direita, **um tema por vez** ("Tema 2 de 9", título, dica, perguntas-guia e o campo). Na lista, tema escrito = quadrado cheio, vazio = só o contorno (a forma diz, não a cor; o leitor de tela ouve "escrito"/"vazio"), e embaixo "4 de 9 temas escritos". As **perguntas-guia** são botões `secondary` pequenos: o clique põe a pergunta no fim do texto, numa linha nova, com o cursor depois dela. Embaixo do campo, **‹ tema anterior** e **próximo tema ›** com o nome. O tema aberto é lembrado por paciente enquanto o Auri está aberto; se salvar falhar por erro num tema escondido, abre o primeiro tema com erro, que também ganha o ícone de alerta na lista.

## Acessibilidade

- Texto de apoio com pelo menos 4,5:1, inclusive placeholders (o `ink-faint` anterior tinha 2,6:1). Conferido com o `contrast.py` da skill `ui-design-craft`.
- Contorno dos campos a 3:1; anel de foco de 2px em `accent` (grafite no claro, quase branco no escuro).
- Erro de tela inteira com ícone, título e ação; erro de campo com cor, ícone e texto; estado do filtro "Mostrar inativos" com ✓ além do preenchimento; "Inativo" sempre em texto.
- **Aumentar contraste** (`prefers-contrast: more`) escurece texto secundário, filetes, contornos e erro. **Reduzir movimento** tira todo deslocamento, escala e transição (`--shift` vira 0 e as transições ficam instantâneas) mas mantém os fades, para a mudança continuar visível; o símbolo de carregando fica estático, e o check do aviso aparece já desenhado. Como não há transparência, **Reduzir transparência** não muda nada.
- `nativeTheme.themeSource` segue a escolha de Configurações e `color-scheme: light dark` faz os controles nativos acompanharem o tema; as barras de rolagem do app são finas e iguais em todos os sistemas (`scrollbar-width: thin`).
- **Aumentar contraste** tem variantes nos dois temas.
- **Ainda não feito:** passagem com leitor de tela e teste real no Windows (inclusive do tema escuro).

## Referências

- Tipografia: [Bricolage Grotesque](https://fonts.google.com/specimen/Bricolage+Grotesque) (OFL), pacote `@fontsource-variable/bricolage-grotesque`. Comparada com Geist, Instrument Sans, Funnel Sans, Rethink Sans, Onest e Host Grotesk; Schibsted (dois-pontos largos nos horários), Atkinson Hyperlegible (zero cortado em "08:00") e Familjen foram descartadas.
- Acessibilidade e estados: WCAG 2.2 AA e o checklist da skill `ui-design-craft`.
- Espaço como divisor:
  - NN/g, [Proximity Principle in Visual Design](https://www.nngroup.com/articles/gestalt-proximity/): "Using varying amounts of whitespace to either unite or separate elements is key to communicating meaningful groupings."
  - Material Design, [Dividers](https://material.io/go/design-dividers): divisores "only … if elements cannot be separated using white space", e com moderação, para formar grupos e não para separar itens.
  - Apple HIG, [Layout](https://developer.apple.com/design/human-interface-guidelines/layout): agrupar itens relacionados com "negative space, container shapes, or separator lines"; espaçamento consistente para a tela continuar fácil de percorrer.
  - Refactoring UI (Adam Wathan e Steve Schoger), "Use fewer borders": trocar bordas por espaço, contraste de fundo ou sombra.
  - Laws of UX, [Law of Proximity](https://lawsofux.com/law-of-proximity/) e [Law of Common Region](https://lawsofux.com/law-of-common-region/): o fundo comum (a barra lateral) agrupa sem precisar de linha.
