# Financeiro (base) — design

Data: 19/10/2026. Estado: implementado na trilha F1 (base) e na F2 (registro da sessão). A cobrança
automática de falta não respondida é de outra trilha e só chama `cobrarFalta`.

## Pedido

"Ter controle de pagamento das sessões, pagamento por sessão, pacote ou convênio, lugar para criar
valores e pacotes." Nas fichas de papel a clínica usa uma tabela DATA / PRESENÇA / PAGAMENTO e
pacotes como "8 sessões por R$ 1.520", com a contagem 1/8, 2/8…

Sucesso: a secretária abre a ficha de um paciente, vê "Em aberto R$ 380,00", o pacote "3 de 8" e
o extrato; registra um Pix em três cliques; na tela Financeiro vê quem está devendo e quanto entrou
no mês.

## Fora do escopo

- Gateway de pagamento, cobrança por link, boleto, Pix com QR Code, nota fiscal, recibo em PDF.
- Cobrança automática de falta não confirmada (trilha da confirmação automática).
- Relatórios contábeis, comissão de profissional, despesas da clínica.

## Decisões

### Tudo local, em centavos

Tudo fica no banco da recepção, como o resto, e passa pelas operações de `main/operations.ts`, que
funcionam também pela conexão do consultório. Valores são inteiros em centavos
(`valor_centavos`). A formatação e a leitura de "R$ 1.520,00" ficam em `shared/money.ts`, com
teste, e não usam `Intl` (o espaço do `Intl` muda de sistema para sistema).

### Cadastro: Valores, pacotes e convênios ficam no Financeiro, não na Clínica

O menu principal ganha **Financeiro**. Os cadastros ficam numa subtela dele
(**Financeiro / Valores e convênios**, `/financeiro/valores`), aberta por um ícone do cabeçalho e
pelo estado vazio. Por quê:

- A Clínica é "como a clínica aparece nos documentos" (logo, nome, profissional, termos). Preço não
  aparece em documento nenhum e tem outro dono: quem cuida do dinheiro.
- A Clínica é um formulário só, com "Salvar alterações"; serviços, pacotes e convênios são listas
  com edição própria e arquivamento.
- Quem registra um pagamento e não acha o preço certo está a um clique dele, na mesma área.

### Catálogo

- **Valor** (`finance_services`; na tela, "Valores"): nome e valor. Ex.: Sessão R$ 190,
  Avaliação R$ 400, Relatório R$ 150.
- **Modelo de pacote** (`finance_plans`): nome, número de sessões, valor total e validade opcional
  em dias. Ex.: "8 sessões" por R$ 1.520, válido por 60 dias.
- **Convênio** (`finance_insurers`): nome e valor que o convênio paga por sessão.

Nenhum deles é apagado: sai da lista de escolha ao **arquivar** e pode voltar. Nome e valor podem
ser corrigidos, porque cada lançamento guarda uma cópia do nome e do valor da hora em que foi feito;
corrigir o catálogo não muda o passado.

### Forma de cobrança do paciente

Cada paciente tem uma forma de cobrança (`finance_billing`, uma linha por paciente, editável):

| Forma         | Guarda                             | Ao lançar uma sessão                                 |
| ------------- | ---------------------------------- | ---------------------------------------------------- |
| `particular`  | o serviço da sessão (ex.: R$ 190)  | cobra o valor do serviço da família                  |
| `pacote`      | o serviço para sessões fora dele   | consome 1 sessão do pacote em vigor                  |
| `convenio`    | o convênio e o nº da carteirinha   | cobra do convênio o valor por sessão                 |

A carteirinha fica nessa tabela, e não em `patients`, para o financeiro não mexer na ficha
(outra trilha) e para a ficha não precisar saber de convênio.

Sem forma definida, o paciente não tem financeiro: a aba mostra o convite "Definir forma de
cobrança" e nada é lançado.

### Lançamentos que não somem

