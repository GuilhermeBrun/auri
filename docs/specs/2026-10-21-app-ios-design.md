# App do iPhone — design

Data: 21/10/2026. Estado: etapa 1 (prova de conceito) feita no simulador; falta o teste num iPhone
de verdade pelo 4G.

## Objetivo

O Auri no iPhone, de dentro ou de fora da clínica, para a fono e para a secretária, com duas abas:
**Agenda**, com tudo o que a agenda do computador faz, e **Pacientes**, para consultar a ficha, as
sessões, a anamnese e as evoluções sem editar. O app chega pronto: dados da clínica e etiquetas
vêm do Auri do computador, sem configurar nada no celular. O visual é o padrão do iPhone.

Sucesso: de casa, no 4G, a fono abre o app, vê a agenda de amanhã, marca uma sessão e ela aparece
na recepção em poucos segundos; abre um paciente e lê a última evolução. Na clínica, a secretária
colhe a assinatura de chegada no iPhone. O app mostra as etiquetas da clínica.

## Decisões tomadas

- **Cliente da recepção, como o consultório:** os dados ficam só no computador que guarda
  (servidor); o iPhone não tem banco e lê e grava pelas mesmas operações
  (`desktop/src/main/operations.ts`). Sem esse computador ligado, o app não funciona.
- **Acesso de fora desde a primeira versão:** o mesmo transporte do desktop, Noise
  (`@hyperswarm/secret-stream`) pela rede distribuída (`hyperdht`), com a rede da clínica como
  atalho quando o iPhone estiver nela.
- **Interface nativa em SwiftUI, seguindo as Human Interface Guidelines da Apple à risca** (seção
  Design). No iPhone, onde a HIG e `docs/identidade-visual.md` divergem, vale a HIG.
- **Rede em JavaScript dentro do app:** o app embute o runtime Bare (`bare-kit`) num worklet que
  roda o cliente de `desktop/src/main/net/`. Nada de reescrever o Noise e a DHT em Swift, e um só
  código de rede para os dois aparelhos.
- **Dois níveis de celular:** "Fono", que vê anamnese e evoluções, e "Recepção", que não vê, com a
  mesma regra do computador da recepção. O nível é escolhido no computador ao gerar o QR.
- **Pareamento por QR code**, gerado no computador que guarda os dados e lido de qualquer rede.
  Vale para o celular e também para parear o consultório de fora.
- **Visual padrão da Apple:** cores, tema e fundos do sistema. Nenhuma cor da aparência do desktop
  vai para o celular; só as cores das etiquetas, que são dado da clínica.
- **Permissões decididas no servidor, não no app:** o computador que guarda os dados só atende ao
  celular os canais da lista do celular. Um app modificado não ganha mais acesso.
- **Contrato próprio do celular**, com versão própria: o iPhone atualiza depois do desktop (revisão
  da Apple, usuário que não atualiza), então ele não pode depender da versão do banco.
- **Dois canais, como no desktop:** TestFlight faz o papel do alpha e a App Store o da estável.
- **Modelos da Apple:** a Agenda segue o app Calendário (ano, mês com marcadores, dia com a linha
  do tempo, detalhe, busca e "+"), e Pacientes segue o app Contatos (lista por letra com índice
  lateral, ficha com avatar e ações rápidas). Conexão é a terceira aba. Nas telas de paciente, a
  ação no alto é marcar sessão.
- **Primeira vez:** tela de boas-vindas no modelo do "Novidades" do Calendário e, ao tocar em
  Continuar, só a câmera lendo o QR code, sem digitar endereço ou código.
- **Ícones do Auri:** o ícone do app usa a marca (símbolo branco sobre o grafite), e as abas e as
  boas-vindas usam os mesmos ícones da barra lateral do desktop (Agenda, Pacientes, Conexão) em vez
  dos SF Symbols.

## Arquitetura

```
iPhone                                                       Computador que guarda os dados
SwiftUI ⇄ RPC tipado ⇄ worklet Bare ══Noise (DHT ou rede local)══▶ servidor no main
                        (protocolo, pareamento,                    → permissões do celular
                         hyperdht, secret-stream)                  → operations.ts → SQLite
SwiftUI ◀──────────────── evento "agenda mudou" ◀─────────────────────────┘
```

