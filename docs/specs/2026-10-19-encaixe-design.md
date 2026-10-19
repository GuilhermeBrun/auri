# Encaixe, lista de espera e compromissos — design

Data: 19/10/2026. Estado: implementado. A trilha G0 fez a lista de espera e o motor de sugestão; a
G1 fez os compromissos sem paciente, o painel de encaixe ao lado da semana, o remarcar com
sugestão, a margem de deslocamento na tela Clínica e a sessão desmarcada que libera o horário.

## Pedidos da clínica

- "Lista de pacientes para encaixe."
- "Colocar no lugar do domingo pacientes que estão esperando horário para encaixe."
- Sobre as atividades extracurriculares: "dias e horários para conseguir fazer o ajuste pelo
  sistema de remarcação, pelo menos a sugestão, batendo com os horários que o paciente tem e o que
  está disponível na agenda, para sugerir à secretária remarcar nesse horário".
- Da confirmação automática (fase seguinte): sem resposta em 2 horas o horário é liberado e o Auri
  sugere alguém da lista de espera.

## Objetivo

A secretária sabe, sem caderno, quem está esperando horário, e o Auri responde duas perguntas:

1. **Onde cabe este paciente?** Dado o funcionamento da clínica, a agenda e as atividades do
   paciente, quais horários livres servem, os melhores primeiro.
2. **Quem cabe neste horário?** Quando um horário vaga (desmarcou, não confirmou), quais pacientes
   da lista de espera cabem nele.

O Auri sugere; quem decide e agenda é a secretária. Nada é marcado sozinho.

## Lista de espera

### Dados (`waitlist_entries`, migração no fim do array `MIGRATIONS`)

| Coluna             | Tipo                                    | Notas                                                         |
| ------------------ | --------------------------------------- | ------------------------------------------------------------- |
| `patient_id`       | paciente                                | `ON DELETE RESTRICT`, como o resto                            |
| `tipo`             | texto, padrão `sessao`                  | sem `CHECK`: os tipos cadastráveis vêm na próxima onda        |
| `duracao`          | minutos, 15 a 240, de 15 em 15          | a grade da agenda é de 15 min                                 |
| `dias`             | texto `"1,3,5"` (dias como `getDay()`)  | vazio = qualquer dia                                          |
| `periodos`         | texto `"manha,tarde"`                   | vazio = qualquer período                                      |
| `prioridade`       | `normal` ou `alta`                      | `alta` sobe na lista e na resposta "quem cabe"                |
| `observacao`       | texto                                   |                                                               |
| `encerrado_em`     | data e hora                             | vazio = está esperando                                        |
| `encerrado_motivo` | `agendado` ou `removido`                | junto com `encerrado_em`: os dois vazios ou os dois cheios    |
| `appointment_id`   | agendamento que encerrou a espera       | `ON DELETE SET NULL`                                          |
| `created_at`       | quando entrou na lista                  | conta o tempo de espera                                       |
| `updated_at`       | última mudança                          | controle de edição concorrente (`expected`), como na ficha    |

Um paciente tem **uma espera aberta de cada vez** (índice único parcial em `patient_id` onde
`encerrado_em IS NULL`). Encerrar não apaga: a linha fica, para um dia mostrar quanto tempo os
pacientes esperam.

Períodos, pelo início do horário: **manhã** antes das 12:00, **tarde** das 12:00 às 18:00,
**noite** a partir das 18:00.

### Operações

| Canal                   | Faz                                                                      |
| ----------------------- | ------------------------------------------------------------------------ |
| `waitlist:list`         | esperas abertas, prioridade alta primeiro, depois quem espera há mais    |
| `waitlist:getByPatient` | a espera aberta do paciente, ou `null`                                   |
| `waitlist:add`          | põe na lista; recusa paciente que já está nela ou inativo                |
| `waitlist:update`       | muda tipo, duração, preferências, prioridade e observação (`expected`)   |
| `waitlist:close`        | encerra como `agendado` (com o agendamento) ou `removido`                |
| `encaixe:sugerir`       | horários livres para um paciente num intervalo de dias                   |
| `encaixe:quemCabe`      | esperas que cabem num horário vago                                       |

Mudanças avisam o tópico `waitlist`; o renderer invalida `['waitlist']`.

## Motor (`desktop/src/shared/encaixe.ts`)

Código puro, sem banco nem data atual: tudo entra por parâmetro. Testado em
`shared/encaixe.test.ts`.

### Entradas (contratos das outras trilhas)

- **Funcionamento:** linhas de `clinic_hours (dia_semana 0–6 como getDay(), abre 'HH:MM', fecha
'HH:MM')`. Dia sem linha = fechado. Mais de uma linha no mesmo dia vale como turnos (ex.: manhã e
  tarde com almoço no meio).