Quatro tabelas de lançamentos, todas com o mesmo contrato das assinaturas: **não há UPDATE nem
DELETE**, só o **estorno**, que grava motivo, computador e quando (`estornado_em`,
`estorno_motivo`, `estorno_computador`), uma vez. Gatilhos no banco garantem isso.

- **Cobrança** (`finance_charges`): o que alguém deve. Paciente, data, descrição, valor, motivo,
  sessão (opcional), pacote (opcional) e convênio (opcional; preenchido quando quem deve é o
  convênio, não a família).
- **Pagamento** (`finance_payments`): o que entrou. Paciente, data, valor, forma (`pix`,
  `dinheiro`, `cartao`, `transferencia`), observação e convênio (opcional; quando quem pagou foi o
  convênio).
- **Pacote contratado** (`finance_packages`): paciente, cópia do modelo (nome, sessões, valor),
  início e validade. Contratar cria, na mesma transação, a cobrança `pacote` do valor total.
- **Uso do pacote** (`finance_package_uses`): a sessão que consumiu uma vaga do pacote.

Motivos da cobrança:

| Motivo          | Quando                                                              |
| --------------- | ------------------------------------------------------------------- |
| `sessao`        | sessão com presença, particular ou convênio                         |
| `falta_cobrada` | falta que a clínica decidiu cobrar (e a confirmação automática)     |
| `pacote`        | contratação de um pacote, pelo valor total                          |
| `avulsa`        | qualquer outro serviço (avaliação, relatório) lançado à mão         |

Uma sessão tem no máximo um lançamento em vigor: uma cobrança `sessao`/`falta_cobrada` **ou** um
uso de pacote (índices únicos parciais `WHERE estornado_em IS NULL` e checagem na operação).
Estornar libera a sessão para ser lançada de novo.

Estornar um pacote estorna também a cobrança dele e só é aceito sem usos em vigor (estorne os usos
antes, ou eles iriam para um pacote que não existe mais).

### A cobrança da sessão é gerada, não calculada

A cobrança é um **lançamento gravado** no momento em que a sessão é lançada, e não um cálculo
feito toda vez a partir da presença e da forma de cobrança. Calculado, trocar o preço do serviço ou
a forma de cobrança mudaria o que o paciente deve hoje por sessões do mês passado; gravado, cada
sessão guarda o valor da época, e o que mudou fica no extrato como estorno.

O lançamento é feito por `lancarSessao(db, appointmentId, computador)` (`main/db/finance.ts`):

- exige presença `presente` (que, desde 19/10, só existe com a chegada assinada);
- aplica a forma de cobrança do paciente;
- no pacote, consome a vaga do **pacote mais antigo** que ainda tem sessões e vale na data da
  sessão. Sem pacote em vigor, a sessão é cobrada avulsa pelo serviço da forma de cobrança, com
  "fora do pacote" na descrição;
- avaliação (`tipo = 'avaliacao'`) nunca consome pacote; em "A lançar", lançar uma avaliação
  pergunta qual valor cobrar (sugere o que começa com "Avalia");
- a descrição é "Sessão de 14/10", com o nome do valor só quando ele não é "Sessão"/"Avaliação"
  ("Sessão de 14/10 · Sessão social"), e "fora do pacote" quando for o caso.

**Na chegada (F2):** `signArrival` chama `lancarNaChegada` na mesma transação, se o paciente tem
forma de cobrança. Um erro do financeiro nunca impede a assinatura: o lançamento desfaz só a parte
dele (savepoint), o erro vai para o log e a sessão fica em **A lançar**, que continua na aba
Financeiro como conferência (sessões que escaparam e as de antes da F2), com "Lançar" e "Lançar
todas".

**Ao anular a assinatura:** `voidArrival` estorna, na mesma transação, o lançamento em vigor daquela
sessão (cobrança ou uso do pacote) com **o mesmo motivo** e o mesmo computador da anulação. A
sessão com assinatura anulada não volta para "A lançar" e `lancarSessao` a recusa; assinar de novo
lança de novo.