- Pasta nova `ios/` na raiz, ao lado de `desktop/` e `web/`, sem workspaces. O worklet importa
  `protocol.ts`, `pairing.ts` e o cliente de `desktop/src/main/net/` e é empacotado com
  `bare-pack`.
- O que depende do Node troca pelo equivalente do Bare (`net` → `bare-tcp`) ou passa para o Swift:
  a descoberta na rede local (Bonjour `_auri._tcp`) fica no `NWBrowser` do Network.framework, que
  entrega o endereço ao worklet. A prova de conceito confirma a lista.
- O cliente disputa rede local e internet como o consultório (internet entra após 1,5 s); fica a
  que conectar primeiro.
- Com o app em segundo plano, o iOS corta a conexão. Ao voltar, o worklet reconecta e as telas
  recarregam.

## Pareamento por QR (muda o desktop)

Hoje o pareamento só acontece na rede da clínica: pela internet, a recepção barra chaves não
pareadas antes da conexão (`desktop/src/main/connection.ts`, `isPaired` do `firewall`), e o
cliente só descobre a chave da recepção ao parear pela rede local.

- Configurações › Armazenamento › Conexão, no computador que guarda os dados: "Conectar
  computador" e "Conectar celular". Cada um mostra um QR e o mesmo conteúdo em texto
  (`AURI1:<chave pública do servidor>:<código>`), borrado até clicar (`ui/sensitive.tsx`). Só a
  chave e o código, nenhum dado de paciente.
- O celular lê o QR com a câmera, dentro do app. O consultório cola o texto. Os dois pareiam de
  qualquer rede.
- Enquanto houver um código válido (5 minutos, uso único, 5 tentativas), o servidor aceita pela DHT
  uma chave ainda não pareada, só para o `hello` com a prova HMAC. Fora disso, o `firewall` continua
  barrando. Achar o servidor pela DHT exige a chave dele, que só está no QR.
- **Tipo e nível ficam presos ao código**, decididos no computador ao gerá-lo. O aparelho
  não declara o próprio tipo, então não consegue se promover.
- O aparelho pareado é gravado em `conexao.json` com `tipo` e `nivel` (padrão
  `computador` para os já pareados). A lista mostra o tipo e o nível. Remover derruba a conexão,
  como hoje.

## Permissões do celular (no servidor)

Um módulo novo (`desktop/src/main/net/celular.ts`) fica entre o servidor e `runOperation` para os
pedidos de aparelhos do tipo celular. Só estes canais passam; qualquer outro responde "Não
disponível no celular".

- **Pacientes (leitura):** `patients:list`, `patients:get`, `appointments:listByPatient`,
  `attendance:listByPatient`, `anamneses:get` (só nível Fono).
- **Agenda:** `appointments:listRange`, `create`, `move`, `update`, `remove`, `scheduleOnReserve`;
  `commitments:listRange`, `create`, `update`, `remove`; `attendance:sign`, `attendance:void`;
  `finance:sessionStatus`, `finance:chargeAbsence`, `finance:renewPackage`; `confirmacoes:lista`,
  `enviar`, `receber`, `aplicarOutra`, `avisos`, `dispensar`; `waitlist:list`, `getByPatient`,
  `add`, `update`, `close`; `encaixe:sugerir`, `encaixe:quemCabe`.
- **Configuração (leitura):** `clinic:get`, `tipos:list`.

Regras:

- Nas gravações da agenda, o campo de evolução é descartado (mesma regra de `withoutEvolution` em
  `desktop/src/main/reception.ts`), então o celular nunca escreve evolução, em nenhum nível.
- No nível Recepção, as respostas passam por `redactEvolution` e `anamneses:get` é recusado, com a
  mesma regra que o computador da recepção já tem.
- `computador` (quem fez) é preenchido pelo servidor com o nome do aparelho pareado, não pelo que o
  celular manda.
- Sobreposição (`assertSlotFree`), edição concorrente (`updated_at`) e as regras de presença
  assinada valem igual: a mensagem de erro aparece no app.

## Contrato e versões

