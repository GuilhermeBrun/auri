# Assinatura de termos pelo celular — design

Data: 18/10/2026. Estado: desenho para aprovação; nada implementado.
Protótipo interativo (dados fictícios): https://claude.ai/artifact/KLQ9VjRhNNeyoKhQLdtMds

Os caminhos já seguem a estrutura nova do repositório (`desktop/`, `web/`, `shared/`), que está
sendo montada em paralelo.

## Objetivo

O responsável pelo paciente lê e assina o termo no próprio celular, e o termo assinado fica na
ficha do paciente no Auri, em PDF. Sem banco de dados nem servidor guardando nada: só o Auri da
recepção, o WhatsApp que a clínica e a família já usam e uma página estática no auri.dev.br.

O computador da recepção fica virado para a secretária: o paciente não vê a tela nem tem onde
assinar.

Sucesso: a secretária clica em "Enviar termo"; o responsável assina em dois minutos no celular e
toca em "Enviar para a clínica"; a secretária clica no link que chegou e o termo aparece como
"Assinado em 18/10", com o PDF.

## Fluxo

```
Recepção (Auri)              Celular do responsável               Recepção (WhatsApp → Auri)
"Enviar termo" ─WhatsApp─▶  auri.dev.br/assinar#<termo>
                             lê, informa nome, CPF e parentesco,
                             assina com o dedo
                             "Enviar para a clínica" ─WhatsApp─▶ auri.dev.br/recebido#<resposta>
                                                                  └▶ auri://receber#<resposta>
                                                                     confere, decifra, mostra;
                                                                     "Guardar termo assinado" → PDF
```

1. Na ficha (aba Termos), a secretária clica em "Enviar termo", escolhe para quem (a mãe da
   ficha, com o celular dela, ou outro número) e o Auri abre o WhatsApp com a mensagem pronta: o
   texto e o link `https://auri.dev.br/assinar#<termo>`. Ela toca em enviar. O termo fica
   "Aguardando assinatura".
2. O responsável abre o link no celular. A página decifra o termo e mostra a clínica, o paciente e
   o texto. Ele informa nome completo, CPF e parentesco, marca o aceite e assina com o dedo.
3. "Enviar para a clínica" cifra a resposta e abre o WhatsApp com o número da clínica e a mensagem
   com `https://auri.dev.br/recebido#<resposta>`. Ele toca em enviar. A página não tem como saber
   se ele enviou: a tela final diz que falta esse toque e oferece abrir o WhatsApp de novo.
4. A mensagem chega no WhatsApp da clínica (Desktop ou Web, no computador da recepção). A
   secretária clica no link; a página `recebido` só repassa o fragmento para
   `auri://receber#<resposta>` (o navegador pergunta uma vez se pode abrir o Auri).
5. O Auri acha o envio pelo id, decifra com a chave que guardou, confere (ver "Conferência") e
   mostra o que chegou: nome, CPF, parentesco, a assinatura e as conferências. "Guardar termo
   assinado" gera o PDF e o termo fica "Assinado em 18/10".
6. Reserva: se o `auri://` não abrir (navegador que bloqueia, link aberto no celular da clínica), a
   página `recebido` tem "Copiar resposta" e o Auri tem "Colar resposta", que aceita a mensagem
   inteira do WhatsApp ou só o link.

## Decisões tomadas

- **Tudo no link, nada guardado fora.** O termo vai cifrado no fragmento (`#…`) do link de ida, e a
  resposta volta cifrada no fragmento do link de volta. O navegador não manda o fragmento ao
  servidor: a Vercel só vê que alguém abriu `/assinar` (endereço e horário, nos logs dela).
- **WhatsApp como transporte** nas duas pontas: é o que a família já usa, e a ida e a volta ficam
  na conversa da clínica.
- **Uma chave por envio.** O Auri sorteia uma chave AES-256-GCM a cada envio, guarda no banco e põe
  no link de ida. A página cifra a resposta com a mesma chave, e o link de volta **não leva a
  chave**: só o Auri que fez o envio lê a resposta. A chave também prova que a resposta veio de
  quem recebeu o link.