**Falta:** `cobrarFalta(db, appointmentId, computador)` cria a cobrança `falta_cobrada` pelo valor
cheio do valor da sessão da forma de cobrança, também para quem tem pacote ou convênio (a família
paga; a vaga do pacote não é usada). Exige presença `falta` ou `desmarcou`, não tem tela própria e
não pergunta nada: a confirmação automática chama direto, com o nome dela no `computador`. No
registro da sessão, o botão "Cobrar sessão" pede confirmação ("Cobrar R$ 190,00?").

### Saldo e situação de cada cobrança

`saldo = cobranças em vigor − pagamentos em vigor`, separado por quem paga: a **família** (sem
convênio) e cada **convênio**. O que o convênio deve não aparece como dívida da família. Saldo
negativo é crédito (pagou adiantado).

Pagamento não é ligado a uma cobrança: é uma conta corrente, como a tabela de papel. A situação de
cada cobrança (paga, parcial, em aberto) é **calculada** distribuindo os pagamentos pelas cobranças
mais antigas primeiro (por data, depois pela ordem de lançamento), separadamente para família e
convênio. `situacaoSessoes(db, appointmentIds)` devolve, para a F2, a situação de cada sessão:
`sem_lancamento`, `pacote` (com "3/8"), `pago`, `parcial` ou `em_aberto` (com o convênio, se for o
caso).

### Telas

- **Financeiro** (menu principal, `/financeiro`): mês com ‹ › ; **Em aberto**, os pacientes com
  saldo da família a receber (maior primeiro, com a data da cobrança mais antiga em aberto);
  **Convênios a receber**, por convênio; **Recebimentos do mês**, a lista dos pagamentos com total
  por forma. O botão principal **Registrar pagamento** abre o diálogo com a busca de paciente.
- **Valores e convênios** (`/financeiro/valores`): três seções no padrão da Clínica (título à
  esquerda, lista à direita): Serviços, Pacotes e Convênios, cada item editável num diálogo, com
  arquivar.
- **Aba Financeiro da ficha** (`/pacientes/:id/financeiro`): resumo (em aberto ou crédito, a
  receber do convênio), forma de cobrança com "Alterar", pacote em vigor com a contagem "3 de 8" e
  a validade (um quadrado por sessão, cheio quando usada, como o 1/8, 2/8 do papel), **A lançar**,
  e o **Extrato**: cobranças e pagamentos juntos, do mais novo ao mais
  velho, cada cobrança com a situação; o estornado fica riscado com o motivo. Ações: Registrar
  pagamento (principal), Cobrar (serviço avulso), Contratar pacote, Estornar (pede motivo).