- O `hello` do desktop exige protocolo e versão do banco iguais, o que funciona porque os
  computadores atualizam juntos. O celular manda `api: N`, e o servidor aceita de `API_MINIMA` até
  `API_ATUAL`.
- O celular não recebe as linhas do banco: recebe formatos do contrato. Adaptadores em
  `celular.ts` montam esses formatos, então uma migração no desktop não quebra o app instalado.
- Fixtures por versão do contrato (como em `web/contrato/`) e teste que falha se um formato
  aceito mudar.
- Servidor mais antigo que o app: o servidor velho ignora `api`, recusa pela versão do banco, e o
  app mostra "Atualize o Auri do computador que guarda os dados".
- Entra nas Code Review Rules como P1, junto do feed de atualização: o desktop não pode deixar de
  aceitar uma versão do app do iPhone ainda em uso.

## Configurações que vão para o celular

| O quê                                       | De onde                                | Como                                                                                               |
| ------------------------------------------- | -------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Dados da clínica: nome, logo, funcionamento | banco (`clinic:get`)                   | já existe; o tópico `clinic` avisa mudança. O funcionamento define a grade da agenda.              |
| Etiquetas: nome, categoria, cor, duração    | banco (`tipos:list`)                   | já existe; tópico `types`. A duração da etiqueta preenche a da sessão, como no desktop.            |
| Tema, cores, fundo e tamanho do texto       | não copia                              | o iPhone segue o tema, as cores do sistema e o tamanho de texto (Dynamic Type), como a HIG pede.  |
| Barra lateral, atalhos                      | não se aplica                          |                                                                                                    |

- A cor da etiqueta aparece como marcador ao lado do nome, nunca como fundo do texto, então o texto
  fica sempre na cor do sistema e com contraste.
- Nome e logo da clínica e etiquetas ficam guardados no iPhone para o app abrir já com a cara certa
  antes de conectar. Nenhum dado de paciente vai junto.

## Telas

**Agenda** (tudo o que a agenda do computador faz, menos escrever evolução)

- Abre no dia de hoje; voltar leva ao mês e depois ao ano, como no Calendário.

- Dia, na grade do horário de funcionamento, e Semana. Trocar de dia e voltar para hoje.
- Sessões e compromissos com a cor da etiqueta e o nome curto do paciente (`shared/names.ts`).
- Marcar sessão: paciente (busca), data, hora, etiqueta e duração. Também sobre uma reserva. A
  repetição semanal não existe no desktop hoje; entra no celular quando entrar lá.
- Detalhe da sessão: remarcar (no formulário ou arrastando na grade), desmarcar, presença
  (assinatura do paciente ou responsável na tela do iPhone; desfazer com motivo), falta e cobrança
  da falta, situação financeira da sessão e renovação de pacote. A evolução aparece só em leitura,
  no nível Fono.
- Compromissos: criar, editar, excluir.
- Confirmação: pedir pelo WhatsApp do iPhone ou copiar a mensagem, receber a resposta colada,
  avisos e dispensar.
- Lista de espera e encaixe: sugerir horários, ver quem cabe numa vaga, adicionar, editar e fechar.
- Quando a agenda muda em outro aparelho, a tela atualiza sozinha e mostra o aviso.

**Pacientes**

- Lista com busca (mesma regra de `shared/search.ts`); tocar abre o paciente.
- Paciente com quatro partes, só leitura: Ficha (dados, responsável e contato, com o telefone
  tocável), Sessões (próximas e passadas, com presença), Anamnese (por temas) e Evoluções (por
  data), as duas últimas só no nível Fono. Daqui também dá para marcar uma sessão.
- Sem criar ou editar paciente, anamnese ou evolução.

**Avisos**

- Como no computador: quando outro aparelho marca, remarca, desmarca, registra falta ou chegada, o
  iPhone mostra uma notificação com o mesmo texto do desktop (`noticeText` de
  `shared/agenda-notice.ts`, calculado no worklet). Tocar abre a agenda no dia e na hora.
- Notificação local, sem servidor: só chega com o Auri aberto ou recém-fechado. Com o app fechado
  de vez, só por push da Apple, que precisa de um servidor nosso repassando dado cifrado (decisão à
  parte).
