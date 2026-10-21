# Confirmação de sessão pelo celular — design

Data: 19/10/2026. Estado: implementado. Falta o teste de campo com a clínica: mensagens reais no
WhatsApp e o `auri://` no app instalado.

## Pedido da clínica

> Confirmação automática: até 2 horas para confirmar; se não confirmou, o horário será desmarcado
> para outro paciente; se não tiver resposta para desmarcar ou confirmar, será cobrada a sessão; no
> sistema vai abrir espaço na agenda.

O prazo de 2 horas conta a partir do envio da mensagem.

## Objetivo

A recepção pede a confirmação das sessões pelo WhatsApp; o paciente (ou o responsável) confirma ou
desmarca com um toque no celular; a resposta volta pelo WhatsApp e o Auri atualiza a agenda. Quem
não responde no prazo perde o horário, que fica livre para um encaixe da lista de espera, e a
sessão é cobrada se a clínica cobra.

Mesmas regras dos termos (`2026-10-18-assinatura-de-termos-design.md`): nenhuma API paga do
WhatsApp, páginas no auri.dev.br, e só conteúdo cifrado sai da recepção. O site guarda por um tempo
limitado o pedido e a resposta cifrados, para o link ficar curto, sem conseguir ler (ver
[links curtos](../links-curtos.md)).

## Fluxo

```
Recepção (Auri)                  Celular do paciente                 Recepção (WhatsApp → Auri)
"Confirmações"
  um envio por sessão ─WhatsApp─▶ auri.dev.br/confirmar#<código>
  prazo: envio + 2 h              vê dia, hora, profissional e prazo
                                  "Confirmar presença" ou "Desmarcar"
                                  ──────────WhatsApp──────────────▶ auri.dev.br/resposta#<código>
                                                                     └▶ auri://confirmacao#<código>
                                                                        aplica na agenda na hora
O app confere os prazos: o que venceu sem resposta libera o horário, sugere encaixe e lança a cobrança.
```

1. A secretária abre "Confirmações" no cabeçalho da agenda: as sessões de hoje que ainda não
   começaram e as do próximo dia de atendimento, sem presença marcada. "Enviar a próxima" abre o
   WhatsApp na conversa do contato principal do paciente, com a mensagem pronta; ela tecla Enter e
   volta ao Auri, que já mostra a próxima. Cada sessão fica "Aguardando resposta" com o prazo.
2. O paciente abre o link. A página mostra a sessão, o prazo e a política, e dois botões. Confirmar
   abre o WhatsApp com a resposta pronta; Desmarcar pede uma confirmação na própria página antes.
