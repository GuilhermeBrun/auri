# Cópia de segurança na nuvem e configurações — design

Data: 13/10/2026. Estado: em implementação (fases 1 a 4).

## Objetivo

Quem quiser guarda uma cópia dos dados do Auri (pacientes e agenda) no Google Drive, no OneDrive
ou no iCloud Drive, e consegue voltar com ela em outro computador. À parte, as configurações do
Auri podem ser exportadas e importadas num arquivo próprio. O caminho tem de ser o mais amigável
possível: o Auri descobre o que está instalado e conduz o usuário pelo que falta.

Sucesso: a recepção liga a cópia uma vez (nuvem, senha, código de recuperação) e esquece; se o
computador quebrar, um computador novo com o Auri restaura tudo com a senha ou o código.

## Decisões tomadas

- **Pasta sincronizada, não API.** O Auri grava na pasta que o app do Google Drive, do OneDrive ou
  do iCloud cria no computador. Sem login no Auri, sem cadastrar o app no Google ou na Microsoft e
  sem depender das APIs deles (ver regra de não ficar preso a plataforma). Qualquer outra pasta
  (pendrive, HD externo, Dropbox) também serve.
- **O usuário escolhe a nuvem**, em cartões com o estado de cada uma: pronto, falta entrar na
  conta, desligado (iCloud), sem permissão (macOS) ou não instalado. iCloud só no Mac.
- **O Auri conduz a instalação:** baixa o instalador oficial (endereços do Google e da Microsoft) e
  o abre; abre o app para entrar na conta; abre os Ajustes do Sistema para ligar o iCloud. Enquanto
  o assistente está aberto, procura de novo a cada poucos segundos e avança sozinho.
- **Cópia cifrada com senha.** AES-256-GCM. Uma chave aleatória (chave da cópia) cifra os dados e
  vai guardada duas vezes no cabeçalho de cada arquivo: presa à senha e presa ao código de
  recuperação (scrypt em cada uma). A chave fica no cofre do sistema deste computador, então as
  cópias automáticas não pedem senha.
  - **Alterar senha:** pede a atual e a nova.
  - **Esqueci a senha:** código de recuperação + senha nova.
  - **Novo código de recuperação:** pede a senha; o código antigo deixa de valer.
  - Alterar senha e "esqueci a senha" mantêm a chave e trocam o envelope da senha; o novo código
    sorteia uma chave nova (o código em si nunca fica guardado, então só dá para trocar a chave
    quando o usuário traz a senha e um código novo é gerado). Nos três casos todas as cópias da
    pasta são regravadas, então a senha ou o código antigo não abrem mais nenhuma delas (a não ser
    em versões antigas que a própria nuvem guarde no histórico dela).
  - O código aparece borrado até clicar (como o código de pareamento), com Copiar e Imprimir.
- **Frequência escolhida pelo usuário:** todo dia num horário (padrão 19h; se o computador estava
  desligado, sai ao abrir), a cada alteração (5 minutos depois da última mudança) ou só quando
  pedir. "Fazer cópia agora" sempre. Ficam as últimas 30 cópias. Mais de 3 dias sem cópia vira
  aviso.
- **Restaurar substitui só os dados**, nunca as configurações. Antes guarda o estado atual neste
  computador e oferece "Desfazer restauração". Copias deste mesmo computador abrem sem senha (a
  chave está no cofre); de outro, com a senha ou o código.
- **Configurações separadas dos dados**, em outra aba e outro arquivo (`.auriconfig`), sem senha e
  só manual: aparência, opções da Conexão (papel, nome, compartilhar, manter rodando, abrir ao
  ligar, acesso de fora) e as escolhas da cópia (nuvem, frequência, horário). Nunca vão chaves,
  computadores pareados, a senha ou a chave da cópia. Ao importar, mostra o que muda e só aplica
  depois de confirmar.