- A permissão é pedida ao entrar no app depois de conectar; Conexão › Avisos liga e desliga. Com as
  prévias escondidas na tela bloqueada, aparece só "Mudança na agenda".

**Widgets**

- "A seguir", como o widget do Calendário: pequeno (próxima sessão), médio (as próximas três) e
  grande (o resto do dia) na tela inicial; na tela bloqueada, linha, retângulo e círculo, só com
  horários e contagem. Tocar abre a agenda no horário.
- O widget não conecta ao computador: o app grava um resumo de hoje e amanhã no App Group
  (`group.com.auri.ios`, gravação atômica, proteção até o primeiro desbloqueio) sempre que a agenda
  carrega, e o iOS acorda o app de tempos em tempos (`BGAppRefreshTask`) para atualizar.
- Mostra o nome curto do paciente (`shortName`), o horário e a etiqueta. Conexão › Widgets esconde
  os nomes. O nome é marcado como privado, então nunca aparece com o iPhone bloqueado.
- "+" no canto, como no Lembretes: abre o Auri em "Nova sessão" (`AbrirNovaSessao`, que abre o app
  antes de rodar). O mesmo botão existe para a Central de Controle e o botão de Ação.
- Widget não aceita digitação: marcar sem abrir o app é pela Siri, pelo Spotlight ou pelos Atalhos
  ("Marcar sessão no Auri", `MarcarSessao` com App Intents). Pede o Face ID, conecta ao computador
  em segundo plano, pergunta paciente e horário e respeita as regras do desktop (horário de
  funcionamento, sobreposição).
- Esquecer o computador apaga o resumo.

**Estados:** conectando; conectado pela rede da clínica ou pela internet; sem conexão (computador
desligado, sem internet ou rede restritiva), com "Tentar de novo"; acesso removido; versão
incompatível. Os textos seguem os do consultório.

## Design

