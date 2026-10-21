# Assinatura de termos pelo celular — design

Data: 18/10/2026. Estado: implementado. Falta o teste de campo com aparelhos reais: o link longo
(reserva do curto) no WhatsApp e o `auri://` no Chrome, no Edge e no Safari.

## Objetivo

O responsável pelo paciente lê e assina o termo no próprio celular, e o termo assinado fica na
ficha do paciente no Auri, em PDF. Só o Auri da recepção, o WhatsApp que a clínica e a família já
usam e as páginas do auri.dev.br. Nenhum servidor lê o termo ou a resposta: o site guarda por um
tempo limitado só o conteúdo cifrado, para o link ficar curto (ver
[links curtos](../links-curtos.md)).

O computador da recepção fica virado para a secretária: o paciente não vê a tela nem tem onde
assinar.

Sucesso: a secretária clica em "Enviar termo"; o responsável assina em dois minutos no celular e
toca em "Enviar pelo WhatsApp"; a secretária clica no link que chegou e o termo aparece como
"Assinado por … em 18/10/2026", com o PDF.

## Fluxo

```
Recepção (Auri)              Celular do responsável               Recepção (WhatsApp → Auri)
"Enviar termo" ─WhatsApp─▶  auri.dev.br/assinar#<código>
                             busca o termo cifrado, decifra,
                             lê, informa nome, CPF e parentesco,
                             assina com o dedo
                             "Enviar pelo WhatsApp" ──WhatsApp──▶ auri.dev.br/recebido#<código>
                                                                  └▶ auri://receber#<código>
                                                                     busca, confere, decifra, mostra;
                                                                     "Guardar termo assinado" → registro
```

1. Na ficha (aba Termos), a secretária clica em "Enviar termo", escolhe para quem (uma pessoa da
   ficha, com o celular dela, ou outra pessoa) e o Auri abre o WhatsApp com a mensagem pronta: o
   texto e o link `https://auri.dev.br/assinar#<código>`. Ela toca em enviar. O termo fica
   aguardando assinatura.
2. O responsável abre o link no celular. A página busca o termo cifrado no site, decifra e mostra
   a clínica, o paciente e o texto. Ele informa nome completo, CPF e parentesco, marca o aceite e
   assina com o dedo.
3. A página mostra para onde vai a resposta ("Enviar para Clínica Elo · (65) 99999-0000", o número
   que veio no termo). "Enviar pelo WhatsApp" cifra a resposta, guarda no site e abre o WhatsApp
   com esse número e a mensagem com `https://auri.dev.br/recebido#<código>`. Ele toca em enviar. A
   página não tem como saber se ele enviou: a tela final diz que falta esse toque e oferece abrir o
   WhatsApp de novo ou copiar a mensagem.
4. A mensagem chega no WhatsApp da clínica (no Auri, no Desktop ou na Web, no computador da
   recepção). A secretária clica no link; a página `recebido` repassa o fragmento para
   `auri://receber#<código>` (o navegador pergunta uma vez se pode abrir o Auri).
5. O Auri busca a resposta no site, acha o envio pelo id, decifra com a chave que guardou, confere
   (ver "Conferência") e mostra o que chegou: nome, CPF, parentesco, a assinatura e os avisos.
   "Guardar termo assinado" grava o registro; o PDF é gerado na hora, sempre que alguém o abre.
6. Reserva: se o `auri://` não abrir (navegador que bloqueia, link aberto no celular da clínica), a
   página `recebido` tem "Copiar resposta" e o Auri tem "Colar resposta", que aceita a mensagem
   inteira do WhatsApp ou só o link, curto ou longo.

## Decisões tomadas

- **Só conteúdo cifrado sai da recepção.** O link leva um código de 22 caracteres depois do `#`,
  que o navegador não manda ao servidor. Do código saem o id do que fica guardado no site e a chave
  do conteúdo; o site guarda o termo até um dia depois do prazo e a resposta por 30 dias, sem
  conseguir ler. Se o site não responder, vai o link longo, com tudo cifrado no fragmento. Detalhes
  em [links curtos](../links-curtos.md).
- **WhatsApp como transporte** nas duas pontas: é o que a família já usa, e a ida e a volta ficam
  na conversa da clínica.
- **Uma chave por envio.** A cada envio o Auri sorteia um código (16 bytes); a chave AES-256-GCM do
  termo é `SHA-256("auri/link/chave/" + código)`. O Auri guarda a chave, o link longo e o código no
  envio. A página cifra a resposta com a mesma chave, e o link de volta **não leva a chave**: só o
  Auri que fez o envio lê a resposta. A chave também prova que a resposta veio de quem recebeu o
  link.
