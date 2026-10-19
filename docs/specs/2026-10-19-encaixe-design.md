# Encaixe, lista de espera e compromissos — design

Data: 19/10/2026. Estado: a lista de espera e o motor de sugestão estão implementados (trilha G0);
os compromissos sem paciente e o painel no lugar do domingo ficam descritos aqui para a próxima
trilha.

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

### Ponte com o banco (`desktop/src/main/db/encaixe.ts`)

Lê os ocupados de `appointments` e, enquanto as tabelas `clinic_hours` e `patient_activities` não
existem neste branch, usa um funcionamento padrão (segunda a sábado, 07:00 às 20:00) e nenhuma
atividade. As duas leituras já consultam as tabelas dos contratos quando elas existem, então a
integração só precisa conferir os nomes das colunas e depois tirar a reserva (`hasTable`).

## Interface desta trilha

- **`WaitlistPanel`** (`components/waitlist/WaitlistPanel.tsx`): autocontido, sem depender da
  página. Lista quem espera (nome, tipo e duração, preferências, há quanto tempo, observação), com
  editar e tirar da lista. Cada linha abre as sugestões das próximas duas semanas. Props:
  - `vaga?: {inicio, fim}`: em vez da lista toda, mostra "Cabem neste horário" (`encaixe:quemCabe`);
  - `onPick?: (entrada, horario)`: com ele, cada sugestão vira botão. A página provisória abre o
    `AppointmentDialog` já preenchido e, quando a sessão é salva, encerra a espera como `agendado`.
- **`WaitlistDialog`**: põe na lista ou edita (tipo, duração, dias, períodos, prioridade,
  observação) e tira da lista.
- **Ponto de entrada na ficha:** o botão "Pôr na lista de espera" ao lado das abas do paciente
  (`PatientHeader`); quando o paciente já está na lista, o mesmo lugar mostra "Na lista de espera"
  e abre a edição.
- **Página provisória `/lista-de-espera`** no menu principal, só até o painel ir para a agenda.
- O painel mostra as 6 melhores sugestões de cada paciente em ordem de data.
- O formulário do diálogo para a propagação do `submit`: ele mora dentro do `<form>` da ficha na
  árvore do React (o portal não muda isso), e sem isso salvar a espera salvava a ficha junto.

## Próxima trilha

### Painel no lugar do domingo

A trilha de ajustes da agenda tira o domingo da semana. A coluna que sobra vira a lateral da semana
com o `WaitlistPanel` (≈ 280 px). Com um horário vago selecionado na grade, o painel recebe `vaga`
e mostra quem cabe; `onPick` abre o `AppointmentDialog` preenchido. Quando o painel morar na
agenda, a página `/lista-de-espera` e o item do menu saem.

### Compromissos sem paciente

Palestra, curso, atendimento no hospital, reunião, reserva: ocupam a agenda e bloqueiam horários,
mas não têm paciente.

**Recomendação: tabela própria `commitments`**, não `patient_id` nulo em `appointments`. O código
da agenda pressupõe paciente em todo agendamento (`JOIN patients`, nome no aviso, presença,
assinatura da chegada, evolução, relatório de presença, gatilhos de assinatura). Um `patient_id`
nulo obrigaria a revisar cada um desses pontos e a recriar a tabela (o SQLite não muda `NOT NULL`
com `ALTER`).

```sql
CREATE TABLE commitments (
  id         INTEGER PRIMARY KEY,
  tipo       TEXT NOT NULL CHECK (tipo IN ('palestra', 'curso', 'hospital', 'reuniao', 'reserva')),
  titulo     TEXT,
  inicio     TEXT NOT NULL,
  fim        TEXT NOT NULL,
  observacao TEXT,
  created_at TEXT NOT NULL DEFAULT (...),
  updated_at TEXT NOT NULL DEFAULT (...),
  CHECK (fim > inicio)
);
```

- `assertSlotFree` dos agendamentos passa a olhar também `commitments`, e o compromisso olha os
  agendamentos e os outros compromissos.
- A agenda lista os dois juntos; o compromisso aparece com outro desenho (sem paciente, só o tipo
  e o título).
- No motor, os compromissos entram em `ocupados` sem mudança: a ponte soma as duas tabelas.
- "Reserva" segura um horário para um encaixe futuro; a secretária pode trocá-la por um
  agendamento.

### Ligar o que ficou de fora

- Encerrar a espera como `agendado` quando um agendamento é criado para o paciente em qualquer
  lugar (hoje só a página provisória faz isso).
- Margem de deslocamento: hoje é o padrão de 30 min do motor; virar um ajuste da clínica (ex.:
  na página Clínica, junto do funcionamento).
- Horário que vagou: o agendamento `desmarcou` ainda ocupa o horário (`assertSlotFree` olha todos).
  Para a confirmação automática liberar o horário, decidir se `desmarcou` deixa de bloquear ou se a
  sessão é apagada; o motor segue o que a ponte mandar como ocupado.
- Tipos cadastráveis: quando existirem, `tipo` da espera passa a apontar para eles e a duração
  padrão vem do tipo.