- **Primeira abertura** (banco vazio, ainda sem escolha): "Já usa o Auri?" com passos separados
  para restaurar dados e importar configurações, e a saída "Começar do zero".
- **Só o computador que guarda os dados faz cópias.** No consultório (papel cliente) a aba explica
  isso; exportar e importar configurações funciona nos dois.

## Arquivo da cópia (`.auribackup`)

```
"AURIBAK1"                       8 bytes
tamanho do cabeçalho             uint32 big-endian
cabeçalho                        JSON UTF-8 (legível sem senha)
dados                            AES-256-GCM(gzip(arquivo SQLite)), cabeçalho como dado adicional
etiqueta                         16 bytes (GCM)
```

O cabeçalho traz `format`, `createdAt`, `schemaVersion`, contagens (pacientes e sessões, para a
lista de cópias), `keyId` (identifica a chave sem revelá-la), o `iv` dos dados e os dois
envelopes da chave (`password`, `recovery`: sal, parâmetros do scrypt, `iv`, chave cifrada e
etiqueta). Como o cabeçalho é dado adicional do GCM, mexer nas contagens invalida o arquivo.

Nome: `Auri 2026-10-13 19h00.auribackup`, em `<nuvem>/Auri/Cópias/`. Gravação em arquivo
temporário + renomear.

## Arquitetura

```
src/main/backup/
  crypto.ts            chave, envelopes (senha e código), cifrar/decifrar o arquivo
  archive.ts           formato .auribackup: montar, ler cabeçalho, abrir
  store.ts             copias.json: destino, frequência, envelopes, chave (cofre), última cópia
  providers.ts         Google Drive / OneDrive / iCloud: estado e pasta, por sistema
  installer.ts         baixar e abrir instaladores, abrir app ou Ajustes para entrar na conta
  backup.ts            fazer cópia, guardar as 30 últimas, listar, preparar restauração
  scheduler.ts         quando copiar (diária, a cada alteração, manual)
  settings-transfer.ts exportar e importar o .auriconfig
src/main/backup-service.ts  junta tudo e expõe para o IPC (window.backup, window.transfer)
```

- A restauração troca o arquivo do banco pelo `Connection` (`replaceDatabase`), que fecha o banco,
  troca o arquivo, abre (migrando se a cópia for de versão anterior) e avisa telas e computadores
  conectados. Cópia de versão mais nova que o app é recusada ("atualize o Auri").
- As telas leem o estado por um store como o da Conexão (`useBackup`), com aviso do main a cada
  mudança.

## Fases

1. Cópia cifrada para uma pasta escolhida, frequência, restauração com desfazer, alterar senha,
   esqueci a senha, novo código.
2. Detecção das nuvens e o assistente de escolha (cartões com estado).
3. Instalação conduzida (baixar instalador, abrir app/Ajustes, esperar a pasta aparecer).
4. Exportar e importar configurações e a tela de primeira abertura.

## Erros

- Pasta sumiu (nuvem desligada, pendrive fora): a cópia falha, o erro aparece na aba e a próxima
  tentativa é no próximo ciclo (5 minutos).
- Senha ou código errado: "Senha incorreta" (a etiqueta GCM do envelope não confere).
- Arquivo corrompido ou adulterado: "Este arquivo está danificado" (etiqueta dos dados).
- Banco restaurado que não passa no `integrity_check`: recusado antes de trocar qualquer coisa.
- Download do instalador falhou: mensagem e o link da página oficial para baixar pelo navegador.

## Testes

- `crypto`/`archive`: ida e volta; senha errada; código de recuperação; cabeçalho adulterado.
- `backup`: cópia de um banco real (better-sqlite3), retenção de 30, listar, restaurar o conteúdo.
- `providers`: Mac e Windows com sistema de arquivos e registro falsos.
- `scheduler`: horário diário, computador desligado no horário, a cada alteração.
- `settings-transfer`: ida e volta, arquivo inválido, campos que faltam.