- **A cifra da ida não esconde nada de quem tem o link** (a chave sai do código). Ela deixa o termo
  ilegível para o site e no texto do link longo. O que protege de verdade é a volta: CPF e
  assinatura só viajam cifrados com uma chave que não está na mensagem.
- **Páginas no `web/`** (Vite+ e React, na Vercel, em auri.dev.br): `/assinar` e `/recebido`. Sem
  análise de acesso, sem script de terceiros e com `connect-src 'self'` na CSP: a página só fala
  com a API de links do próprio site (`/api/links`) e abre o WhatsApp.
- **Código comum em `web/contrato/assinatura/`**, sem dependências (ver "Código comum"). O main do
  desktop monta o link de ida e lê o de volta com o `crypto` e o `zlib` do Node
  (`desktop/src/main/terms/link.ts`), de forma síncrona como as operações do banco, no mesmo formato
  e com as validações de `formato.ts`. Um teste cruzado garante que a página lê o que o Auri monta
  e vice-versa.
- **Conferência antes de guardar.** O Auri mostra o que chegou e só guarda em "Guardar termo
  assinado"; "Recusar" descarta, e a secretária pede de novo. Guardado, o termo não muda mais.
- **Termo assinado é imutável.** Um termo novo do mesmo modelo não altera o anterior: o anterior
  passa a aparecer como "Substituído" e os dois continuam na ficha, cada um com o seu PDF.
- **O número que recebe a resposta vem no termo** (`cli.whats`). A página não tem lista de
  clínicas: mostra em destaque o nome e o número antes do botão, e quem assina vê para onde vão os
  dados. Um link falso no nosso domínio continua possível (ver "Riscos e limites"); trocar o número
  da clínica não pede publicar o site.
- **O termo leva o papel esperado de quem assina** (`resp`: paciente, mãe, pai ou outro, com o
  parentesco), sem nome nem CPF. A página pergunta nome e CPF; o parentesco vem marcado conforme o
  papel e pode ser trocado. Para paciente menor, o próprio paciente não aparece como quem assina;
  maior de idade vê "Você, paciente".
- **O termo é da clínica:** o texto vem num formato próprio e pequeno, com títulos, parágrafos,
  listas e negrito, nunca HTML (ver "Conteúdo do termo"). O mesmo código lê o texto para a página e
  para o PDF.
- **Modelos na tela Clínica, com versão.** Clínica é item do menu lateral principal, não de
  Configurações: dados da clínica e modelos de termo são conteúdo que a clínica mantém. Editar um
  modelo cria a versão seguinte; cada envio guarda o texto exato da versão usada. Os campos
  `{paciente}`, `{nascimento}`, `{clinica}`, `{profissional}`, `{registro}` e `{data}` entram por
  botões no editor (`CAMPOS` em `desktop/src/shared/terms.ts`).
- **O PDF não fica guardado no banco.** O desktop gera na hora, a partir do registro imutável do
  termo assinado.
- **Na recepção, como os pacientes.** Envios, chaves e termos assinados ficam no banco do
  computador que guarda os dados. O outro computador envia e recebe pelo registro de operações da
  Conexão, como qualquer outra gravação. Com a chave "Computador da recepção" ligada, dados da
  clínica e modelos de termo não mudam naquele computador; enviar e receber termos continua.

## Formato do link

Os dois links usam base64url sem `=`. O conteúdo começa pela versão do formato, para a página e o
Auri recusarem com mensagem clara o que não conhecem. A versão 1 vale desde o primeiro envio.

O link que vai na mensagem é o curto (`#<código>`, 22 caracteres). O longo, abaixo, é o que fica
guardado no site (sem a chave, no caso da ida) e o que vai na mensagem quando o site não responde.

### Ida: `https://auri.dev.br/assinar#1.<chave>.<dados>`

```
1        versão do formato
chave    32 bytes (AES-256-GCM), 43 caracteres; SHA-256("auri/link/chave/" + código)
dados    iv (12 bytes) | AES-GCM(chave, deflate-raw(conteúdo)) | etiqueta (16 bytes)
         dado adicional do GCM: "auri/termo/1/ida"
```

No site fica `1.<dados>`; a página põe a chave, tirada do código, entre a versão e os dados.

Conteúdo, em JSON com chaves curtas, antes de comprimir:

| Campo  | O que é                                                                                    |
| ------ | ------------------------------------------------------------------------------------------ |
| `id`   | id do envio, 16 bytes aleatórios (22 caracteres)                                           |
| `ate`  | prazo, em segundos Unix (3, 7 ou 15 dias depois do envio; padrão 7)                        |
| `cli`  | `nome` da clínica e `whats`, o número que recebe a resposta (só dígitos, com 55 e DDD)     |
| `pac`  | `nome` e `nasc` (AAAA-MM-DD) do paciente                                                   |
| `resp` | `papel` esperado de quem assina (`paciente`, `mae`, `pai` ou `outro`) e, se `outro`, `par` |
| `mod`  | `titulo` e `versao` do modelo                                                              |
| `prof` | `nome` do profissional responsável e `reg`, o registro (CRFa; pode ficar vazio)            |
| `txt`  | texto do termo, já com os campos preenchidos, no formato de "Conteúdo do termo"            |

Não vão o nome nem o CPF de quem assina: a pessoa digita os próprios dados, e o Auri compara com a
ficha. O `papel` só marca a opção certa na página: com `outro`, o `par` é o parentesco da ficha
("Avó", "Tio"); paciente maior de idade vem como `paciente`. A página e o desktop validam o
conteúdo campo a campo, com tamanhos máximos, e ignoram campos que não conhecem.

### Volta: `https://auri.dev.br/recebido#1.<id>.<dados>`

```
1        versão
id       id do envio, às claras (o Auri acha a chave sem tentar todas; é aleatório)
dados    iv | AES-GCM(chave do envio, deflate-raw(conteúdo)) | etiqueta
         dado adicional: "auri/termo/1/volta/" + id
```

Conteúdo: tamanho do cabeçalho (uint16) | cabeçalho JSON | traço da assinatura (binário).

| Campo         | O que é                                                                        |
| ------------- | ------------------------------------------------------------------------------ |
| `id`          | o mesmo id (conferido com o de fora)                                           |
| `h`           | SHA-256 do `txt` que a página mostrou, em hexadecimal                          |
| `nome`, `cpf` | nome completo (espaços normalizados) e CPF (11 dígitos)                        |
| `rel`, `par`  | quem assina (`paciente`, `mae`, `pai` ou `outro`); com `outro`, o parentesco   |
| `ok`          | `true`: aceite marcado                                                         |
| `em`, `tz`    | hora da assinatura no relógio do celular, em segundos Unix, e fuso, em minutos |

Com `outro`, o `par` é o parentesco que veio no link, ou "Responsável legal" se o link esperava
outro papel. A página guarda o fragmento inteiro no site com um código novo e põe na mensagem
"Termo assinado: <modelo> · <paciente>" seguida do link curto; se o site não responder em 1,5 s,
vai o link longo.

### Assinatura em traço vetorial

Uma imagem não caberia no link longo; os traços cabem.

- O quadro tem proporção fixa (5:2). Cada ponto vira coordenadas inteiras de 0 a 1000 na largura e
  de 0 a 400 na altura, então a assinatura independe do tamanho da tela.
- Cada traço (do dedo encostar até levantar) é simplificado por Ramer–Douglas–Peucker com
  tolerância de 2 unidades (0,2% da largura): sai o ponto que não muda o desenho.
- Codificação: número de traços; por traço, número de pontos, o primeiro ponto e depois só as
  diferenças (zigzag + varint, quase sempre 1 byte por eixo). Tudo entra no deflate da resposta.
- Se passar do limite, a tolerância sobe (3, 4, 6) até caber; se nem assim, "Assinatura muito
  longa. Limpe e assine de novo".
- O Auri desenha os traços em SVG (curvas pelos pontos médios), na conferência e no PDF.
- Assinatura vazia ou mínima (menos de 2% da largura percorrida) não habilita o envio.

### Tamanhos do link longo (medidos)

Medidos com WebCrypto e `CompressionStream` (Node 24):

| Caso                                                                                       | Link                     |
| ------------------------------------------------------------------------------------------ | ------------------------ |
| Termo de 1.528 caracteres (6 parágrafos)                                                   | ida com 1.401 caracteres |
| Termo de ~5.000 caracteres (pela mesma taxa de compressão)                                 | ida com ~4.000           |
| Assinatura de 4 traços (305 pontos depois de simplificar, 629 bytes), com nome, CPF e hash | volta com 1.042          |

**Limites:** ida até 4.000 caracteres e volta até 2.000, contados sempre com `https://auri.dev.br`
(o link de uma prévia da Vercel não muda a conta). Valem para o link longo, que é a reserva do
curto e o que fica guardado no site. O editor do modelo mostra quanto do limite o texto usa e não
deixa salvar o que não cabe. Os números são constantes em `web/contrato/assinatura/formato.ts`
(`LIMITE_IDA`, `LIMITE_VOLTA`). Na leitura, a página e o Auri recusam fragmentos com mais de 8.192
caracteres e param de descomprimir em 64 KB.

### Uso único e prazo

