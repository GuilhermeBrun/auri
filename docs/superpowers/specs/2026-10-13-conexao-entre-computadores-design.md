# Conexão entre computadores — design

Data: 13/10/2026. Estado: aprovado na conversa; fase 1 em implementação.

## Objetivo

Dois computadores da clínica Elo usam os mesmos pacientes e a mesma agenda: o da recepção
(secretária) e o do consultório (médica). Sem banco de dados externo. Só o Auri instalado, sem
outro programa (nada de Tailscale à parte) e sem acesso pelo navegador ou celular.

Sucesso: a secretária marca uma sessão e ela aparece no computador da médica em poucos segundos,
sem ninguém exportar ou importar arquivo; de casa a médica também acessa, se a rede permitir.

## Decisões tomadas

- **Modelo do T3 Code:** um computador guarda os dados (servidor) e o outro só mostra as telas
  (cliente). Um banco só, então não há conflito de sincronização e a regra de não sobrepor sessões
  continua estrita. Sem o servidor, o cliente não funciona (aceito; edição offline fica para
  depois, se fizer falta).
- **Mesmo app, dois papéis**, escolhidos em Configurações / Conexão: "Este computador guarda os
  dados" (padrão, o funcionamento de antes) ou "Usar os dados de outro computador".
- **Transporte:** Noise (`@hyperswarm/secret-stream`, padrão XX) sobre TCP na rede local; na fase 2,
  o mesmo fluxo pela rede distribuída do Hyperswarm (`hyperdht`) para acesso de fora. Cada Auri tem
  um par de chaves; a chave pública é a identidade do computador.
- **Descartados:** HTTPS com certificado próprio (substituído pelas chaves), SSH (resolve
  criptografia, não alcance, e expõe o computador inteiro), redirecionar porta no roteador, túneis
  de terceiros (Cloudflare, ngrok: dados passam abertos por eles), Tailscale (programa à parte),
  servidor de retransmissão próprio (exige infraestrutura; volta com a nuvem).

## Arquitetura

```
Consultório                                         Recepção
tela → window.api → IPC → main ──Noise/TCP──▶ servidor no main → mesmas operações → SQLite
tela ◀─ IPC ◀─ main ◀────────── aviso "agenda mudou" ◀──────────────────┘
```

- As telas e o `window.api` não mudam. No cliente, o main repassa cada chamada ao servidor.
- **Registro único de operações** (`src/main/operations.ts`): canal → validação (zod) + função +
  o que ela altera. O IPC local e o servidor de rede usam o mesmo registro, então validação, regra
  de sobreposição e mensagens são idênticas pelos dois caminhos.
- **Avisos ao vivo:** toda gravação bem-sucedida (de qualquer origem) gera "pacientes mudou" ou
  "agenda mudou"; o servidor manda para as janelas locais e para os clientes, e a tela invalida o
  cache do React Query.
- **Protocolo:** mensagens JSON, uma por mensagem do secret-stream: `hello` (versões) → `welcome`
  ou `reject`; `req`/`res` com id; `event`; `ping`/`pong`. Versões diferentes do protocolo ou do
  banco são recusadas antes de qualquer leitura.
- **Gravações não são repetidas automaticamente:** se a resposta se perde, repetir poderia criar
  uma sessão em dobro. Pedido sem resposta em 15 s falha com "sem conexão".
- **Edição concorrente:** `patients.update` e `appointments.update` recebem o `updated_at` de
  quando o registro foi aberto; se mudou, a gravação é recusada com "Esta ficha foi alterada em
  outro computador".

## Pareamento e segurança

- **Chaves:** geradas na primeira vez e guardadas em `conexao.json` na pasta do Auri, com a chave
  secreta cifrada pelo cofre do sistema (`safeStorage`: Chaveiro no Mac, DPAPI no Windows) quando
  disponível.
- **Servidor** só aceita chaves pareadas; **cliente** só aceita a chave do servidor com que pareou.
  Remover um computador apaga a chave dele e derruba a conexão aberta.