- **Registro da sessão** (`AppointmentDialog`, componente `SessionPayment`): numa sessão que já
  começou e tem presença, um bloco "Pagamento" com o pacote e a contagem ("8 sessões · sessão 3 de
  8"), ou o valor e a situação ("R$ 190,00 · em aberto", "Saúde Fictícia · R$ 95,00 · a receber do
  convênio"). Ações: **Abrir financeiro** (fecha o diálogo e vai para a aba), **Registrar
  pagamento** (cobrança da família ainda não paga) e **Cobrar sessão** (falta sem cobrança).
- **Aba Sessões:** cada sessão anterior ganha uma linha discreta embaixo da presença: "3/8 do
  pacote", "Pago", "Em aberto", "Parcial", "Convênio" (numa falta cobrada, a linha já diz "Faltou").
- **Agenda: nenhuma marca.** Avaliado e deixado de fora: o cartão já é estreito (nome curto na
  semana e no mês) e qualquer marca disputa espaço com o nome; o saldo é uma conta corrente do
  paciente, então "em aberto" numa sessão é a distribuição dos pagamentos, não uma dívida daquela
  sessão, e marcaria várias sessões de quem só deve uma; e a agenda é a tela do consultório
  também, onde valores não ajudam a terapeuta. Quem cuida do dinheiro vê o bloco Pagamento ao abrir
  a sessão e a lista Em aberto no Financeiro.

### Pacote do paciente e renovação (20/10)

Pedidos da clínica: a forma de cobrança não mostrava os pacotes, o Cobrar não oferecia pacote e a
recepção contava à mão quantas sessões do pacote já tinham sido usadas.

- **Forma de cobrança `pacote` guarda o pacote** (`finance_billing.plan_id`, obrigatório na tela).
  A migração preenche com o modelo do último pacote contratado. Sem pacote em vigor, o diálogo
  oferece **Contratar agora** com a data de início (ligado por padrão só para quem nunca teve
  pacote); salvar e contratar acontecem na mesma transação.
- **Cobrar** lista os pacotes junto com os valores. Escolher um pacote contrata (mesmo efeito de
  Contratar pacote), com a data como início.
- **Contratar absorve as sessões fora do pacote:** ao contratar um pacote com início D, as sessões
  cobradas "fora do pacote" a partir de D (e até a validade, até acabarem as vagas, das mais
  antigas para as mais novas) têm a cobrança estornada com o motivo "Passou para o pacote" e
  passam a usar uma vaga do pacote novo. Um pagamento já feito para essa cobrança vira crédito,
  que abate a cobrança do pacote.
- **Renovação:** com forma `pacote`, quando resta 1 sessão nos pacotes em vigor, ou quando o
  último pacote acabou ou venceu, a aba Financeiro avisa ("Resta 1 sessão do pacote", "O pacote
  acabou", "O pacote venceu") com **Renovar**; o Financeiro lista os **Pacotes a renovar** e o
  registro da sessão mostra **Renovar pacote**. Renovar contrata o pacote da forma de cobrança
  (ou, sem ele, o do último pacote) com início **hoje**, ou na data da primeira sessão fora do
  pacote desde o início do último pacote, se for antes, para que ela entre no novo. Renovado
  antes de acabar, a sessão que restava continua sendo usada primeiro (pacote mais antigo).
- A contagem do pacote diz "3 de 8 usadas · restam 5".

### Tópico de dados

`finance`: toda operação que grava avisa esse tópico, e as telas do financeiro recarregam. Mudar
paciente ou sessão também avisa `patients`/`appointments`; a aba Financeiro escuta os dois
(nome do paciente, presença das sessões "A lançar").

## Em aberto para o usuário

1. **Lançar sozinho na assinatura da chegada:** feito na F2, com "A lançar" como conferência.
   Confirmar com a clínica.
2. **Sessão sem pacote em vigor** é cobrada avulsa pelo valor da sessão (feito). A clínica prefere
   isso ou um aviso para contratar o próximo pacote antes?
3. **Pacote vencido com sessões sobrando**: hoje as vagas simplesmente deixam de valer. A clínica
   costuma estender a validade? (Daria para editar a validade com registro.)
4. **Convênio com coparticipação** (o convênio paga parte, a família o resto): não existe na F1.
5. **Falta cobrada**: cobra o valor cheio da sessão (feito), também de quem tem pacote ou
   convênio. A alternativa seria consumir a vaga do pacote em vez de cobrar.
6. **Marca na agenda**: nenhuma (ver Telas). Se a clínica quiser, o candidato é um ponto só nas
   sessões com presença ainda não lançadas, que é o único caso em que a recepção precisa agir.
7. **Avaliação** cobrada à mão como "Cobrar · Avaliação". Quando houver tipos de atendimento
   cadastráveis, cada tipo pode apontar para um serviço.
8. **Quem vê o financeiro**: o consultório também vê tudo, como o resto do app. Restringir exige
   perfis de acesso, que o Auri ainda não tem.
9. **Exportar configurações**: o catálogo (serviços, pacotes, convênios) não vai no arquivo de
   configurações ainda; a cópia de segurança leva tudo.
