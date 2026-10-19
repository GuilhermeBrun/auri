# Confirmação de sessão pelo celular — design

Data: 19/10/2026. Estado: implementado. Formato do link, páginas do site e leitor do desktop na
trilha H1; envio, prazo, estados, cobrança e encaixe no app na trilha H2 (sobre o financeiro F1, o
encaixe G0 e os ajustes da agenda B). Falta o teste de campo com a clínica: mensagens reais no
WhatsApp e o `auri://` no app instalado. As decisões em aberto seguem as propostas do fim.

### Na implementação (H2, 19/10)

- **Uma migração**, no fim de `MIGRATIONS`: a tabela `confirmation_requests` (um pedido por envio,
  com o conteúdo travado por trigger). O estado no agendamento não é uma coluna: o `Appointment`
  ganha `pedido` (`aguardando`, `confirmado`, `desmarcado` ou `sem_resposta`, com o prazo),
  calculado do último pedido não cancelado e do `confirmado_em`.
- **O `confirmado_em` continua o mesmo campo.** Confirmar pelo link preenche o `confirmado_em`;
  confirmar à mão com um pedido aguardando conclui o pedido como confirmado. Desmarcar pelo link ou
  sem resposta marca `presenca = 'desmarcou'`, que já não bloqueia o horário; o motivo fica no
  pedido (`respondido` com `desmarcada`, ou `vencido`).
- **Regras em `desktop/src/main/db/confirmacoes.ts`**: janela de envio, lista do próximo dia de
  atendimento, envio (ou reenvio do mesmo link), verificador do prazo, resposta e avisos. O
  verificador roda no main da recepção (quem tem o banco) ao abrir e a cada minuto; o consultório
  não roda. Cancela o pedido de sessão remarcada ou desmarcada, conclui o confirmado à mão e vence o
  resto: libera o horário, chama `cobrarFalta` e, se a cobrança não puder ser lançada (paciente sem
  forma de cobrança), guarda o motivo no aviso. A chave fica até a sessão passar, para ler resposta
  atrasada e repetida.
- **Telas:** botão "Confirmações" no cabeçalho da agenda (lista do próximo dia com contato
  principal e celular, "Enviar a próxima", copiar ou abrir no WhatsApp, "Colar resposta"); bloco
  "Confirmação pelo celular" no registro da sessão; marcas no cartão (relógio = aguardando, `✓` =
  confirmado, cronômetro cortado = sem resposta); faixa de avisos acima da agenda para os horários
  liberados ("Encaixar" abre o painel de encaixe com quem cabe) e para a segunda resposta diferente
  ("Desmarcar"/"Confirmar"). A resposta que chega por `auri://confirmacao` ou "Colar resposta" é
  aplicada na hora e mostrada num aviso com "Encaixar" quando libera o horário.
- **Cobra ou não (`cob`):** o link avisa a cobrança quando o paciente tem forma de cobrança com
  valor de sessão, que é quando `cobrarFalta` consegue lançar.

## Pedido da clínica

> Confirmação automática: até 2 horas para confirmar; se não confirmou, o horário será desmarcado
> para outro paciente; se não tiver resposta para desmarcar ou confirmar, será cobrada a sessão; no
> sistema vai abrir espaço na agenda.

O prazo de 2 horas conta a partir do envio da mensagem.

## Objetivo

A recepção pede a confirmação das sessões do dia seguinte pelo WhatsApp; o paciente (ou o
responsável) confirma ou desmarca com um toque no celular; a resposta volta pelo WhatsApp e o Auri
atualiza a agenda. Quem não responde em 2 horas perde o horário, que fica livre para um encaixe da
lista de espera, e a sessão é cobrada.

Mesmas regras dos termos (`2026-10-18-assinatura-de-termos-design.md`): nada guardado fora da
recepção, nenhuma API paga do WhatsApp, página estática no auri.dev.br que não manda nada pela
internet.

## Fluxo

```
Recepção (Auri)                  Celular do paciente                 Recepção (WhatsApp → Auri)
"Confirmações de amanhã"
  um envio por sessão ─WhatsApp─▶ auri.dev.br/confirmar#<sessão>
  prazo: envio + 2 h              vê dia, hora, profissional e prazo
                                  "Confirmar presença" ou "Desmarcar"
                                  ──────────WhatsApp──────────────▶ auri.dev.br/resposta#<resposta>
                                                                     └▶ auri://confirmacao#<resposta>
                                                                        aplica na agenda na hora
O app confere os prazos: o que venceu sem resposta libera o horário, sugere encaixe e lança a cobrança.
```