- **Código de pareamento:** 12 caracteres (base32 de Crockford, ~60 bits), mostrados em três
  grupos, válido por 5 minutos, de uso único, descartado após 5 tentativas erradas. Era para ser
  de 6 dígitos, mas 6 dígitos podem ser descobertos por força bruta por quem interceptar uma
  tentativa; com 60 bits isso é inviável.
- **Prova:** o código nunca viaja. O cliente manda `HMAC(código, hash do handshake)`; o hash
  amarra as duas chaves desta conexão, então um intermediário (chaves diferentes de cada lado)
  produz provas que não batem. O servidor responde com a própria prova, e os dois se autenticam.
- **Descoberta:** com o compartilhamento ligado, o servidor se anuncia na rede local por
  Bonjour/mDNS (`_auri._tcp`: nome, porta, chave pública). Sem dados. Fallback: digitar o
  endereço.
- Pedidos validados pelo mesmo zod; mensagens acima de 1 MB derrubam a conexão; logs sem dados de
  pacientes.
- **Fora do escopo:** login por pessoa (está no roadmap como "senha de acesso").

## Configurações / Conexão

Página de uma coluna, como Aparência. Dois cartões de papel no topo.

**Guarda os dados (recepção):** compartilhar na rede (desligado por padrão: nenhuma porta aberta);
"Conectar computador" mostra o código; lista de computadores pareados (online/visto por último,
Remover); continuar rodando ao fechar a janela e abrir ao ligar o computador (ligados ao ativar o
compartilhamento); nome deste computador. Aviso do firewall do Windows.

**Usa os dados de outro (consultório):** lista de Auri encontrados na rede + digitar endereço;
código; depois "Conectado a Recepção", estado e Desconectar. Os dados locais ficam no disco e não
aparecem enquanto conectado; voltam ao desconectar. Sem junção de bases.

Trocar de papel não reinicia o app: o main fecha banco/conexão, abre o novo e manda a tela recarregar.

## Estados no consultório

- Conectado: nada aparece.
- Abrindo sem conexão: esqueletos; depois de ~5 s, `ErrorState` "Sem conexão com Recepção",
  tentando de novo sozinho, com "Tentar agora" e link para Conexão.
- Caiu no meio do uso: dados carregados ficam; aviso fixo "Sem conexão com Recepção. Tentando
  reconectar…"; salvar dá erro e o formulário mantém o que foi digitado; ao voltar, "Conectado de
  novo" e recarga.
- Versão diferente ou acesso removido: `ErrorState` próprio, nada é lido nem gravado.
- Recepção: sair com cliente conectado pede confirmação; enquanto houver cliente, o computador não
  entra em suspensão.

## Fases

1. **Rede da clínica:** registro de operações, edição concorrente, protocolo, pareamento, servidor
   TCP + mDNS, cliente com reconexão, segundo plano/bandeja/abrir ao ligar, aba Conexão, estados.
2. **Acesso de fora:** o servidor também escuta pela `hyperdht` com a mesma chave; o cliente tenta
   a rede local e a DHT; botão "Testar acesso de fora da clínica". Não muda segurança nem telas.
   Limitação conhecida: falha se as duas pontas estiverem atrás de NAT restritivo (CGNAT nos dois
   lados, celular roteando).

## Testes

- Automáticos (Vitest): registro de operações; `updated_at` antigo recusado; código certo/errado/
  vencido/usado/5 tentativas; prova com chaves trocadas falha; chave não pareada recusada; remover
  derruba; integração servidor + cliente por TCP local com banco em memória (avisos, queda sem
  repetição, versões diferentes).
- Manual com duas máquinas (Mac + Windows) ao fim de cada fase, incluindo firewall do Windows,
  bandeja e abrir ao ligar; fase 2 testada da casa da médica ou de um celular roteando.
- Só dados fictícios.