- Conferidos no Auri, que é quem guarda os envios. A página só avisa que o link venceu, pelo
  relógio do celular; o termo guardado some do site um dia depois do prazo ("Este link não vale
  mais").
- O primeiro recebimento válido conclui o envio. A mesma resposta de novo diz "Este termo já está
  guardado" e abre o termo; outra resposta para o mesmo envio é recusada ("Este termo já foi
  assinado em 18/10/2026").
- Enviar de novo o mesmo modelo para o paciente troca o envio anterior ainda sem resposta: a chave
  dele é apagada e uma resposta atrasada é recusada ("Este link foi trocado por um envio mais
  novo").
- Resposta depois do prazo é recusada ("Este link venceu em …. Envie o termo de novo.").
- A chave, o link e o código de um envio assinado, cancelado, trocado ou vencido são apagados.

## Código comum (`web/contrato/assinatura/`)

TypeScript sem nenhuma dependência: só `crypto.subtle` (WebCrypto), `CompressionStream` e
`TextEncoder`, que existem no Node do Electron e nos navegadores. O `desktop/` importa por caminho
relativo, e os dois `tsconfig` do desktop incluem a pasta (sem os testes). O link curto fica ao
lado, em `web/contrato/link-curto.ts`.

```
web/contrato/assinatura/
  formato.ts      versão, montar e ler os links de ida e de volta, limites, CPF e nome completo
  cifra.ts        chave, AES-256-GCM, SHA-256
  compressao.ts   deflate-raw por CompressionStream, com teto na descompressão
  conteudo.ts     lê o texto do termo em blocos (títulos, parágrafos, listas, negrito)
  traco.ts        simplificar, codificar, decodificar e desenhar (SVG) a assinatura
  base64url.ts
  ficticio.ts     termo e assinatura fictícios, para os testes e o link de teste
```

Os testes ficam ao lado (`*.test.ts`) e rodam pelo Vitest do `web/`. A validação do CPF existe
também em `desktop/src/shared/cpf.ts`; as duas seguem a mesma regra.

### Conteúdo do termo

O texto é da clínica, escrito no modelo, e viaja como texto, nunca como HTML:

- linha em branco separa blocos; quebra simples continua no mesmo parágrafo, como quebra de linha;
- `# Título` e `## Subtítulo` (o terceiro nível é texto comum);
- `- item` ou `• item` em linhas seguidas formam uma lista;
- `**negrito**` dentro de qualquer bloco; asteriscos sem par ficam como texto.

`lerConteudo` devolve os blocos; a página e o PDF desenham com o mesmo resultado, escapando o
texto. Esse formato faz parte da versão 1 do link: mudar o que ele aceita pede uma versão nova,
para um termo antigo continuar igual no PDF.

## Desktop

### Protocolo `auri://`

- `electron-builder.yml`:
  ```yaml
  protocols:
    - name: Auri
      schemes: [auri]
  ```
  Vira `CFBundleURLTypes` no `Info.plist` do Mac. No Windows essa chave não faz nada.
- **Windows:** `app.setAsDefaultProtocolClient('auri')` ao abrir, só com o app empacotado, registra
  o esquema (`HKCU\Software\Classes\auri`). `build/installer.nsh` apaga a chave na desinstalação.
  Em desenvolvimento e nos testes o esquema não é registrado, para não tomar o do Auri instalado.
- **Mac:** `open-url`, registrado em `will-finish-launching` (com o app fechado, o evento chega
  antes do `ready`). Só funciona com o app empacotado.
- **Windows:** o endereço chega no `argv`. Com o app fechado, em `process.argv`; aberto, no
  `second-instance`, que procura o argumento que começa com `auri:`.
- Endereços que chegam antes da janela ficam numa fila e são entregues quando ela abre.
- O endereço é entrada não confiável (`desktop/src/main/terms/protocol.ts`): só `auri://receber`
  (termo) e `auri://confirmacao`, até 8 KB, com o fragmento longo ou o código de 22 caracteres
  depois de `#`, `?r=` ou `/` (há navegadores que reescrevem), sem navegar nem executar nada. O
  main manda para a tela só o resultado da conferência.

### Telas

- **Ficha do paciente, aba Termos** (quinta aba, depois de Evoluções). Uma linha por modelo ativo
  (ou arquivado que já tenha envio), com o estado; no cabeçalho, "Colar resposta":
  - **Ainda não enviado**, ou "O link venceu em dd/mm, sem resposta", ou "Envio cancelado em
    dd/mm". Ação: "Enviar termo".
  - **Aguardando**: "Enviado para Maria (mãe) em 18/10 · vence em 25/10". Ações: "Reenviar" (abre
    o WhatsApp de novo com o mesmo link), "Colar resposta", "Copiar mensagem" e "Cancelar" (pede
    confirmação).
  - **Assinado**: "Assinado por <nome> (<parentesco>) em 18/10/2026"; se o modelo ganhou versão
    depois, "· versão 2 (atual: 3)". Ações: "Abrir PDF" e "Enviar de novo".
  - Embaixo, os termos substituídos ("Substituído · assinado por … em … · versão N"), cada um com o
    seu PDF.
- **Diálogo Enviar termo:** para quem (as pessoas da ficha, com o celular de cada uma, ou "Outra
  pessoa" com nome, parentesco e celular), "Vale por" 3, 7 ou 15 dias (padrão 7) e a prévia da
  mensagem. "Abrir no WhatsApp" (principal) e "Copiar mensagem". Sem nome da clínica, WhatsApp ou
  profissional responsável, o diálogo pede para preencher na tela Clínica.
- **Conferência** (abre sozinha ao receber, ou por "Colar resposta"): termo, paciente e versão; a
  assinatura; nome, CPF (borrado até clicar, como os outros dados sensíveis), parentesco e hora da
  assinatura; os avisos; "Enviado para (66) 99999-1234: confira se a resposta veio desse número".
  "Guardar termo assinado" (principal) ou "Recusar".
- **Clínica** (item do menu lateral principal): dados da clínica (nome que o responsável vê,
  WhatsApp que recebe as respostas, profissional e registro) e os modelos de termo (título, texto no
  formato de "Conteúdo do termo" com os campos, prévia como a página mostra, versão atual, quanto
  do limite do link o texto usa, arquivar).

### Abrir o WhatsApp

- Com o WhatsApp no Auri ligado (tela WhatsApp), a conversa abre nele em
  `https://web.whatsapp.com/send?phone=<número>`, **sem `text=`**. A mensagem vai para a área de
  transferência e é colada sozinha quando o campo da conversa aparece vazio (até 30 s); depois de
  colar, o Auri apaga a área de transferência. Se não aparecer, o aviso pede para colar.
- Senão, `whatsapp://send?phone=…&text=…` quando o WhatsApp Desktop está instalado
  (`app.getApplicationNameForProtocol`): o texto vai direto ao app, sem passar por site nenhum.
  Sem o app, a mensagem vai para a área de transferência e o navegador abre
  `https://web.whatsapp.com/send?phone=<número>`, também sem `text=`.
- Por quê (21/10): com `text=` no `web.whatsapp.com` ou no `wa.me`, a mensagem inteira (nome do
  responsável e do paciente, o título do termo e o link de ida, com o código depois do `#`
  codificado como `%23`) ia como parâmetro na requisição ao site do WhatsApp, fora da cifra de ponta
  a ponta das conversas, e no `wa.me` ainda ficava no histórico do navegador. Com o código, quem tem
  os logs busca o termo cifrado no `auri.dev.br` e lê. O número fica na URL: o WhatsApp já o recebe
  ao entregar a mensagem. Na volta tanto faz, porque o link não leva a chave.
- No celular, "Enviar pelo WhatsApp" é um link `https://wa.me/…`: com o WhatsApp instalado, o
  sistema abre o app direto (link universal no iPhone, App Link no Android).

### Conferência

`terms:check` e `terms:accept`, na ordem, parando no primeiro que falhar. Antes, o main busca no
site a resposta de um link curto.

1. Versão do formato conhecida.
2. O envio existe neste Auri (id).
3. O envio está aguardando: não cancelado, não trocado, não assinado (ou é a mesma resposta já
   guardada, que só abre o termo).
4. Dentro do prazo, pelo relógio deste computador.
5. Decifra com a chave do envio (etiqueta GCM e dado adicional conferem); id de dentro igual ao de
   fora.
6. SHA-256 do texto mostrado igual ao do texto enviado.
7. Nome com pelo menos duas palavras, CPF válido, quem assina conhecido, aceite marcado e
   assinatura não vazia (`nomeCompleto`, `cpfValido` e `assinaturaMinima`, os mesmos da página).

Avisos que não impedem guardar: CPF diferente do da pessoa esperada na ficha ("Confira quem
assinou"); quem assinou diferente do papel do link (a mãe recebeu, o pai assinou); hora do celular
mais de 10 minutos adiantada em relação à hora do recebimento.

### Dados

- `term_models` (arquivado ou não) e `term_versions` (título, texto, versão, criado em). Cada versão
  é uma linha que não muda nem some; a atual é a maior.
- `term_requests`: envios (paciente, versão, termo exato e SHA-256 do texto, nome, papel,
  parentesco, CPF e número de destino, prazo, computador, chave, link longo, código, estado
  `aguardando`/`cancelado`/`trocado`/`assinado`; vencido é calculado pelo prazo). O conteúdo do
  envio não muda, um envio concluído não volta a aguardar e nenhum é apagado.
- `signed_terms`: termos assinados (envio, paciente, nome, CPF, quem assinou e parentesco, traço,
  hora do celular e fuso, hora do recebimento, computador, SHA-256 da resposta e do registro). Sem
  o PDF: ele sai deste registro e do texto exato do envio, sempre que alguém abre. Só aceita
  `INSERT`.

As regras de imutabilidade ficam em triggers do SQLite, além do código: aqui a imutabilidade é
parte do valor do documento.

Operações no registro (`desktop/src/main/operations.ts`): `terms:models`, `terms:measureModel`,
`terms:saveModel`, `terms:archiveModel`, `terms:listByPatient`, `terms:send` (devolve o link e a
mensagem), `terms:link`, `terms:cancel`, `terms:check` (confere e devolve o resultado),
`terms:accept` (confere de novo e grava o registro) e `terms:record` (devolve o registro de um
termo assinado), com o aviso ao vivo "termos mudou". O IPC encurta o link de `terms:send` e
`terms:link` e expande a resposta de `terms:check` e `terms:accept` (`desktop/src/main/ipc.ts`).
Abrir o WhatsApp e gerar e abrir o PDF são locais (IPC próprio), no computador onde se clicou, a
partir do registro.

### PDF

Gerado na hora, no computador onde se clicou em "Abrir PDF", a partir do registro imutável e do
texto exato do envio: um HTML num `BrowserWindow` oculto, sem JavaScript e com a rede bloqueada
(`webContents.printToPDF`, `desktop/src/main/pdf.ts`), com a Bricolage embutida. O texto passa por
`lerConteudo`, o mesmo da página, e cada trecho entra escapado. Nada fica guardado: o arquivo vai
para uma pasta temporária e abre no leitor de PDF do sistema.

- Nome da clínica, título e versão do modelo.
- Texto do termo, exatamente como foi mostrado.
- Paciente (nome e nascimento).
- Assinatura (vetor), nome do responsável, CPF e parentesco.
- Hora da assinatura no celular (com o fuso do aparelho) e hora do recebimento pelo Auri.
- Profissional responsável e registro.
- Registro técnico: id do envio, número e hora do envio, SHA-256 do texto, SHA-256 do documento e
  "Assinatura eletrônica simples (Lei 14.063/2020, art. 4º, I), aceita pelas partes nos termos da
  MP 2.200-2/2001, art. 10, § 2º".

O SHA-256 do documento é o do registro canônico (JSON com as chaves em ordem: id, texto e o hash
dele, paciente, dados de quem assinou, traço, horários e número de destino), não o do arquivo: o
PDF não tem como conter o próprio hash, e o arquivo pode mudar de um byte para outro entre versões
do Electron sem mudar o documento. É esse hash que prova o que foi assinado.

### Cópia de segurança

Os registros dos termos assinados ficam no banco (poucos KB cada, sem PDF), então entram no
`.auribackup` cifrado sem mudar o formato. As chaves dos envios aguardando vão junto: restaurado em
outro computador, o Auri ainda recebe as respostas pendentes e gera os PDFs de todos os termos.

## Página web (`web/`)

Duas páginas no site, `web/assinar/index.html` e `web/recebido/index.html`, entradas em
`build.rolldownOptions.input` do `web/vite.config.ts`. Só no cliente, sem pré-render: o
`prerender.mjs` mexe só no `dist/index.html`. O código fica em `web/src/assinatura/`, com a
identidade do site (Bricolage, grafite, sem verde) e os mesmos tokens de cor (`web/src/tokens.css`).

- `/assinar`: lê o fragmento (busca no site se for um código), decifra e mostra clínica, paciente e
  termo; nome, CPF (com máscara), quem assina, aceite com a declaração do papel escolhido, quadro
  de assinatura (`traco.ts`, com desfazer e limpar), "Enviar para <clínica> · <número>" em destaque
  e "Enviar pelo WhatsApp". O link de volta é montado assim que tudo está preenchido; o toque
  guarda a resposta no site (até 1,5 s) e abre o `wa.me`. O preenchido fica no `sessionStorage` até
  enviar (o navegador do WhatsApp recarrega a página quando se troca de app); ao enviar, fica só a
  mensagem pronta, para a tela final. Escala de toque do Design System: texto de 15px, títulos de
  17px, campos de 16px (o iPhone não amplia), alvos de 44px ou mais.
- Estados: abrindo; link incompleto ou adulterado; link que sumiu do site ("Este link não vale
  mais"); sem internet, com "Tentar de novo"; versão desconhecida ("Atualize a página"); vencido,
  com "Falar com a clínica"; navegador sem WebCrypto ou `CompressionStream` (iPhone antes do iOS
  16.4: "Abra o link em outro navegador ou aparelho"); já enviado (volta à tela final).
- `/recebido`: confere só o formato (não tem a chave e não busca nada). No computador, mostra
  "Abrindo o Auri…" e abre `auri://receber#…`; depois de 2 s, oferece "Abrir no Auri" e "Copiar
  resposta". No celular, só "Copiar resposta", com "Abra este link no computador da recepção".
- Cabeçalhos na Vercel (`web/vercel.json`): `/assinar`, `/recebido`, `/confirmar` e `/resposta`
  têm CSP própria, `default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self';
  font-src 'self'; connect-src 'self'; manifest-src 'none'; base-uri 'none'; form-action 'none';
  frame-ancestors 'none'`, sem `unsafe-inline`, mais `X-Robots-Tag: noindex`; o resto do site
  segue com a CSP dele. Valem também `Referrer-Policy: no-referrer` e a ausência de Analytics. As
  páginas sem a barra no fim têm `rewrites` para o `index.html` de cada pasta (e o mesmo no
  servidor local do Vite). A prévia do link no WhatsApp é genérica ("Termo para assinar"), porque é
  gerada sem o fragmento.

### Link de teste

`npm run termo:teste` (em `web/`) monta um termo fictício e imprime o link de ida (longo), guarda a
chave numa pasta temporária e espera a resposta colada no terminal: decifra, confere o hash do
texto e salva a assinatura em SVG. Opções: `--whats` (o número que recebe a resposta), `--para`
(imprime também o `wa.me` de ida com a mensagem), `--tamanho` (aumenta o termo até o link chegar
perto do tamanho pedido, acima do limite se for o caso), `--papel`, `--dias` (0 gera um link
vencido) e `--site` (uma prévia da Vercel ou `http://localhost:4173`).
`npm run termo:teste -- ler` lê uma resposta depois.

## Pontos legais

O texto do termo e a cláusula de aceite devem ser revistos por advogado antes do primeiro envio
real. O que o desenho cobre:

- **Assinatura eletrônica simples.** A Lei 14.063/2020 (art. 4º, I) chama de simples a assinatura
  que identifica o signatário e associa dados dele ao documento. Entre particulares, a MP
  2.200-2/2001 (art. 10, § 2º) admite outro meio de provar autoria e integridade, sem certificado
  ICP-Brasil, desde que as partes o aceitem como válido. O Código Civil (art. 107) não exige forma
  especial para a declaração de vontade quando a lei não pede.
- **Cláusula de aceite.** Por causa do art. 10, § 2º, o termo traz uma cláusula em que o
  responsável aceita a assinatura pelo celular (nome, CPF e assinatura desenhada) como válida, e a
  página exige marcar o aceite ("Li o termo e concordo. Declaro ser a mãe de … e aceito esta
  assinatura eletrônica…", conforme quem assina) antes de enviar.
- **Documentos do profissional.** A mesma Lei 14.063 pede assinatura avançada ou qualificada para
  documentos assinados por profissionais de saúde (receitas, atestados). Aqui quem assina é o
  responsável; o profissional só aparece identificado. Confirmar com o advogado.
- **Responsável legal do menor.** Quem consente pelo paciente menor é um dos pais ou o responsável
  legal (Código Civil, art. 1.634, VII). Para o menor, a página só oferece "Mãe", "Pai" e
  "Responsável legal" (com o parentesco da ficha, como "Avó, responsável legal", quando a ficha
  aponta outra pessoa), e o aceite diz que quem assina declara ter essa condição. Avó ou tio sem a
  guarda não servem. Paciente maior de idade assina por si ("Você, paciente"); a opção de
  responsável legal fica para o caso de curatela.
- **LGPD, art. 14.** Dados de criança pedem consentimento específico e em destaque de ao menos um
  dos pais ou do responsável (§ 1º), e o controlador deve fazer esforços razoáveis para conferir
  que veio deles (§ 5º). Os esforços aqui: o link vai só para o número da ficha, quem assina
  informa nome e CPF, o Auri compara com a ficha e registra o número de destino. Os dados de saúde
  também têm base na tutela da saúde (art. 11, II, "f"; a ANPD admite as bases dos arts. 7º e 11
  para crianças, no Enunciado CD/ANPD nº 1/2023), então o termo documenta a ciência da família,
  não é a única base.
- **Prova.** Ficam: o texto exato e o hash dele, quem assinou e como se identificou, a assinatura,
  as duas horas, o número para o qual o link foi enviado e as mensagens no WhatsApp da clínica.

## Riscos e limites

- **Quem tem o link lê o termo** (com o nome do paciente) e pode assinar no lugar do responsável.
  Limitam: o link vai só para o número escolhido na ficha, vale o prazo escolhido e uma resposta, e
  a conferência pede para ver se a resposta veio desse número.
- **Link falso no nosso domínio.** Qualquer um pode montar um link de ida com um termo inventado e o
  próprio número em `cli.whats`, e a página manda nome, CPF e assinatura para ele. Limita: a página
  mostra em destaque, antes do botão, o nome e o número para onde vai a resposta. Uma lista fixa de
  clínicas no site fecharia isso, ao custo de publicar o site a cada número novo; fica para quando
  houver mais de uma clínica.
- **O Auri não usa hora de servidor.** As horas são a do celular (que o dono pode mudar) e a do
  computador da recepção. O PDF mostra as duas e diz de onde vem cada uma; a que vale para o prazo
  é a do recebimento.
- **O responsável precisa lembrar de enviar.** A página não envia sozinha: o último toque é no
  WhatsApp. A tela final insiste nisso; na ficha o termo fica aguardando com o prazo à vista, e
  "Reenviar" manda o mesmo link de novo.
- **WhatsApp da clínica só no celular:** ali o link de volta não abre o Auri. A página `recebido`
  orienta abrir no computador; o melhor é a recepção usar o WhatsApp no Auri ou o Desktop.
- **Link longo como reserva.** O link curto resolve o tamanho quando o site responde. Sem o site
  (3 s no Auri, 1,5 s ou sem internet na página), vai o link longo, de 1.000 a 4.000 caracteres.
  Falta confirmar como o WhatsApp (iPhone, Android, Desktop e Web) trata esses links e se o
  `wa.me` corta textos longos; "Copiar mensagem" e "Colar resposta" cobrem a falha.
- **O termo depende do site para abrir pelo link curto.** Sem internet no celular ou com o site
  fora do ar, a página mostra "Sem internet"; depois de um dia do prazo, o termo some do site.
- **Celulares antigos:** iPhone sem iOS 16.4 não tem `CompressionStream`. Se aparecer na prática,
  entra em `web/contrato/assinatura/` um inflate próprio e pequeno, sem dependência.
- **Prazo e uso único dependem do Auri:** a página não impede ninguém de responder depois; quem
  recusa é o Auri.

## Em aberto

- Quais modelos a Elo terá no começo (consentimento, uso de imagem, contrato) e se algum é
  obrigatório para todo paciente.

## Erros

- Link de ida incompleto ou adulterado (base64 inválido, etiqueta GCM não confere): "Este link está
  incompleto. Abra de novo pela mensagem da clínica."
- Resposta de outro Auri ou de envio desconhecido: "Esta resposta não é de um termo enviado por
  este Auri."
- Resposta danificada (copiada pela metade): "A resposta chegou incompleta. Peça para enviar de
  novo pelo mesmo link."
- Texto diferente do enviado: "O texto assinado não é o que foi enviado." Recusada.
- Falha ao gerar o PDF: o termo continua guardado (o PDF sai do registro); a linha mostra o erro e
  "Abrir PDF" tenta de novo.
- `auri://` sem resposta (Auri não instalado nesse computador): a página `recebido` mostra
  "Copiar resposta" depois de 2 s.

## Testes

- `web/contrato/assinatura/`: ida e volta dos dois links no Node (WebCrypto); chave errada; um
  caractere trocado; link cortado; dado adicional trocado (resposta de um envio usada em outro);
  id de dentro diferente do de fora; versão desconhecida; limites e tolerância que sobe até caber;
  conteúdo do termo (blocos, negrito, nunca HTML); descompressão com teto; traço: simplificação
  dentro da tolerância, ida e volta da codificação e tamanho com assinaturas fictícias.
- `desktop`: leitura do `auri://` (com `#`, `?r=` ou `/`, longo demais, outro caminho); endereço
  nos argumentos do Windows; fila até a tela retirar; links curtos (`links-curtos.test.ts`);
  conferência (desconhecido,
  cancelado, trocado, repetido igual, repetido diferente, vencido, hash diferente, CPF inválido);
  triggers recusam `UPDATE` e `DELETE`; PDF gerado do registro, com o hash do documento; envio e
  recebimento pelo outro computador (servidor e cliente por TCP local, banco em memória).
- `web`: Vitest da página (abrir o link e cada estado de erro, rascunho, validar campos, montar a
  resposta que o Auri lê, telas desenhadas sem HTML do termo) e dos cabeçalhos da Vercel; manual no
  iPhone (Safari e navegador do WhatsApp) e no Android (Chrome e navegador do WhatsApp).
- Só dados fictícios.