- **Atividades:** linhas de `patient_activities (patient_id, atividade, dia_semana, inicio, fim)`.
- **Ocupados:** intervalos `{inicio, fim}` em data e hora local (`2026-10-21T14:00`), vindos dos
  agendamentos e, depois, dos compromissos.

### `sugerirHorarios`

Para cada dia do intervalo, percorre os inícios de 15 em 15 min dentro de cada turno e fica com os
que:

1. terminam até o fechamento do turno;
2. não se sobrepõem a nada ocupado;
3. não chegam a menos de `margem` minutos de uma atividade do paciente naquele dia da semana
   (padrão 30 min, o deslocamento de ida ou volta);
4. começam depois de `depoisDe` (o main passa "agora").

Ordem: primeiro os que batem com os **dias** preferidos, depois os que batem com o **período**,
depois os **encostados** (começam na abertura ou logo depois de outro horário, ou terminam no
fechamento ou logo antes de outro horário: a agenda fica sem buracos), e por fim os mais cedo.
Cada sugestão diz se é `preferida` (dia e período batem) e se está `encostada`. No máximo
`porDia` sugestões por dia (padrão 3), sem duas sobrepostas no mesmo dia, e `limite` no total
(padrão 12), para a lista mostrar dias e horários diferentes em vez de inícios seguidos do mesmo
buraco. `horariosLivres` devolve todos os inícios livres, sem escolher, em ordem.

Para **remarcar** uma sessão, o main tira a própria sessão dos ocupados
(`ignorar_appointment_id`), já que o horário dela vai ficar livre.

### `quemCabe`

Para um horário vago, cada espera aberta cabe se a duração dela couber na vaga e houver um início
de 15 em 15 min dentro da vaga sem bater na margem das atividades do paciente naquele dia. A
resposta traz o início e o fim propostos (o primeiro que serve) e se bate com as preferências.
Ordem: prioridade alta, depois quem bate com dia e período, depois quem espera há mais tempo.

### `vagaEm`

Dado um clique na grade, o funcionamento e o que está ocupado, devolve o buraco livre inteiro em
volta do clique, dentro do turno: do fim do último horário ocupado antes do clique (ou da abertura)
ao começo do próximo (ou do fechamento). Clique em horário ocupado ou fechado não é vaga.

### Ponte com o banco (`desktop/src/main/db/encaixe.ts`)

Lê o funcionamento de `clinic_hours`, as atividades de `patient_activities` e a margem de
`clinic.margem_deslocamento`. Os ocupados vêm de `busyIn` (`main/db/busy.ts`), a mesma consulta
que barra conflitos: agendamentos que não estão desmarcados mais os compromissos.

## Lista de espera na interface

- **`WaitlistPanel`** (`components/waitlist/WaitlistPanel.tsx`): não depende da página. Lista quem
  espera (nome, tipo e duração, preferências, há quanto tempo, observação), com editar. Cada linha
  abre as 6 melhores sugestões das próximas duas semanas, em ordem de data. Props: `vaga` (mostra
  quem cabe nela), `onPick(entrada, horario)` (as sugestões viram botões) e `vagaActions` (botões
  no cabeçalho da vaga).
- **`WaitlistDialog`**: põe na lista ou edita (tipo, duração, dias, períodos, prioridade,
  observação) e tira da lista. O formulário para a propagação do `submit`: na árvore do React ele
  mora dentro do `<form>` da ficha (o portal não muda isso).
- **Na ficha:** "Pôr na lista de espera" ao lado das abas do paciente (`PatientHeader`); quem já
  está na lista vê "Na lista de espera", que abre a edição.

## Compromissos sem paciente

Palestra, curso, atendimento no hospital, reunião e reserva ocupam a agenda e bloqueiam horários,
mas não têm paciente.

**Tabela própria `commitments`**, não `patient_id` nulo em `appointments`. O código da agenda
pressupõe paciente em todo agendamento (`JOIN patients`, nome no aviso, presença, assinatura da
chegada, evolução, relatório de presença, financeiro, gatilhos de assinatura). Um `patient_id` nulo
obrigaria a revisar cada um desses pontos e a recriar a tabela (o SQLite não muda `NOT NULL` com
`ALTER`).

| Coluna       | Notas                                                      |
| ------------ | ---------------------------------------------------------- |
| `tipo`       | `palestra`, `curso`, `hospital`, `reuniao` ou `reserva`    |
| `titulo`     | opcional (ex.: "Escola Fictícia", "Hospital Fictício")     |
| `inicio/fim` | data e hora local, `fim > inicio`                          |
| `observacao` | opcional                                                   |
| `updated_at` | controle de edição concorrente (`expected`)                |

