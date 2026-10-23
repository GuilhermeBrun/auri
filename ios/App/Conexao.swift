@preconcurrency import BareKit
import Foundation
import Observation
import os

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
  case conectando
  case conectado(pelaInternet: Bool)
  case semConexao
  case versao(atualizarOApp: Bool)
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
  private(set) var situacao: Situacao = .conectando
  private(set) var servidor: Servidor?
  private(set) var mudancas = 0
  var aoAvisar: ((Aviso) -> Void)?

  private var worklet: Worklet?
  private var canal: Canal?
  private var escrita: Task<Void, Never>?
  private var proximo = 1
  private var esperando: [Int: CheckedContinuation<JSONValor, Error>] = [:]
  private var resto = Data()
  private let registro = Logger(subsystem: "com.auri.ios", category: "conexao")

  private static let chaveDoServidor = "servidor"

  private static var bootstrapDeTeste: JSONValor? {
    #if DEBUG
      guard let texto = ProcessInfo.processInfo.environment["AURI_BOOTSTRAP"] else { return nil }
      return .lista(
        texto.split(separator: ",").compactMap { endereco in
          let partes = endereco.split(separator: ":")
          guard partes.count == 2, let porta = Double(partes[1]) else { return nil }
          return .objeto(["host": .texto(String(partes[0])), "port": .numero(porta)])
        })
    #else
      nil
    #endif
  }

  init() {
    servidor = UserDefaults.standard.data(forKey: Self.chaveDoServidor)
      .flatMap { try? JSONDecoder().decode(Servidor.self, from: $0) }
  }

  var conectado: Bool {
    if case .conectado = situacao { return true }
    return false
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
        self?.registro.error("O worklet fechou.")
      }
    }
    do {
      var inicio: [String: JSONValor] = [
        "t": .texto("iniciar"), "semente": .texto(try Chaves.semente()), "nome": .texto("iPhone"),
      ]
      if let bootstrap = Self.bootstrapDeTeste { inicio["bootstrap"] = bootstrap }
      enviar(inicio)
    } catch {
      situacao = .falha("Não foi possível guardar a chave deste iPhone no Chaveiro.")
      return
    }
    if let servidor { conectar(servidor) }
  }

  func suspender() {
    worklet?.suspend()
  }

  func garantirConexao() async throws {
    guard servidor != nil else {
      throw ErroDoAuri(mensagem: "Abra o Auri e conecte ao computador da clínica.")
    }
    iniciar()
    retomar()
    for _ in 0..<40 where !conectado {
      try await Task.sleep(for: .milliseconds(500))
    }
    guard conectado else { throw ErroDoAuri(mensagem: descricao) }
  }

  func retomar() {
    worklet?.resume()
  }

  func parear(qr: String) async throws {
    let dados = try await pedir(["t": .texto("parear"), "qr": .texto(qr)])
    let novo = try dados.decodificar(Servidor.self)
    UserDefaults.standard.set(try JSONEncoder().encode(novo), forKey: Self.chaveDoServidor)
    servidor = novo
    conectar(novo)
  }

  func esquecer() {
    enviar(["t": .texto("desconectar")])
    UserDefaults.standard.removeObject(forKey: Self.chaveDoServidor)
    servidor = nil
    situacao = .conectando
  }

  func operacao(_ canal: String, _ args: [JSONValor] = []) async throws -> JSONValor {
    try await pedir(["t": .texto("operacao"), "canal": .texto(canal), "args": .lista(args)])
  }

  func testarPelaInternet() async throws -> Int {
    let dados = try await pedir(["t": .texto("testar")])
    return Int(dados["ms"]?.numero ?? 0)
  }

  var descricao: String {
    let nome = servidor?.nome ?? "o computador"
    switch situacao {
    case .conectando: return "Conectando…"
    case .conectado(let pelaInternet):
      return pelaInternet ? "Conectado pela internet" : "Conectado pela rede da clínica"
    case .semConexao: return "Sem conexão com \(nome)"
    case .versao(let atualizarOApp):
      return atualizarOApp ? "Atualize o Auri do iPhone" : "Atualize o Auri do computador que guarda os dados"
    case .removido: return "Este iPhone foi desconectado de \(nome)"
    case .falha(let mensagem): return mensagem
    }
  }

  private func conectar(_ alvo: Servidor) {
    guard let valor = try? JSONDecoder().decode(JSONValor.self, from: JSONEncoder().encode(alvo)) else {
      return
    }
    situacao = .conectando
    enviar(["t": .texto("conectar"), "servidor": valor])
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

  func receber(_ dados: Data) {
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
    case "estado":
      atualizar(
        status: mensagem["status"]?.texto, via: mensagem["via"]?.texto,
        atualizarOApp: mensagem["atualizar"]?.texto == "app")
    case "evento":
      mudancas += 1
    case "aviso":
      if let titulo = mensagem["titulo"]?.texto, let corpo = mensagem["corpo"]?.texto,
        let inicio = mensagem["inicio"]?.texto
      {
        aoAvisar?(Aviso(titulo: titulo, corpo: corpo, inicio: inicio))
      }
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
      registro.error("Falha no worklet: \(mensagem["mensagem"]?.texto ?? "", privacy: .public)")
    default:
      break
    }
  }

  private func atualizar(status: String?, via: String?, atualizarOApp: Bool) {
    switch status {
    case "connecting": situacao = .conectando
    case "connected": situacao = .conectado(pelaInternet: via == "internet")
    case "offline": situacao = .semConexao
    case "version": situacao = .versao(atualizarOApp: atualizarOApp)
    case "revoked": situacao = .removido
    default: return
    }
  }
}
