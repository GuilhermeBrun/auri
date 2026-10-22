@preconcurrency import BareKit
import Foundation
import Observation

struct Endereco: Codable, Equatable, Sendable {
  var host: String
  var port: Int
}

struct Servidor: Codable, Equatable, Sendable {
  var chave: String
  var nome: String
  var enderecos: [Endereco]
}

enum Situacao: Equatable {
  case semComputador
  case conectando
  case conectado(pelaInternet: Bool)
  case semConexao
  case versao
  case removido
  case falha(String)
}

private final class Canal: @unchecked Sendable {
  let ipc: IPC

  init(worklet: Worklet) {
    ipc = IPC(worklet: worklet)
  }

  func escrever(_ dados: Data) async {
    try? await ipc.write(data: dados)
  }
}

struct ErroDoAuri: LocalizedError {
  let mensagem: String
  var errorDescription: String? { mensagem }
}

@MainActor
@Observable
final class Conexao {
  private(set) var situacao: Situacao
  private(set) var servidor: Servidor?
  private(set) var registro: [String] = []

  private var worklet: Worklet?
  private var canal: Canal?
  private var escrita: Task<Void, Never>?
  private var proximo = 1
  private var esperando: [Int: CheckedContinuation<JSONValor, Error>] = [:]
  private var resto = Data()

  private static let chaveDoServidor = "servidor"

  init() {
    let guardado = UserDefaults.standard.data(forKey: Self.chaveDoServidor)
      .flatMap { try? JSONDecoder().decode(Servidor.self, from: $0) }
    servidor = guardado
    situacao = guardado == nil ? .semComputador : .conectando
  }

  func iniciar() {
    guard worklet == nil else { return }
    let worklet = Worklet()
    worklet.start(name: "app", ofType: "bundle")
    let canal = Canal(worklet: worklet)
    self.worklet = worklet
    self.canal = canal
    Task { [weak self] in
      do {
        for try await dados in canal.ipc {
          self?.receber(dados)
        }
      } catch {
        self?.anotar("A conexão interna do app fechou.")
      }
    }
    do {
      enviar(["t": .texto("iniciar"), "semente": .texto(try Chaves.semente()), "nome": .texto("iPhone")])
    } catch {
      situacao = .falha("Não foi possível guardar a chave deste iPhone no Chaveiro.")
      return
    }
    if let servidor { conectar(servidor) }
  }

  func suspender() {
    worklet?.suspend()
  }

  func retomar() {
    worklet?.resume()
  }

  func parear(host: String, porta: Int, codigo: String) async throws {
    let dados = try await pedir([
      "t": .texto("parear"),
      "endereco": .objeto(["host": .texto(host), "port": .numero(Double(porta))]),
      "codigo": .texto(codigo)
    ])
    let novo = try dados.decodificar(Servidor.self)
    UserDefaults.standard.set(try JSONEncoder().encode(novo), forKey: Self.chaveDoServidor)
    servidor = novo
    anotar("Pareado com \(novo.nome).")
    conectar(novo)
  }

  func conectar(_ alvo: Servidor, soPelaInternet: Bool = false) {
    var rota = alvo
    if soPelaInternet { rota.enderecos = [] }
    guard let valor = try? JSONDecoder().decode(JSONValor.self, from: JSONEncoder().encode(rota)) else {
      return
    }
    situacao = .conectando
    enviar(["t": .texto("conectar"), "servidor": valor])
  }

  func esquecer() {
    enviar(["t": .texto("desconectar")])
    UserDefaults.standard.removeObject(forKey: Self.chaveDoServidor)
    servidor = nil
    situacao = .semComputador
  }

  func operacao(_ canal: String, _ args: [JSONValor] = []) async throws -> JSONValor {
    try await pedir(["t": .texto("operacao"), "canal": .texto(canal), "args": .lista(args)])
  }

  func testarPelaInternet() async throws -> Int {
    let dados = try await pedir(["t": .texto("testar")])
    return Int(dados["ms"]?.numero ?? 0)
  }

  func anotarTeste(_ ms: Int) {
    anotar("Pela internet, \(servidor?.nome ?? "o computador") respondeu em \(ms) ms.")
  }

  private func pedir(_ mensagem: [String: JSONValor]) async throws -> JSONValor {
    let id = proximo
    proximo += 1
    var completa = mensagem
    completa["id"] = .numero(Double(id))
    return try await withCheckedThrowingContinuation { continuacao in
      esperando[id] = continuacao
      enviar(completa)
    }
  }

  private func enviar(_ mensagem: [String: JSONValor]) {
    guard let canal, var dados = try? JSONEncoder().encode(JSONValor.objeto(mensagem)) else { return }
    dados.append(0x0A)
    let anterior = escrita
    escrita = Task {
      await anterior?.value
      await canal.escrever(dados)
    }
  }

  private func receber(_ dados: Data) {
    resto.append(dados)
    while let fim = resto.firstIndex(of: 0x0A) {
      let linha = resto[resto.startIndex..<fim]
      resto = Data(resto[resto.index(after: fim)...])
      guard !linha.isEmpty, let mensagem = try? JSONDecoder().decode(JSONValor.self, from: linha) else {
        continue
      }
      tratar(mensagem)
    }
  }

  private func tratar(_ mensagem: JSONValor) {
    switch mensagem["t"]?.texto {
    case "pronto":
      anotar("Chave deste iPhone criada.")
    case "estado":
      atualizar(status: mensagem["status"]?.texto, via: mensagem["via"]?.texto)
    case "evento":
      anotar("Dados mudaram no computador.")
    case "resposta":
      guard let id = mensagem["id"]?.numero.map(Int.init),
        let continuacao = esperando.removeValue(forKey: id)
      else { return }
      let resultado = mensagem["result"]
      if resultado?["ok"]?.booleano == true {
        continuacao.resume(returning: resultado?["data"] ?? .nulo)
      } else {
        continuacao.resume(throwing: ErroDoAuri(mensagem: resultado?["error"]?.texto ?? "Erro inesperado"))
      }
    case "falha":
      anotar(mensagem["mensagem"]?.texto ?? "Erro inesperado")
    default:
      break
    }
  }

  private func atualizar(status: String?, via: String?) {
    switch status {
    case "connecting": situacao = .conectando
    case "connected": situacao = .conectado(pelaInternet: via == "internet")
    case "offline": situacao = .semConexao
    case "version": situacao = .versao
    case "revoked": situacao = .removido
    default: return
    }
    anotar(descricao)
  }

  private func anotar(_ texto: String) {
    registro.insert(texto, at: 0)
    if registro.count > 50 { registro.removeLast() }
  }

  var descricao: String {
    let nome = servidor?.nome ?? "o computador"
    switch situacao {
    case .semComputador: return "Nenhum computador conectado"
    case .conectando: return "Conectando a \(nome)…"
    case .conectado(let pelaInternet):
      return pelaInternet ? "Conectado pela internet" : "Conectado pela rede da clínica"
    case .semConexao: return "Sem conexão com \(nome)"
    case .versao: return "\(nome) usa outra versão do Auri"
    case .removido: return "Este iPhone foi desconectado de \(nome)"
    case .falha(let mensagem): return mensagem
    }
  }
}