1. De manhã, a secretária abre "Confirmações de amanhã" no Auri: a lista das sessões do próximo dia
   de atendimento ainda sem confirmação. "Enviar" abre o WhatsApp na conversa do contato principal
   do paciente (trilha A), com a mensagem pronta; ela tecla Enter e volta ao Auri, que já mostra a
   próxima. Cada sessão fica "Aguardando resposta até 10:30".
2. O paciente abre o link. A página mostra a sessão, o prazo e a política, e dois botões. Confirmar
   abre o WhatsApp com a resposta pronta; Desmarcar pede uma confirmação na própria página antes.
3. A resposta chega no WhatsApp da recepção como texto legível ("Sessão confirmada: Ana ·
   quarta-feira, 22/10, às 14:00") seguido do link. A secretária clica no link; a página
   `/resposta` repassa para `auri://confirmacao#…` e o Auri aplica a resposta sem diálogo de
   conferência e mostra o que aplicou ("Ana Beatriz confirmou · Sessão de quarta-feira, 22/10, às
   14:00").
4. Venceu o prazo sem resposta: o Auri marca "Sem resposta — liberado", abre o horário na agenda,
   sugere encaixes da lista de espera e lança a cobrança `falta_cobrada`.

## Mensagem

Montada pelo Auri (`mensagemDaIda` em `web/contrato/confirmacao/textos.ts`), curta, com tudo o que
o paciente precisa mesmo sem abrir o link:

> Olá! A Clínica Elo pede a confirmação da sessão de Ana com Fernanda na quarta-feira, 22/10, às
> 14:00. Responda pelo link até as 10:30. Sem resposta até lá, o horário fica livre para outro
> paciente e a sessão é cobrada.
> https://auri.dev.br/confirmar#1.…

O nome do paciente é o nome curto da agenda, e o profissional, o nome curto dele. Datas e horas
saem sempre no fuso da clínica (ver "Fuso").

## Envio em lote, dentro do horário de funcionamento

O WhatsApp não manda nada sozinho sem a API paga, então "em lote" quer dizer uma fila na tela, não
um disparo: cada envio são dois toques (Enviar no Auri, Enter no WhatsApp). Com o WhatsApp Desktop
o Auri usa `whatsapp://send`, que abre a conversa sem passar pelo navegador.

- **Janela:** o envio só é oferecido dentro do horário de funcionamento (trilha B) e até 2 horas
  antes de fechar, para o prazo nunca vencer com a clínica fechada (ninguém clicaria nas respostas).
- **Quais sessões:** as do próximo dia de atendimento. Na sexta (ou no último dia útil da semana),
  as de segunda.
- **Prazo:** `ate = envio + 2 h`, e nunca depois do início da sessão. A hora do envio é a do clique
  em "Enviar" (o Auri não sabe quando a secretária teclou Enter; a diferença é de segundos).
- Sessão marcada para dali a menos de 2 horas não recebe pedido de confirmação.
- **Reenviar** abre o WhatsApp de novo com o mesmo link e o mesmo prazo. Remarcar a sessão cancela o
  envio pendente: uma resposta atrasada é recusada.

## Respostas possíveis

| Resposta     | Na página                                                    | No Auri                                                   |
| ------------ | ------------------------------------------------------------ | --------------------------------------------------------- |
| `confirmada` | "Confirmar presença" (um toque abre o WhatsApp)              | sessão "Confirmada" (o mesmo campo do confirmado manual)  |
| `desmarcada` | "Desmarcar" e depois "Desmarcar sessão" (dois passos)        | sessão desmarcada pelo paciente; horário livre, sem cobrança |

Para remarcar, a página manda falar com a clínica: remarcar pede escolher horário, e isso fica com
a secretária. A página não tem campo de texto: quem quiser explicar escreve na própria conversa.

**Uma resposta por envio.** A primeira resposta válida conclui o envio. A mesma de novo só reabre
o aviso. Outra diferente depois (confirmou e depois desmarcou) não muda nada sozinha: o Auri mostra
"Ana mandou outra resposta: desmarcar" com a ação para a secretária aplicar.

## Prazo de 2 horas, controlado pelo app da recepção

- O prazo vale pelo relógio do computador da recepção. A página só avisa, pelo relógio do celular:
  passou do prazo, mostra "Passou o prazo para responder" e "Falar com a clínica" em vez dos botões;
  passou do início, "Esta sessão já passou".
- O Auri da recepção confere os envios aguardando ao abrir e a cada minuto. O que venceu com o app
  fechado é processado quando ele abre, com a hora do vencimento (não a da abertura) no registro.
- **Resposta que chega depois do vencimento mas foi dada no prazo:** a secretária pode demorar a
  clicar. Se o `em` da resposta (hora do celular) é anterior ao prazo, com 5 minutos de tolerância,
  o Auri aceita e desfaz a liberação: devolve o horário se ainda está livre (senão avisa o
  conflito) e cancela a cobrança. Uma resposta dada depois do prazo é recusada, com aviso.
- O consultório não processa prazos: só a recepção, que guarda os dados, para não processar duas
  vezes.

## Sem resposta

Ao vencer, na ordem e numa transação só:

1. A sessão passa a "Sem resposta — liberado": continua visível na agenda (em traço fraco, para a
   secretária saber o que houve) mas o horário conta como livre.
2. O horário entra nas sugestões do encaixe (trilha G0): "Horário livre quarta 14:00 — 3 pacientes
   na lista de espera".
3. Uma cobrança `falta_cobrada` no valor da sessão é lançada no financeiro (trilha F1), ligada à
   sessão, cancelável pela secretária (com o motivo).

## Estados no agendamento

| Estado                        | Quando                                                    |
| ----------------------------- | --------------------------------------------------------- |
| (nenhum)                      | ainda não pedida                                          |
| Aguardando resposta até 10:30 | envio feito, prazo correndo                               |
| Confirmada                    | resposta `confirmada` ou confirmado manual da secretária  |
| Desmarcada pelo paciente      | resposta `desmarcada` ou desmarcar manual com essa origem |
| Sem resposta — liberado       | prazo venceu                                              |

Os envios ficam numa tabela própria (`confirmation_requests`: sessão, id, chave, número de destino,
enviado em, prazo, estado `aguardando`/`respondido`/`cancelado`/`vencido`, resposta e hora do
celular), como `term_requests`. A chave é apagada quando o pedido é cancelado ou quando a sessão
passa.

## Avisos de política para o paciente

A página mostra, sempre perto dos botões:

- "Responda até as 10:30 de hoje." (ou "até 21/10 às 10:30" quando não é hoje no celular)
- "Sem resposta até lá, o horário fica livre para outro paciente e a sessão é cobrada." A parte
  da cobrança só aparece se a clínica cobra (`cob` no link).
- Ao desmarcar: "O horário fica livre para outro paciente. Para remarcar, fale com a clínica."
- Quando o fuso do celular é diferente do da clínica, as horas levam "(horário da clínica)".

## Alternativa mais simples: responder "SIM"

A mensagem vai sem link ("Responda SIM para confirmar ou NÃO para desmarcar") e a secretária marca
na agenda o que chegou.

- **A favor:** não precisa de página nem de navegador no celular; funciona em qualquer aparelho;
  zero formato novo.
- **Contra:** a secretária precisa achar cada paciente na agenda e marcar à mão, dentro das 2 horas,
  senão o Auri libera o horário de quem respondeu "SIM". Respostas livres ("ok", "vou sim",
  "posso às 15?") pedem interpretação. Não há hora da resposta para resolver o "respondeu a tempo,
  mas a secretária viu tarde".
- **Com o link:** um clique na resposta aplica na sessão certa, sem procurar, com a hora em que o
  paciente respondeu, e a resposta é autenticada (só quem recebeu o link consegue responder).

**Como convivem:** o estado é um só. O confirmado manual (trilha B) e o desmarcar manual concluem o
envio pendente exatamente como uma resposta pelo link, e o prazo só age sobre o que ainda está
aguardando. Então o paciente que responde "sim" por texto continua atendido: a secretária marca
"Confirmado" e pronto. A mensagem não oferece o "SIM" (dois caminhos confundem e o texto livre pesa
para a recepção), mas o Auri não depende de o paciente usar o link.

## Formato do link

Mesmo envelope dos termos: base64url sem `=`, versão no começo, AES-256-GCM com uma chave por envio,
deflate-raw antes de cifrar, a chave só no link de ida. Código comum em
`web/contrato/confirmacao/`, reaproveitando de `web/contrato/assinatura/` a base64url, a cifra, a
compressão, a validação de campos e os erros (`LinkInvalido`, `LinkLongo`).

### Ida: `https://auri.dev.br/confirmar#1.<chave>.<dados>`

Dado adicional do GCM: `auri/confirmacao/1/ida`. Conteúdo, em JSON com chaves curtas:

| Campo | O que é                                                                                  |
| ----- | ---------------------------------------------------------------------------------------- |
| `id`  | id do envio, 16 bytes aleatórios (22 caracteres)                                         |
| `ate` | prazo para responder, em segundos Unix (envio + 2 h, nunca depois do início)             |
| `tz`  | fuso da clínica no dia da sessão, em minutos a leste de UTC (Cuiabá: −240)               |
| `cli` | `nome` da clínica e `whats`, o número que recebe a resposta                              |
| `pac` | `nome` curto do paciente                                                                 |
| `ses` | `ini` (início, segundos Unix), `dur` (minutos) e `prof` (nome curto do profissional)     |
| `cob` | `true` se a sessão sem resposta é cobrada (só muda o aviso da página)                    |

### Volta: `https://auri.dev.br/resposta#1.<id>.<dados>`

Dado adicional: `auri/confirmacao/1/volta/<id>`. Conteúdo: `id` (igual ao de fora), `res`
(`confirmada` ou `desmarcada`), `em` (hora do celular, segundos Unix) e `tz` (fuso do celular). A
mensagem é "Sessão confirmada: <paciente> · <dia>, às <hora>" (ou "desmarcada") seguida do link.

### Tamanhos e limites

Ida com dados reais fica em torno de 400 caracteres; volta, em torno de 180. Limites: ida até 1.000
e volta até 400, contados com `https://auri.dev.br`. Leitura recusa fragmentos acima de 8.192
caracteres e descompressão acima de 64 KB, como nos termos.

### Fuso

A sessão viaja como instante (`ini`) mais o fuso da clínica (`tz`), e a página escreve as horas
nesse fuso, não no do celular: um familiar com o celular em Brasília vê 14:00, a hora da agenda, e
não 15:00.

## Site (`web/`)

- `/confirmar` (`web/confirmar/index.html`, código em `web/src/confirmacao/`): estados abrindo,
  navegador sem suporte, link incompleto, versão desconhecida, sessão já passou, prazo vencido,
  pergunta, desmarcar (segundo passo) e enviado ("Falta um toque", reabrir o WhatsApp ou copiar a
  mensagem). Os dois links de volta são montados ao abrir e refeitos a cada 30 s (o `em` fica com a
  hora do toque, com folga de 30 s), e os botões são links `wa.me` comuns, para abrir o WhatsApp
  sem esperar a cifra.
- `/resposta`: como o `/recebido`, confere só o formato, abre `auri://confirmacao#…` no
  computador e, depois de 2 s, oferece "Abrir no Auri" e "Copiar resposta"; no celular, só copiar.
  O componente é o mesmo do `/recebido` (`web/src/assinatura/Devolucao.tsx`).
- Mesma CSP fechada das páginas de termo (`connect-src 'none'`, sem `unsafe-inline`), `noindex` e
  `rewrites` sem a barra no fim.
- `npm run confirmacao:teste` (em `web/`) monta uma confirmação fictícia, imprime o link e lê a
  resposta colada.

## Desktop

- `desktop/src/main/confirmacao/link.ts`: monta a ida e lê a volta de forma síncrona (`crypto` e
  `zlib` do Node), com teste cruzado contra o código da página.
- `auri://confirmacao#<resposta>` (e `?r=` ou `/`, como o `receber`) entra na caixa de entrada do
  main numa fila própria (`retirarConfirmacoes`), avisa a janela (`confirmacoes:incoming`) e a tela
  aplica pela operação `confirmacoes:receber`.
- Operações: `confirmacoes:lista`, `:enviar`, `:receber`, `:aplicarOutra`, `:avisos`,
  `:dispensar` e `:prazos` (o verificador; só avisa as telas quando algo mudou).

## Riscos e limites

- **Quem tem o link responde.** O link vai só para o contato principal; a resposta é autenticada
  pela chave, então ninguém de fora consegue confirmar nem desmarcar por outro.
- **A secretária precisa clicar nas respostas.** É o mesmo limite dos termos. A tolerância pelo
  `em` cobre a demora; a lista "Aguardando resposta" mostra o que vence primeiro.
- **Hora do celular.** O `em` vem do relógio do celular, que o dono pode adiantar ou atrasar. Só é
  usado para aceitar uma resposta que chegou atrasada; o caso comum vale pela hora da recepção.
- **Cobrança automática é sensível.** O lançamento fica cancelável, com motivo, e a política
  precisa estar no contrato/termo que o paciente assinou.

## Decisões para confirmar com a clínica

1. Desmarcar dentro das 2 horas não é cobrado (proposta); só a falta de resposta é.
2. Resposta que chega depois do prazo, mas dada no prazo pelo relógio do celular, desfaz a
   liberação e a cobrança (proposta, com 5 minutos de tolerância).
3. Segunda resposta diferente não muda nada sozinha; a secretária decide (proposta).
4. Envio para as sessões do próximo dia de atendimento, só até 2 horas antes de fechar.
5. A mensagem não oferece "responda SIM"; a resposta por texto é tratada à mão.
6. O paciente não remarca pela página, só confirma ou desmarca.