A mesma migração acrescenta `clinic.margem_deslocamento` (0 a 120 min, padrão 30).

### Regras

- **Conflito dos dois lados** (`assertAgendaFree`, em `main/db/busy.ts`): o agendamento não entra
  sobre outro agendamento nem sobre um compromisso; o compromisso não entra sobre agendamento nem
  sobre outro compromisso. A mensagem diz o primeiro que bate ("Esse horário está bloqueado:
  Hospital: Hospital Fictício, das 14:00 às 15:00") e quantos mais.
- **Funcionamento:** o compromisso respeita o horário da clínica, como o agendamento. Mudar só o
  tipo ou o título de um compromisso fora do horário (de antes de o horário mudar) continua
  permitido.
- **Reserva vira agendamento** (`appointments:scheduleOnReserve`): numa transação, apaga a reserva
  e cria o agendamento. Se o agendamento não puder ser criado, a reserva fica.
- Compromisso não tem presença, assinatura, evolução nem cobrança.

### Interface

- **Na grade:** o compromisso aparece listrado em cinza, só com o tipo e o título; clicar abre o
  `CommitmentDialog` (tipo, título, data, hora, duração até 8 h, observação, resumo, excluir em
  dois passos). Na reserva, uma linha "Usar a reserva · Agendar paciente" abre o
  `AppointmentDialog` no mesmo horário.
- **Horário novo** (clique na grade, `N` ou `+`): o `SlotDialog` abre com "Paciente" escolhido e
  um seletor "Paciente | Compromisso" no alto. O caminho mais comum continua com um clique só.

## Painel de encaixe ao lado da semana

- Nas visões Semana e Dia, o `WaitlistPanel` fica numa coluna de 288 px à direita da grade, onde
  ficava o domingo. O botão com a ampulheta no cabeçalho recolhe e mostra o painel; a escolha
  fica no `localStorage` do computador (`auri.agenda.listaDeEspera`). Na visão Mês, não há painel.
- **Com o painel aberto, um clique num horário vazio seleciona a vaga** (`vagaEm`) em vez de abrir
  o agendamento: a grade marca a vaga e o painel mostra "Cabem neste horário" (`encaixe:quemCabe`),
  com "+" para marcar ali mesmo e "×" (ou Esc) para voltar à lista toda. Arrastar ou dar dois
  cliques continua abrindo o horário novo. Com o painel fechado, o clique abre o horário novo,
  como antes.
- Escolher alguém (da vaga ou dos "Horários livres" de cada um) abre o `AppointmentDialog` já com
  o paciente, o horário e a duração da espera.
- A página provisória `/lista-de-espera` e o item do menu saíram. O botão na ficha continua.

## Remarcar com sugestão

No agendamento futuro, "Remarcar" (ao lado de Excluir) abre o `RescheduleDialog`: horários livres
das próximas 3 semanas (`encaixe:sugerir` com `ignorar_appointment_id`), sem bater nas atividades
do paciente, os do mesmo período da sessão primeiro, em ordem de data; "Mais adiante" anda mais 3
semanas. Escolhido o horário, `appointments:move` muda só o início e o fim, **limpa a confirmação**
(o horário novo precisa ser confirmado de novo) e a presença. Sessão com a chegada assinada não é
remarcada.

## Decisões da G1

- **Sessão desmarcada deixa de bloquear o horário.** `busyIn` ignora `presenca = 'desmarcou'`:
  outro paciente ou um compromisso pode ocupar o horário, e o motor o oferece como livre. A sessão
  desmarcada continua na agenda, riscada, como registro. Voltar uma sessão desmarcada para "sem
  presença" passa pela checagem de conflito de novo. É o que a confirmação automática vai usar:
  sem resposta em 2 horas, a sessão vira desmarcada e o horário fica livre para o encaixe.
- **Agendar tira da lista de espera.** `createAppointment` encerra a espera aberta do paciente como
  `agendado` (com o agendamento) quando a sessão é de agora em diante, em qualquer lugar do app.
  Lançar uma sessão passada (ficha de papel) não mexe na lista.
- **Margem de deslocamento** é um ajuste da clínica, na tela Clínica, junto do funcionamento. Os
  canais `encaixe:*` ainda aceitam `margem` para sobrescrever.
- A seleção de vaga por clique só vale com o painel aberto, para não mudar o clique de quem não usa
  o encaixe.

## Depois

- Tipos cadastráveis: quando existirem, `tipo` da espera passa a apontar para eles e a duração
  padrão vem do tipo; o agendamento aberto pelo painel pode já vir com o tipo da espera.
- Confirmação automática: marcar como `desmarcou` a sessão sem resposta e mostrar a vaga no painel.