3. A resposta chega no WhatsApp da recepção como texto legível ("Sessão confirmada: Ana ·
   quarta-feira, 22/10, às 14:00") seguido do link. A secretária clica no link; a página
   `/resposta` repassa para `auri://confirmacao#…` e o Auri aplica a resposta sem diálogo de
   conferência e mostra o que aplicou ("Ana confirmou · Sessão de quarta-feira, 22/10, às 14:00").
4. Venceu o prazo sem resposta: o Auri libera o horário, sugere encaixes da lista de espera e, se o
   link avisou a cobrança, lança a cobrança `falta_cobrada`.

## Mensagem

Montada pelo Auri (`mensagemDaIda` em `web/contrato/confirmacao/textos.ts`), curta, com tudo o que
o paciente precisa mesmo sem abrir o link:

> Olá! A Clínica Elo pede a confirmação da sessão de Ana com Fernanda na quarta-feira, 22/10, às
> 14:00. Responda pelo link até as 10:30. Sem resposta até lá, o horário fica livre para outro
> paciente e a sessão é cobrada.
> https://auri.dev.br/confirmar#…

O nome do paciente é o nome curto da agenda, e o profissional, o nome curto dele. Datas e horas
saem sempre no fuso da clínica (ver "Fuso").

## Envio em lote, dentro do horário de funcionamento

O WhatsApp não manda nada sozinho sem a API paga, então "em lote" quer dizer uma fila na tela, não
um disparo: cada envio são dois toques (Enviar no Auri, Enter no WhatsApp). O WhatsApp abre como
nos termos: no WhatsApp do Auri, se ligado, senão `whatsapp://send` ou o WhatsApp Web no navegador,
sem a mensagem na URL (ver "Abrir o WhatsApp" na assinatura de termos).

- **Quais sessões:** as de hoje que ainda não começaram e as do próximo dia de atendimento (o
  próximo dia com a clínica aberta, até 7 dias à frente), sem presença marcada
  (`listarParaConfirmar` em `desktop/src/main/db/confirmacoes.ts`).
- **Janela:** o envio só é oferecido com a clínica aberta (horário de funcionamento da tela
  Clínica) e com tempo para o prazo vencer antes de ela fechar (ninguém clicaria nas respostas). Fora
  da janela, a lista explica o motivo e até que horas dá para enviar.
- **Prazo:** `ate = envio + 2 h`, ou 15 minutos antes do início da sessão, o que vier primeiro
  (`prazoDaConfirmacao`). A hora do envio é a do clique em "Enviar" (o Auri não sabe quando a
  secretária teclou Enter; a diferença é de segundos).
- Sessão que começa em menos de 30 minutos (prazo menor que 15 minutos) não recebe pedido de
  confirmação: a lista mostra "Começa logo: ligue".
- Sem contato principal ou sem celular na ficha, ou sem nome, WhatsApp ou profissional na tela
  Clínica, o envio é recusado com o que falta.
- **Reenviar** abre o WhatsApp de novo com o mesmo link e o mesmo prazo. Remarcar a sessão ou
  marcar a presença cancela o pedido pendente: uma resposta atrasada é recusada.

## Respostas possíveis

| Resposta     | Na página                                             | No Auri                                                         |
| ------------ | ----------------------------------------------------- | --------------------------------------------------------------- |
| `confirmada` | "Confirmar presença" (um toque abre o WhatsApp)       | preenche o `confirmado_em` (o mesmo campo do confirmado manual) |
| `desmarcada` | "Desmarcar" e depois "Desmarcar sessão" (dois passos) | `presenca = 'desmarcou'`; horário livre, sem cobrança           |

Desmarcar dentro do prazo não é cobrado; só a falta de resposta é. Para remarcar, a página manda
falar com a clínica: remarcar pede escolher horário, e isso fica com a secretária. A página não tem
campo de texto: quem quiser explicar escreve na própria conversa. A mensagem não oferece responder
"SIM" por texto; quem responde assim é tratado à mão, e confirmar à mão com um pedido aguardando
conclui o pedido como confirmado.

**Uma resposta por envio.** A primeira resposta válida conclui o envio. A mesma de novo diz "Esta
resposta já foi aplicada". Outra diferente depois (confirmou e depois desmarcou) não muda nada
sozinha: o Auri mostra "Ana mandou outra resposta" na faixa de avisos, com a ação ("Desmarcar" ou
"Confirmar") para a secretária aplicar.

## Prazo, controlado pelo app da recepção

- O prazo vale pelo relógio do computador que guarda os dados. A página só avisa, pelo relógio do
  celular: passou do prazo, mostra "Passou o prazo para responder" e "Falar com a clínica" em vez
  dos botões; passou do início, "Esta sessão já passou".
- O verificador (`processarPrazos`, operação `confirmacoes:prazos`) roda no main do computador que
  guarda os dados, ao abrir e a cada minuto, e também antes de cada envio e de cada resposta; o
  outro computador não roda, para não processar duas vezes. O que venceu com o app fechado é
  processado quando ele abre, com o prazo como hora do vencimento.
- O verificador cancela o pedido de sessão remarcada ou com presença marcada, conclui o confirmado
  à mão e vence o resto.
- **Resposta que chega depois do vencimento mas foi dada no prazo:** a secretária pode demorar a
  clicar. O `em` da resposta é a hora do celular e quem tem o link pode escrever qualquer hora nele,
  então o Auri não desfaz nada sozinho: se o `em` é anterior ao prazo, com 5 minutos de tolerância,
  mostra "respondeu depois do vencimento" e pede para conferir na conversa do WhatsApp a hora em
  que a mensagem chegou. Ao aplicar, devolve o horário se ainda está livre (senão avisa que foi
  ocupado) e estorna a cobrança. Uma resposta com `em` depois do prazo e da tolerância é recusada.
- **Sessão que mudou depois do pedido:** resposta de um pedido cuja sessão foi remarcada, ou cuja
  presença já foi marcada, não muda a agenda ("combine com a família").

## Sem resposta

Ao vencer, numa transação só:

1. A sessão fica com `presenca = 'desmarcou'`, que não bloqueia o horário, e o pedido como
   `vencido`. Na agenda, o cartão mostra "Sem resposta, horário liberado".
2. A faixa de avisos acima da agenda mostra o horário liberado, com "Encaixar", que abre o painel
   de encaixe com quem cabe na lista de espera.
3. Se o link avisou a cobrança (`cob`), `cobrarFalta` lança `falta_cobrada` no valor da sessão,
   ligada a ela e estornável pela secretária. Se a cobrança não puder ser lançada, o motivo fica no
   aviso.

**Cobra ou não (`cob`):** o link avisa a cobrança quando a forma de cobrança do paciente tem um
valor de sessão (`billingFor(…)?.service_id`), que é quando `cobrarFalta` consegue lançar. O
vencimento só cobra quando o envio avisou: valor definido depois do envio não vale para esse
pedido.

**Remarcar desfaz a falta:** remarcar a sessão, trocar o paciente ou tirar a falta ou o desmarcou na
agenda estorna a cobrança `falta_cobrada` dela. Sessão que já passou pelo financeiro não pode ser
excluída: o Auri pede para marcar como desmarcada, e ela fica no histórico.

## Estados no agendamento

O estado não é uma coluna: o `Appointment` traz `pedido` (com o prazo), calculado do último pedido
não cancelado e do `confirmado_em` (`pedidoNaSessao` em `desktop/src/shared/confirmacao.ts`).

| Estado         | Texto                          | Quando                                     | Marca no cartão    |
| -------------- | ------------------------------ | ------------------------------------------ | ------------------ |
| (nenhum)       |                                | ainda não pedida                           |                    |
| `aguardando`   | Aguardando resposta            | envio feito, prazo correndo                | relógio            |
| `confirmado`   | Confirmou pelo link            | resposta `confirmada` ou confirmado manual | `✓`                |
| `desmarcado`   | Desmarcou pelo link            | resposta `desmarcada`                      |                    |
| `sem_resposta` | Sem resposta, horário liberado | prazo venceu                               | cronômetro cortado |

Os envios ficam em `confirmation_requests` (sessão e início dela no envio, id, nome e número de
destino, prazo, computador, conteúdo do link, chave, link longo, código, estado
`aguardando`/`respondido`/`cancelado`/`vencido`, resposta, hora do celular, hora do recebimento,
outra resposta, vencimento, cobrança lançada ou o erro dela, aviso visto). Um trigger trava o
conteúdo do pedido. A chave fica até a sessão passar, para ler resposta atrasada e repetida; link e
código são apagados quando o pedido é concluído.

## Avisos de política para o paciente

A página mostra, sempre perto dos botões:

- até quando responder, no dia e hora da clínica;
- "Sem resposta até lá, o horário fica livre para outro paciente e a sessão é cobrada." A parte
  da cobrança só aparece se a clínica cobra (`cob` no link);
- ao desmarcar: o horário fica livre para outro paciente; para remarcar, fale com a clínica;
- quando o fuso do celular é diferente do da clínica, as horas levam "horário da clínica".

## Formato do link

Mesmo envelope dos termos: base64url sem `=`, versão no começo, AES-256-GCM com uma chave por envio
(`SHA-256("auri/link/chave/" + código)`), deflate-raw antes de cifrar, a chave só no link de ida. O
link na mensagem é o curto (`#<código>`); o longo abaixo é o que fica guardado no site e a reserva
quando o site não responde. Código comum em `web/contrato/confirmacao/`, reaproveitando de
`web/contrato/assinatura/` a base64url, a cifra, a compressão, a validação de campos e os erros
(`LinkInvalido`, `LinkLongo`).

### Ida: `https://auri.dev.br/confirmar#1.<chave>.<dados>`

Dado adicional do GCM: `auri/confirmacao/1/ida`. Conteúdo, em JSON com chaves curtas:

| Campo | O que é                                                                                      |
| ----- | -------------------------------------------------------------------------------------------- |
| `id`  | id do envio, 16 bytes aleatórios (22 caracteres)                                             |
| `ate` | prazo para responder, em segundos Unix (envio + 2 h, nunca depois de 15 min antes do início) |
| `tz`  | fuso da clínica no dia da sessão, em minutos a leste de UTC (Cuiabá: −240)                   |
| `cli` | `nome` da clínica e `whats`, o número que recebe a resposta                                  |
| `pac` | `nome` curto do paciente                                                                     |
| `ses` | `ini` (início, segundos Unix), `dur` (minutos) e `prof` (nome curto do profissional)         |
| `cob` | `true` se a sessão sem resposta é cobrada                                                    |

### Volta: `https://auri.dev.br/resposta#1.<id>.<dados>`

Dado adicional: `auri/confirmacao/1/volta/<id>`. Conteúdo: `id` (igual ao de fora), `res`
(`confirmada` ou `desmarcada`), `em` (hora do celular, segundos Unix) e `tz` (fuso do celular). A
mensagem é "Sessão confirmada: <paciente> · <dia>, às <hora>" (ou "desmarcada") seguida do link.

### Tamanhos e limites

Ida com dados reais fica em torno de 400 caracteres; volta, em torno de 180. Limites do link longo:
ida até 1.000 e volta até 400, contados com `https://auri.dev.br`. Leitura recusa fragmentos acima
de 8.192 caracteres e descompressão acima de 64 KB, como nos termos.

### Fuso

A sessão viaja como instante (`ini`) mais o fuso da clínica (`tz`), e a página escreve as horas
nesse fuso, não no do celular: um familiar com o celular em Brasília vê 14:00, a hora da agenda, e
não 15:00.

## Site (`web/`)

- `/confirmar` (`web/confirmar/index.html`, código em `web/src/confirmacao/`): estados abrindo,
  navegador sem suporte, link incompleto, link que sumiu do site, sem internet, versão
  desconhecida, sessão já passou, prazo vencido, pergunta, desmarcar (segundo passo) e enviado
  ("Falta um toque", reabrir o WhatsApp ou copiar a mensagem). Os dois links de volta são montados
  ao abrir e refeitos a cada 30 s (o `em` fica com a hora do toque, com folga de 30 s). O toque
  guarda a resposta no site (até 1,5 s, senão vai o link longo) e abre o `wa.me`.
- `/resposta`: como o `/recebido`, confere só o formato, abre `auri://confirmacao#…` no
  computador e, depois de 2 s, oferece "Abrir no Auri" e "Copiar resposta"; no celular, só copiar.
  O componente é o mesmo do `/recebido` (`web/src/assinatura/Devolucao.tsx`).
- Mesma CSP fechada das páginas de termo (`connect-src 'self'`, só para `/api/links`; sem
  `unsafe-inline`), `noindex` e `rewrites` sem a barra no fim (`web/vercel.json`).
- `npm run confirmacao:teste` (em `web/`) monta uma confirmação fictícia, imprime o link e lê a
  resposta colada.

## Desktop

- `desktop/src/main/confirmacao/link.ts`: monta a ida e lê a volta de forma síncrona (`crypto` e
  `zlib` do Node), com teste cruzado contra o código da página.
- `auri://confirmacao#<resposta>` (e `?r=` ou `/`, como o `receber`) entra na caixa de entrada do
  main numa fila própria (`retirarConfirmacoes`), avisa a janela (`confirmacoes:incoming`) e a tela
  aplica pela operação `confirmacoes:receber`. O IPC encurta o link de `confirmacoes:enviar` e
  busca no site a resposta curta antes de `confirmacoes:receber`.
- Operações: `confirmacoes:lista`, `:enviar`, `:receber`, `:aplicarOutra`, `:avisos`,
  `:dispensar` e `:prazos` (o verificador; só avisa as telas quando algo mudou).
- **Telas:** botão "Confirmações" no cabeçalho da agenda (grupos "Hoje" e o próximo dia, com
  contato principal e celular, "Enviar a próxima", copiar ou abrir no WhatsApp, "Colar resposta");
  bloco "Confirmação pelo celular" no registro da sessão ("Pedir confirmação" ou "Reenviar"); marcas
  no cartão; faixa de avisos acima da agenda para os horários liberados ("Encaixar") e para a
  segunda resposta diferente ("Desmarcar"/"Confirmar"). A resposta que chega por
  `auri://confirmacao` ou "Colar resposta" é aplicada na hora e mostrada num aviso com "Encaixar"
  quando libera o horário.

## Riscos e limites

- **Quem tem o link responde.** O link vai só para o contato principal; a resposta é autenticada
  pela chave, então ninguém de fora consegue confirmar nem desmarcar por outro.
- **A secretária precisa clicar nas respostas.** É o mesmo limite dos termos. A tolerância pelo
  `em` cobre a demora; a lista mostra o que está aguardando.
- **Hora do celular.** O `em` vem do relógio do celular, que o dono pode adiantar ou atrasar. Só é
  usado para aceitar uma resposta que chegou atrasada; o caso comum vale pela hora da recepção.
- **Cobrança automática é sensível.** O lançamento fica estornável, com motivo, e a política
  precisa estar no contrato ou termo que o paciente assinou.
- **O pedido depende do site para abrir pelo link curto.** Sem internet no celular ou com o site
  fora do ar, a página mostra "Sem internet"; o pedido some do site um dia depois do prazo.