- **A cifra da ida não esconde nada de quem tem o link** (a chave vai junto). Ela deixa o formato
  único e o termo ilegível no texto do link. O que protege de verdade é a volta: CPF e assinatura
  só viajam cifrados com uma chave que não está na mensagem.
- **Descartados:** chave pública do Auri no link (ECDH) para cifrar a resposta, que só protegeria
  de quem tem o link de ida, e essa pessoa já pode assinar no lugar do responsável (o ganho não
  paga a segunda primitiva); servidor nosso guardando o termo (a regra é não ter um); certificado
  ICP-Brasil (o responsável não tem).
- **Página estática no `web/`** (Vite+ e React, na Vercel, em auri.dev.br): `/assinar` e
  `/recebido`. Sem análise de acesso, sem script de terceiros e com `connect-src 'none'` na CSP: a
  página não consegue mandar nada a lugar nenhum, só abrir o WhatsApp.
- **Código comum em `shared/`**, na raiz, sem dependências (ver "Código comum").
- **Conferência antes de guardar.** O Auri mostra o que chegou e só guarda em "Guardar termo
  assinado"; "Recusar" descarta, e a secretária pede de novo. Guardado, o termo não muda mais.
- **Termo assinado é imutável.** Um termo novo do mesmo modelo não altera o anterior: o anterior
  passa a aparecer como "Substituído em dd/mm" e os dois PDFs continuam na ficha.
- **Modelos em Configurações, com versão.** Editar um modelo cria a versão seguinte; cada envio
  guarda o texto exato da versão usada.
- **Na recepção, como os pacientes.** Envios, chaves e termos assinados ficam no banco da
  recepção. O consultório envia e recebe pelo registro de operações da Conexão, como qualquer
  outra gravação.

## Formato do link

Os dois links usam base64url sem `=` e começam pela versão do formato, para a página e o Auri
recusarem com mensagem clara o que não conhecem. A versão 1 vale desde o primeiro envio.

### Ida: `https://auri.dev.br/assinar#1.<chave>.<dados>`

```
1        versão do formato
chave    32 bytes (AES-256-GCM), 43 caracteres
dados    iv (12 bytes) | AES-GCM(chave, deflate-raw(conteúdo)) | etiqueta (16 bytes)
         dado adicional do GCM: "auri/termo/1/ida"
```

Conteúdo, em JSON com chaves curtas, antes de comprimir:

| Campo  | O que é                                                    |
| ------ | ---------------------------------------------------------- |
| `id`   | id do envio, 16 bytes aleatórios (22 caracteres)           |
| `ate`  | prazo, em segundos Unix (padrão: 7 dias depois do envio)   |
| `cli`  | nome da clínica e número de WhatsApp que recebe a resposta |
| `pac`  | nome e nascimento do paciente                              |
| `mod`  | título e versão do modelo                                  |
| `prof` | profissional responsável e registro (CRFa)                 |
| `txt`  | texto do termo, já com os campos preenchidos               |

Não vão o nome nem o CPF do responsável: quem assina digita os próprios dados, e o Auri compara
com a ficha.

### Volta: `https://auri.dev.br/recebido#1.<id>.<dados>`

```
1        versão
id       id do envio, às claras (o Auri acha a chave sem tentar todas; é aleatório)
dados    iv | AES-GCM(chave do envio, deflate-raw(conteúdo)) | etiqueta
         dado adicional: "auri/termo/1/volta/" + id
```

Conteúdo: tamanho do cabeçalho (uint16) | cabeçalho JSON | traço da assinatura (binário).

| Campo                | O que é                                                            |
| -------------------- | ------------------------------------------------------------------ |
| `id`                 | o mesmo id (conferido com o de fora)                               |
| `h`                  | SHA-256 do `txt` que a página mostrou                              |
| `nome`, `cpf`, `rel` | nome completo, CPF (11 dígitos), parentesco (`mae`, `pai`, `resp`) |
| `ok`                 | aceite marcado                                                     |
| `em`, `tz`           | hora da assinatura no relógio do celular e fuso, em minutos        |

### Assinatura em traço vetorial

Uma imagem não caberia no link; os traços cabem.

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

### Tamanhos (medidos)

Medidos com WebCrypto e `CompressionStream` de verdade (Node 24), com o mesmo código do protótipo:

| Caso                                                                                       | Link                     |
| ------------------------------------------------------------------------------------------ | ------------------------ |
| Termo de 1.528 caracteres (6 parágrafos, o do protótipo)                                   | ida com 1.401 caracteres |
| Termo de ~5.000 caracteres (pela mesma taxa de compressão)                                 | ida com ~4.000           |
| Assinatura de 4 traços (305 pontos depois de simplificar, 629 bytes), com nome, CPF e hash | volta com 1.042          |

**Limites:** ida até 4.000 caracteres e volta até 2.000. O editor do modelo mostra quanto do
limite o texto usa e não deixa salvar o que não cabe. Os dois números são constantes em `shared/`,
a ajustar depois do teste com aparelhos reais (fase 1).

### Uso único e prazo

- Conferidos no Auri, que é quem guarda os envios. A página só avisa ("Este link venceu em
  25/10"), pelo relógio do celular.
- O primeiro recebimento válido conclui o envio. A mesma resposta de novo abre o termo já
  guardado; outra resposta para o mesmo envio é recusada ("Este termo já foi assinado em 18/10").
- Enviar de novo o mesmo modelo cancela o envio anterior ainda sem resposta: a chave dele é
  apagada e uma resposta atrasada é recusada ("Este link foi trocado por um envio mais novo").
- Resposta depois do prazo é recusada, com "Enviar de novo" ao lado.
- A chave de um envio assinado, cancelado ou vencido é apagada.

## Código comum (`shared/`)

TypeScript sem nenhuma dependência: só `crypto.subtle` (WebCrypto), `CompressionStream` e
`TextEncoder`, que existem no Node do Electron e nos navegadores. Não há `package.json` nem
`node_modules` na raiz: o `desktop/` e o `web/` importam por caminho (um alias no Vite de cada um e
`paths` no tsconfig).

```
shared/terms/
  format.ts       versão, montar e ler os links de ida e de volta, limites
  crypto.ts       chave, AES-256-GCM, SHA-256
  compress.ts     deflate-raw por CompressionStream
  stroke.ts       simplificar, codificar, decodificar e desenhar (SVG) a assinatura
  base64url.ts
shared/cpf.ts     validação do CPF, que sai de desktop/src/shared/cpf.ts para servir também à página
```

Não confundir com `desktop/src/shared/`, que é comum ao main e às telas do app. Os testes ficam ao
lado (`*.test.ts`) e rodam pelo Vitest do `desktop/`, que passa a incluir `../shared`.

## Desktop

### Protocolo `auri://`

- `electron-builder.yml`:
  ```yaml
  protocols:
    - name: Auri
      schemes: [auri]
  ```
  Vira `CFBundleURLTypes` no `Info.plist` do Mac. No Windows essa chave não faz nada (o próprio
  electron-builder a documenta como só do macOS).
- `app.setAsDefaultProtocolClient('auri')` ao abrir: no Windows é isso que registra o esquema
  (`HKCU\Software\Classes\auri`), na primeira vez que o Auri abre depois de instalado. Um script do
  NSIS (`nsis.include`) apaga a chave na desinstalação. Em desenvolvimento a chamada leva
  `process.execPath` e o caminho do app, senão o sistema abriria o Electron puro.
- **Mac:** `open-url`, registrado em `will-finish-launching` (com o app fechado, o evento chega
  antes do `ready`). Só funciona com o app empacotado.
- **Windows:** o endereço chega no `argv`. Com o app fechado, em `process.argv`; aberto, no
  `second-instance`, que hoje ignora o `argv` (`desktop/src/main/index.ts`) e passa a procurar nele
  o argumento que começa com `auri://`.
- Endereços que chegam antes da janela ficam numa fila e são entregues quando ela abre.
- O endereço é entrada não confiável: só `auri://receber`, até 8 KB, com o dado depois de `#`,
  `?r=` ou `/` (há navegadores que reescrevem), sem navegar nem executar nada. O main manda para a
  tela só o resultado da conferência.
- Código novo em `desktop/src/main/terms/protocol.ts`.

### Telas

- **Ficha do paciente, aba Termos** (quarta aba, depois de Sessões). Uma linha por modelo ativo,
  com o estado:
  - **Pendente**: nunca enviado, ou o último envio venceu ou foi cancelado. Ação: "Enviar termo".
  - **Aguardando assinatura**: "Enviado para Maria em 18/10 · vence em 25/10". Ações: "Reenviar"
    (abre o WhatsApp de novo com o mesmo link), "Colar resposta" e, no menu, "Copiar link" e
    "Cancelar envio".
  - **Assinado em dd/mm**: por quem e parentesco. Ações: "Abrir PDF" e, no menu, "Enviar termo
    novo". Se o modelo ganhou versão depois: "Assinado em 12/10 · versão 2 (atual: 3)".
  - Embaixo, "Anteriores": os termos substituídos, cada um com o seu PDF.
- **Diálogo Enviar termo:** modelo, para quem (a mãe da ficha, com o celular dela, ou outro
  número), prazo (3, 7 ou 15 dias) e a prévia da mensagem. "Abrir no WhatsApp" (principal) e
  "Copiar link".
- **Conferência** (abre sozinha ao receber, ou por "Colar resposta"): paciente e termo; nome, CPF
  (borrado até clicar, como os outros dados sensíveis) e parentesco; a assinatura; as conferências;
  "Enviado para (66) 99999-1234: confira se a resposta veio desse número". "Guardar termo
  assinado" (principal) ou "Recusar".
- **Configurações / Termos:** dados da clínica (nome que o responsável vê, WhatsApp que recebe as
  respostas, profissional e registro) e os modelos (título, texto com os campos `{paciente}`,
  `{nascimento}`, `{clinica}`, `{profissional}` e `{data}`, versão atual, quanto do limite do link o
  texto usa, arquivar).

### Abrir o WhatsApp

- No computador, `whatsapp://send?phone=…&text=…` quando o WhatsApp Desktop está instalado
  (`app.getApplicationNameForProtocol`); senão `https://wa.me/<número>?text=…`, que leva ao
  WhatsApp Web.
- Por quê: pelo `wa.me`, o texto da mensagem (o link de ida, com a chave) vai como parâmetro numa
  requisição ao site do WhatsApp; o `whatsapp://` entrega direto ao app. Na volta tanto faz, porque
  o link não leva a chave.
- No celular, "Enviar para a clínica" é um link `https://wa.me/…`: com o WhatsApp instalado, o
  sistema abre o app direto (link universal no iPhone, App Link no Android).

### Conferência

Na ordem, parando no primeiro que falhar:

1. Versão do formato conhecida.
2. O envio existe neste Auri (id).
3. O envio está aguardando: não cancelado, não trocado, não assinado (ou é a mesma resposta já
   guardada, que só abre o termo).
4. Decifra com a chave do envio (etiqueta GCM e dado adicional conferem); id de dentro igual ao de
   fora.
5. Dentro do prazo, pelo relógio deste computador.
6. SHA-256 do texto mostrado igual ao do texto enviado.
7. Nome com pelo menos duas palavras, CPF válido, parentesco conhecido, aceite marcado e
   assinatura não vazia.

Avisos que não impedem guardar: CPF diferente do da mãe na ficha ("confira"); hora do celular a
mais de 10 minutos da hora do recebimento.

### Dados

Migração nova, com três tabelas:

- `term_templates`: modelos (título, texto, versão, criado em, arquivado). Cada versão é uma linha;
  a atual é a maior.
- `term_requests`: envios (paciente, modelo e versão, texto exato e SHA-256, nome e número de
  destino, chave, criado em, prazo, estado `aguardando`/`cancelado`/`assinado`/`vencido`).
- `signed_terms`: termos assinados (envio, paciente, nome, CPF, parentesco, traço, hora do celular
  e fuso, hora do recebimento, SHA-256 do documento, PDF e SHA-256 do PDF). Só aceita `INSERT`: um
  trigger recusa `UPDATE` e `DELETE`. É uma exceção à regra do projeto de validar só no código,
  porque aqui a imutabilidade é parte do valor do documento.

Operações novas no registro (`desktop/src/main/operations.ts`): `terms:templates`,
`terms:saveTemplate`, `terms:list`, `terms:send` (devolve o link), `terms:cancel`, `terms:check`
(confere e devolve o resultado), `terms:accept` (confere de novo, gera o PDF e grava) e
`terms:pdf`, com o aviso ao vivo "termos mudou". Abrir o WhatsApp e abrir o PDF são locais (IPC
próprio), no computador onde se clicou. O consultório que recebe um `auri://` repassa a resposta à
recepção pela conexão; sem conexão, a conferência mostra o erro com "Tentar de novo".

### PDF

Gerado na recepção, ao guardar, a partir de um HTML num `BrowserWindow` oculto e sem rede
(`webContents.printToPDF`), com a Bricolage embutida: sem dependência nova.

- Nome da clínica, título e versão do modelo.
- Texto do termo, exatamente como foi mostrado.
- Paciente (nome e nascimento).
- Assinatura (vetor), nome do responsável, CPF e parentesco.
- "Assinado no celular em 18/10/2026 às 14:32 (hora do aparelho, UTC−4)" e "Recebido pelo Auri em
  18/10/2026 às 14:40".
- Profissional responsável e registro.
- Registro técnico: id do envio, número e hora do envio, SHA-256 do texto, SHA-256 do documento e
  "Assinatura eletrônica simples (Lei 14.063/2020, art. 4º, I), aceita pelas partes nos termos da
  MP 2.200-2/2001, art. 10, § 2º".

O SHA-256 do documento é o do registro canônico (JSON com as chaves em ordem: id, texto e o hash
dele, paciente, dados do responsável, traço, horários e número de destino), não o do arquivo: o
PDF não tem como conter o próprio hash. O Auri guarda também o SHA-256 do arquivo e mostra os dois
nos detalhes do termo.

### Cópia de segurança

Os PDFs ficam no banco (BLOB, ~100 KB cada), então já entram no `.auribackup` cifrado sem mudar o
formato; o cabeçalho da cópia ganha a contagem de termos. As chaves dos envios aguardando vão
junto: restaurado em outro computador, o Auri ainda recebe as respostas pendentes.

## Página web (`web/`)

- `/assinar`: lê o fragmento, decifra e mostra clínica, paciente e termo; campos, aceite, quadro de
  assinatura e "Enviar para a clínica". O que já foi preenchido fica no `sessionStorage` até
  enviar (o navegador do WhatsApp recarrega a página quando se troca de app). Escala de toque do
  Design System: texto de 15px, títulos de 17px, alvos de 44px.
- Estados: link incompleto ou adulterado; versão desconhecida ("Atualize a página"); vencido;
  navegador sem WebCrypto ou `CompressionStream` (iPhone antes do iOS 16.4: "Abra o link em outro
  navegador ou aparelho"); já enviado (volta à tela final).
- **Só envia para números conhecidos** (proposta, ver "Em aberto"): a página só abre o WhatsApp
  para os números da lista de clínicas do próprio site (`web/src/clinics.ts`). Sem isso, qualquer
  um monta no nosso domínio um link com termo falso que manda CPF e assinatura para o número dele.
  Custo: trocar o número da clínica pede publicar o site de novo.
- `/recebido`: "Abrindo o Auri…", repassa para `auri://receber#…`, com "Abrir no Auri" (se o
  navegador pedir um clique) e "Copiar resposta". No celular: "Abra este link no computador da
  recepção".
- Cabeçalhos na Vercel: CSP `default-src 'self'; connect-src 'none'; frame-ancestors 'none'`,
  `Referrer-Policy: no-referrer`, sem Analytics. A prévia do link no WhatsApp é genérica ("Termo
  para assinar"), porque é gerada sem o fragmento.

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
  página exige marcar "Li e concordo" antes de enviar.
- **Documentos do profissional.** A mesma Lei 14.063 pede assinatura avançada ou qualificada para
  documentos assinados por profissionais de saúde (receitas, atestados). Aqui quem assina é o
  responsável; o profissional só aparece identificado. Confirmar com o advogado.
- **Responsável legal do menor.** Quem consente pelo paciente menor é um dos pais ou o responsável
  legal (Código Civil, art. 1.634, VII). O parentesco só oferece "Mãe", "Pai" e "Responsável legal
  (tutor ou guardião)", e o termo diz que quem assina declara ter essa condição. Avó ou tio sem a
  guarda não servem.
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
  Limitam: o link vai só para o número da ficha, vale 7 dias e uma resposta, e a conferência pede
  para ver se a resposta veio desse número.
- **Não há IP nem hora de servidor.** As horas são a do celular (que o dono pode mudar) e a do
  computador da recepção. O PDF mostra as duas e diz de onde vem cada uma; a que vale para o prazo
  é a do recebimento.
- **O responsável precisa lembrar de enviar.** A página não envia sozinha: o último toque é no
  WhatsApp. A tela final insiste nisso; na ficha o termo fica "Aguardando assinatura" com o prazo à
  vista, e "Reenviar" manda o mesmo link de novo.
- **WhatsApp da clínica só no celular:** ali o link de volta não abre o Auri. A página `recebido`
  orienta abrir no computador; o melhor é a recepção usar o WhatsApp Desktop.
- **Links longos.** Falta confirmar como o WhatsApp (iPhone, Android, Desktop e Web) trata links de
  2.000 a 6.000 caracteres e se o `wa.me` corta textos longos. É o primeiro teste da fase 1;
  "Copiar link" e "Colar resposta" cobrem a falha.
- **Celulares antigos:** iPhone sem iOS 16.4 não tem `CompressionStream`. Se aparecer na prática,
  entra em `shared/` um inflate próprio e pequeno, sem dependência.
- **Prazo e uso único dependem do Auri:** a página não impede ninguém de responder depois; quem
  recusa é o Auri.

## Em aberto

- Números da clínica fixos no site (proposta acima) ou o número vindo no link, com a página só
  mostrando em destaque para onde vai.
- Prazo padrão de 7 dias.
- CPF diferente do da ficha: só aviso (proposta) ou impede guardar.
- Quais modelos a Elo terá no começo (consentimento, uso de imagem, contrato) e se algum é
  obrigatório para todo paciente.

## Fases

1. **Formato e teste de campo:** `shared/terms` com testes, um script que gera link de teste, as
   páginas `/assinar` e `/recebido` em `web/` e o teste com aparelhos reais (links longos no
   WhatsApp; `auri://` no Chrome, no Edge e no Safari, no Mac e no Windows), com dados fictícios.
2. **Envio no Auri:** Configurações / Termos (clínica e modelos), aba Termos, diálogo de envio,
   WhatsApp e "Copiar link", operações pela conexão.
3. **Recebimento:** protocolo `auri://` (Mac e Windows), "Colar resposta", conferência, PDF, tabela
   imutável e cópia de segurança.

## Erros

- Link de ida incompleto ou adulterado (base64 inválido, etiqueta GCM não confere): "Este link está
  incompleto. Abra de novo pela mensagem da clínica."
- Resposta de outro Auri ou de envio desconhecido: "Esta resposta não é de um termo enviado por
  este Auri."
- Resposta danificada (copiada pela metade): "A resposta chegou incompleta. Peça para enviar de
  novo pelo mesmo link."
- Texto diferente do enviado: "O texto assinado não é o que foi enviado." Recusada.
- Falha ao gerar o PDF: nada é gravado (uma transação só) e a conferência mostra o erro com "Tentar
  de novo".
- `auri://` sem resposta (Auri não instalado nesse computador): a página `recebido` mostra
  "Copiar resposta" depois de 2 s.

## Testes

- `shared/terms`: ida e volta dos dois links no Node (WebCrypto); chave errada; um byte trocado;
  dado adicional trocado (resposta de um envio usada em outro); versão desconhecida; limites;
  traço: simplificação dentro da tolerância, ida e volta da codificação e tamanho com assinaturas
  fictícias gravadas.
- `desktop`: leitura do `auri://` (com `#`, `?r=` ou `/`, longo demais, outro caminho); `open-url`
  antes do `ready`; `argv` no `second-instance`; conferência (desconhecido, cancelado, trocado,
  repetido igual, repetido diferente, vencido, hash diferente, CPF inválido); trigger recusa
  `UPDATE` e `DELETE`; PDF com os dois hashes; envio e recebimento pelo consultório (servidor e
  cliente por TCP local, banco em memória).
- `web`: Vitest da página (decifrar, validar campos, montar a resposta); manual no iPhone (Safari e
  navegador do WhatsApp) e no Android (Chrome e navegador do WhatsApp).
- Só dados fictícios.
