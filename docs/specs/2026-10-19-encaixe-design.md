# Encaixe, lista de espera e compromissos — design

Data: 19/10/2026. Estado: implementado.

O Auri responde duas perguntas: **onde cabe este paciente?** (horários livres que respeitam o
funcionamento, a agenda e as atividades do paciente, os melhores primeiro) e **quem cabe neste
horário?** (esperas da lista que cabem num horário vago). O Auri sugere; quem agenda é a
secretária. Nada é marcado sozinho.

## Dados

- **`waitlist_entries`:** `patient_id`, `tipo_id` (etiqueta de `appointment_types` da categoria
  sessão, avaliação ou exame; sem etiqueta, um trigger põe a padrão), `duracao` (15 a 240, de 15 em
  15), `dias` (`"1,3,5"`, como `getDay()`; vazio = qualquer), `periodos` (`"manha,tarde"`; vazio =
  qualquer), `prioridade` (`normal` ou `alta`), `observacao`, `encerrado_em` e `encerrado_motivo`
  (`agendado` ou `removido`, os dois vazios ou os dois cheios), `appointment_id` (o agendamento que
  encerrou), `created_at` (conta o tempo de espera) e `updated_at` (edição concorrente). Uma espera
  aberta por paciente (índice único parcial). Encerrar não apaga.
- **`commitments`:** compromisso sem paciente (palestra, hospital, reunião, reserva), em tabela
  própria porque a agenda pressupõe paciente em todo agendamento. Colunas `etiqueta_id`, `titulo`,
  `inicio`, `fim`, `observacao` e `updated_at`. A etiqueta é da categoria `compromisso` (trigger); a
  Reserva é a etiqueta com `sistema = 'reserva'`, que não pode ser excluída. Esquema de entrada em
  `desktop/src/shared/commitments.ts`; nome na tela por `commitmentName` ("Etiqueta: título").
- **`clinic.margem_deslocamento`:** 0 a 120 min, padrão 30, editada na tela Clínica junto do
  funcionamento (`clinic_hours`, um horário por dia da semana).

Períodos, pelo início do horário: **manhã** antes das 12:00, **tarde** das 12:00 às 18:00,
**noite** a partir das 18:00.

## Regras

- **Conflito dos dois lados** (`assertAgendaFree` em `desktop/src/main/db/busy.ts`): agendamento
  não entra sobre agendamento nem compromisso, e compromisso não entra sobre nenhum dos dois. A
  mensagem diz o primeiro que bate e quantos mais. Os ocupados vêm de `busyIn`, a mesma consulta
  que o motor usa: agendamentos que não estão desmarcados mais os compromissos.
- **Sessão desmarcada não bloqueia o horário.** `busyIn` ignora `presenca = 'desmarcou'`; a sessão
  continua na agenda como registro. Voltar uma desmarcada para "sem presença" confere o conflito de
  novo. A confirmação sem resposta usa isso para liberar o horário.
- **Funcionamento:** compromisso e agendamento respeitam o horário da clínica.
- **Agendar tira da lista de espera.** `createAppointment` encerra a espera aberta do paciente como
  `agendado` quando a sessão é de agora em diante; lançar uma sessão passada não mexe na lista.
- **Reserva vira agendamento** (`appointments:scheduleOnReserve`): numa transação, apaga a reserva
  e cria o agendamento; se ele não puder ser criado, a reserva fica.
- **Remarcar** (`appointments:move`): muda só início e fim, limpa a confirmação e a presença e
  estorna a falta cobrada. Sessão com a chegada assinada não é remarcada.
- Compromisso não tem presença, assinatura, evolução nem cobrança.

## Motor (`desktop/src/shared/encaixe.ts`)

Código puro, sem banco nem data atual. A ponte com o banco é `desktop/src/main/db/encaixe.ts`, que
lê o funcionamento, as atividades (`patient_activities`), a margem e os ocupados (`busyIn`).

- **`sugerirHorarios`:** em cada dia do intervalo, inícios de 15 em 15 min que terminam até o
  fechamento, não se sobrepõem a nada ocupado, não chegam a menos de `margem` minutos de uma
  atividade do paciente naquele dia e começam depois de agora. Ordem: dia preferido, período
  preferido, encostado (na abertura, no fechamento ou junto de outro horário), mais cedo. No máximo
  3 por dia, sem sobrepostos, e 12 no total. `horariosLivres` devolve todos, sem escolher. Para
  remarcar, a própria sessão sai dos ocupados (`ignorar_appointment_id`).
- **`quemCabe`:** para um horário vago, cada espera aberta cabe se houver um início de 15 em 15 min
  dentro da vaga, com a duração dela, sem bater na margem das atividades. Devolve o primeiro início
  que serve e se bate com as preferências. Ordem: prioridade alta, preferida, quem espera há mais.
- **`vagaEm`:** do clique na grade, o buraco livre inteiro em volta, dentro do horário do dia. Clique
  em horário ocupado ou fechado não é vaga.

## Operações

| Canal                            | Faz                                                                   |
| -------------------------------- | --------------------------------------------------------------------- |
| `waitlist:list`                  | esperas abertas, prioridade alta primeiro, depois quem espera há mais |
| `waitlist:getByPatient`          | a espera aberta do paciente, ou `null`                                |
| `waitlist:add`                   | põe na lista; recusa quem já está nela ou inativo                     |
| `waitlist:update`                | etiqueta, duração, preferências, prioridade e observação (`expected`) |
| `waitlist:close`                 | encerra como `agendado` (com o agendamento) ou `removido`             |
| `encaixe:sugerir`                | `sugerirHorarios` para um paciente num intervalo de dias              |
| `encaixe:quemCabe`               | `quemCabe` num horário vago                                           |
| `appointments:move`              | remarca (ver "Regras")                                                |
| `appointments:scheduleOnReserve` | agenda sobre uma reserva                                              |

Os canais `encaixe:*` aceitam `margem` para sobrescrever a da clínica.

## Interface

- **Painel de encaixe** (`WaitlistPanel`) à direita da grade nas visões Semana e Dia; o botão com a
  ampulheta recolhe e mostra, e a escolha fica no `localStorage` (`auri.agenda.listaDeEspera`). Com
  o painel aberto, um clique num horário vazio seleciona a vaga (`vagaEm`) e o painel mostra "Cabem
  neste horário"; arrastar ou dar dois cliques abre o horário novo. Escolher alguém abre o
  agendamento com o paciente, o horário, a duração e a etiqueta da espera.
- **Na ficha:** "Pôr na lista de espera" ou "Na lista de espera" ao lado das abas.
- **Compromisso na grade:** listrado, com a etiqueta e o título; na Reserva, "Usar a reserva ·
  Agendar paciente". Horário novo abre com "Paciente | Compromisso".
- **Remarcar** (`RescheduleDialog`): horários livres das próximas 3 semanas, do mesmo período da
  sessão primeiro; "Mais adiante" anda mais 3 semanas.