O app segue as [Human Interface Guidelines](https://developer.apple.com/design/human-interface-guidelines)
do iOS 27 (Liquid Glass), com componentes do sistema como vêm. Onde a HIG e
`docs/identidade-visual.md` divergem, vale a HIG.

**Cor, fonte e aparência**

- Tema: segue o claro/escuro do iPhone. Sem ajuste de aparência no app
  ([Dark Mode](https://developer.apple.com/design/human-interface-guidelines/dark-mode)).
- Cores: as do sistema, inclusive a cor de destaque padrão
  ([Color](https://developer.apple.com/design/human-interface-guidelines/color)).
- Barras de abas e de ferramentas em Liquid Glass monocromático, porque a agenda é colorida. Liquid
  Glass só nos controles, nunca nas sessões da grade
  ([Materials](https://developer.apple.com/design/human-interface-guidelines/materials)).
- Etiquetas sempre com o nome junto da cor, nunca só a cor.
- Fonte: só a do sistema (SF Pro), nos estilos de texto com Dynamic Type
  ([Typography](https://developer.apple.com/design/human-interface-guidelines/typography)).
- Listas e separadores: os da `List` do sistema.

**Navegação**

- Barra de abas com Agenda e Pacientes, rótulo de uma palavra e SF Symbol preenchido. Sempre
  visível. Sem conexão, as abas continuam lá e mostram o estado
  ([Tab bars](https://developer.apple.com/design/human-interface-guidelines/tab-bars)).
- Títulos curtos, título grande que encolhe ao rolar, botões padrão de voltar e fechar, símbolos sem
  contorno. Uma ação principal por tela, à direita; o resto num menu Mais
  ([Toolbars](https://developer.apple.com/design/human-interface-guidelines/toolbars)).
- Abas Agenda, Pacientes e Conexão. Conexão mostra o computador, o estado, o teste pela internet e
  "Esquecer este computador".

**Agenda**

- Dia e Semana num segmented control. "Hoje" como botão de texto. "+" (Marcar sessão) como ação
  principal. Lista de espera, encaixe e confirmações no menu Mais
  ([Segmented controls](https://developer.apple.com/design/human-interface-guidelines/segmented-controls)).
- Sessão na grade: tocar abre o detalhe (empilhado na navegação); tocar e segurar abre o menu de
  contexto com as mesmas ações do detalhe, Desmarcar por último e em vermelho
  ([Context menus](https://developer.apple.com/design/human-interface-guidelines/context-menus)).
- Arrastar para remarcar mostra se o horário aceita, avisa quando não dá e permite desfazer. O botão
  Remarcar faz o mesmo sem gesto
  ([Drag and drop](https://developer.apple.com/design/human-interface-guidelines/drag-and-drop)).
- Desmarcar abre um action sheet saindo do botão ("Desmarcar só esta", "Esta e as próximas",
  Cancelar). Sem alerta para ação comum que se desfaz
  ([Action sheets](https://developer.apple.com/design/human-interface-guidelines/action-sheets)).
- Marcar sessão numa sheet: Cancelar à esquerda e Marcar à direita. Data e hora em picker compacto
  de 5 em 5 minutos; etiqueta e duração em menu; paciente numa lista com busca; Repetir toda semana
  num toggle. Fechar com alteração não salva pede confirmação
  ([Sheets](https://developer.apple.com/design/human-interface-guidelines/sheets),
  [Pickers](https://developer.apple.com/design/human-interface-guidelines/pickers)).
- Assinatura de chegada em modal de tela cheia, para o gesto de assinar não fechar a tela
  ([Modality](https://developer.apple.com/design/human-interface-guidelines/modality)).
- Nos tamanhos de texto de acessibilidade, o Dia vira lista em vez de grade.

**Pacientes**

- Lista com busca na barra (placeholder "Buscar pacientes", busca enquanto digita) e indicador de
  disclosure em cada linha
  ([Search fields](https://developer.apple.com/design/human-interface-guidelines/search-fields),
  [Lists and tables](https://developer.apple.com/design/human-interface-guidelines/lists-and-tables)).
- Paciente com Ficha, Sessões, Anamnese e Evoluções num segmented control. No nível Recepção, só
  Ficha e Sessões. Marcar sessão como ação principal.

**Estados e permissões**

- Tela de abertura igual à primeira tela, sem logo nem texto; reabre onde a pessoa parou
  ([Launching](https://developer.apple.com/design/human-interface-guidelines/launching)).
- Conexão como indicador na própria tela, que mostra detalhes ao tocar, nunca alerta. Spinner com
  legenda específica ("Conectando a Recepção…"); dados já carregados ficam na tela; puxar para
  atualizar como extra
  ([Loading](https://developer.apple.com/design/human-interface-guidelines/loading),
  [Feedback](https://developer.apple.com/design/human-interface-guidelines/feedback)).
- Erro perto do problema, dizendo como resolver. Tela vazia com o próximo passo e um botão
  ("Conectar ao computador da clínica").
- Câmera pedida só ao tocar em "Ler QR code", aberta em modal de tela cheia. Textos de permissão em
  frase completa: "O Auri usa a câmera para ler o QR code mostrado no computador da clínica." e
  "O Auri procura o computador da clínica nesta rede para conectar mais rápido."
  ([Privacy](https://developer.apple.com/design/human-interface-guidelines/privacy)).
- Bloqueio: "Desbloquear com Face ID" (ou Touch ID, conforme o aparelho), com o código do iPhone
  como alternativa do sistema
  ([Managing accounts](https://developer.apple.com/design/human-interface-guidelines/managing-accounts)).

**Acessibilidade**

- Alvos de toque de 44×44 pt; sessão curta na grade ganha altura mínima para isso.
- Contraste de 4,5:1 no texto (7:1 como meta nas cores da clínica e das etiquetas); testar com
  Aumentar Contraste e Reduzir Transparência.
- VoiceOver lê cada sessão por inteiro ("Sessão, Ana S., 14h às 14h45, Avaliação"). Todo gesto tem
  botão equivalente
  ([Accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility)).

## Segurança do aparelho

- Conexão › Face ID: "Exigir Face ID", ligado por padrão, como nos apps de banco. O app pede o Face
  ID (ou o código do iPhone) ao abrir e ao voltar do segundo plano, imediatamente ou depois de 1, 5
  ou 15 minutos. Ligar ou desligar pede o Face ID antes. A HIG prefere o "Exigir Face ID" do próprio
  iOS; o ajuste no app ficou a pedido, por serem dados de saúde.
- Dados de pacientes só em memória: nada em log, e a tela fica coberta na miniatura do alternador de
  apps. A exceção é o resumo de hoje e amanhã para os widgets (abaixo).
- O bloqueio e a capa ficam numa janela própria acima de tudo, para nenhuma folha aberta aparecer
  por cima deles.
- Chave do aparelho no Keychain, só neste aparelho e fora do backup do iCloud
  (`kSecAttrAccessibleWhenUnlockedThisDeviceOnly`).
- A mensagem de confirmação vai para o WhatsApp do iPhone pelo esquema do próprio app, sem passar
  por site nem link curto. O PR passa pelo `/security-review`.
- Sem relatório de erro próprio na primeira versão.
- Celular perdido: remover em Conexão derruba e impede a conexão.

## Distribuição

- **TestFlight = alpha:** cada build de teste vai para o grupo de testadores (a fono e a
  secretária). Builds vencem em 90 dias, o que combina com o ritmo do alpha. O primeiro build de
  cada versão para testadores de fora da conta passa por uma revisão curta da Apple.
- **App Store = estável:** a mesma build, promovida depois de testada. A revisão precisa de um jeito
  de usar o app sem a clínica: modo demonstração com dados fictícios.
- Conta Apple Developer: a mesma da assinatura do Mac.
- Envio pelo `ci:mac` local primeiro; workflow no GitHub só depois, com a chave da App Store Connect
  como segredo e as regras de workflow do AGENTS.md.

## Riscos

- **NAT restritivo nos dois lados:** muitas operadoras de 4G/5G usam CGNAT. Se o roteador da clínica
  também for restritivo, a conexão direta falha. Por isso a prova de conceito vem antes de qualquer
  tela. Se falhar com frequência, a saída é um relay que só repassa dado cifrado, mas isso é um
  servidor nosso e uma decisão à parte.
- **Bare no iOS:** quais módulos do cliente rodam sem mudança, além do tamanho e da memória do app.
- **Teste real entre duas redes do desktop** ainda pendente desde 13/10: entra na prova de conceito.

## Etapas (um PR cada)

1. **Prova de conceito**, sem tela: worklet no iPhone conecta ao servidor pela DHT, a partir do 4G
   e da Wi-Fi, faz `hello` e `patients:list` com dados fictícios. Decide se seguimos.
2. **Desktop: pareamento por QR**, com código preso a tipo e nível, pareamento pela DHT com código
   ativo e tipo na lista de aparelhos. Já serve o consultório de fora.
3. **Desktop: contrato do celular**, com `api`, lista de canais, adaptadores, níveis e fixtures.
4. **iOS: pareamento, bloqueio e Agenda** (ver dia e semana).
5. **iOS: sessões e compromissos** (marcar, repetir, remarcar, arrastar, desmarcar, reserva).
6. **iOS: presença, falta e financeiro da sessão.**
7. **iOS: confirmação, lista de espera e encaixe.**
8. **iOS: Pacientes** (ficha, sessões, anamnese, evoluções).
9. **Distribuição:** TestFlight como alpha e modo demonstração para a App Store.

## Testes

- Desktop (Vitest): código preso a tipo e nível; celular recusado fora da lista; nível Recepção sem
  anamnese e com evolução apagada; celular não grava evolução; `api` dentro e fora da faixa;
  pareamento pela DHT só com código ativo (`hyperdht/testnet`); fixtures do contrato.
- iOS: XCTest para o contrato e o pareamento; testes de interface no simulador contra um servidor
  fictício numa DHT local.
- Manual: iPhone real no 4G e na Wi-Fi da clínica; servidor no Mac e no Windows.
- Só dados fictícios.

## Fora do escopo

Criar ou editar paciente, anamnese e evolução; termos; financeiro fora da sessão; relatórios e
PDFs; Configurações da clínica no celular; avisos com o app fechado (push); uso sem conexão; iPad e Android (o mesmo
worklet serve o Android depois).
