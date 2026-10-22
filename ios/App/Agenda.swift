import BackgroundTasks
import Foundation
import Observation
import WidgetKit

@MainActor
@Observable
final class Agenda {
  private let conexao: Conexao
  private(set) var porDia: [Date: [Evento]] = [:]
  private(set) var etiquetas: [Etiqueta] = []
  private(set) var carregada = false
  private(set) var erro: String?

  let primeiroMes: Date
  let ultimoMes: Date

  init(conexao: Conexao) {
    self.conexao = conexao
    let mes = DataLocal.inicioDoMes(.now)
    primeiroMes = DataLocal.somar(.month, -12, a: mes)
    ultimoMes = DataLocal.somar(.month, 24, a: mes)
  }

  var meses: [Date] {
    var lista: [Date] = []
    var mes = primeiroMes
    while mes <= ultimoMes {
      lista.append(mes)
      mes = DataLocal.somar(.month, 1, a: mes)
    }
    return lista
  }

  var todos: [Evento] {
    porDia.values.flatMap { $0 }.sorted { $0.inicio < $1.inicio }
  }

  var etiquetasDeSessao: [Etiqueta] {
    etiquetas.filter { $0.categoria != "compromisso" }
  }

  func eventos(em dia: Date) -> [Evento] {
    porDia[DataLocal.inicioDoDia(dia)] ?? []
  }

  func cores(em dia: Date) -> [String] {
    var vistas: [String] = []
    for evento in eventos(em: dia) where !vistas.contains(evento.cor) {
      vistas.append(evento.cor)
      if vistas.count == 3 { break }
    }
    return vistas
  }

  func carregar() async {
    let de = JSONValor.texto(DataLocal.texto(primeiroMes))
    let ate = JSONValor.texto(DataLocal.texto(DataLocal.somar(.month, 1, a: ultimoMes)))
    do {
      let sessoes = try await conexao.operacao("appointments:listRange", [de, ate])
        .decodificar([Sessao].self)
      let compromissos = try await conexao.operacao("commitments:listRange", [de, ate])
        .decodificar([Compromisso].self)
      etiquetas = try await conexao.operacao("tipos:list").decodificar([Etiqueta].self)
      let eventos = sessoes.compactMap { Evento($0) } + compromissos.compactMap { Evento($0) }
      porDia = Dictionary(grouping: eventos) { DataLocal.inicioDoDia($0.inicio) }
        .mapValues { $0.sorted { $0.inicio < $1.inicio } }
      carregada = true
      erro = nil
      atualizarResumo()
    } catch {
      erro = error.localizedDescription
    }
  }

  static var nomesNosWidgets: Bool {
    get { UserDefaults.standard.object(forKey: "widgets-nomes") as? Bool ?? true }
    set { UserDefaults.standard.set(newValue, forKey: "widgets-nomes") }
  }

  func atualizarResumo() {
    let hoje = DataLocal.inicioDoDia(.now)
    let dias = [hoje, DataLocal.somar(.day, 1, a: hoje)]
    let itens = Self.itensDoResumo(dias.flatMap { eventos(em: $0) }, nomes: Self.nomesNosWidgets)
    try? Resumo(itens: itens, atualizado: .now).gravar()
    WidgetCenter.shared.reloadAllTimelines()
  }

  nonisolated static func itensDoResumo(_ eventos: [Evento], nomes: Bool) -> [Resumo.Item] {
    eventos.map { evento in
      let titulo: String
      let etiqueta: String
      switch evento.origem {
      case .sessao(let sessao):
        titulo = nomes ? Resumo.nomeCurto(sessao.patientNome) : sessao.tipoNome
        etiqueta = sessao.tipoNome
      case .compromisso(let compromisso):
        titulo = evento.titulo
        etiqueta = compromisso.etiquetaNome
      }
      return Resumo.Item(inicio: evento.inicio, fim: evento.fim, cor: evento.cor, titulo: titulo, etiqueta: etiqueta)
    }
  }

  func atualizarEmSegundoPlano() async {
    Self.agendarAtualizacao()
    guard (try? await conexao.garantirConexao()) != nil else { return }
    await carregar()
  }

  static func agendarAtualizacao() {
    let pedido = BGAppRefreshTaskRequest(identifier: Resumo.tarefa)
    pedido.earliestBeginDate = Date.now.addingTimeInterval(30 * 60)
    try? BGTaskScheduler.shared.submit(pedido)
  }

  func esquecer() {
    porDia = [:]
    Resumo.apagar()
    WidgetCenter.shared.reloadAllTimelines()
  }

  func marcar(paciente: Int, inicio: Date, minutos: Int, etiqueta: Int?, observacao: String) async throws {
    let fim = inicio.addingTimeInterval(TimeInterval(minutos * 60))
    var dados: [String: JSONValor] = [
      "patient_id": .numero(Double(paciente)),
      "inicio": .texto(DataLocal.texto(inicio)),
      "fim": .texto(DataLocal.texto(fim)),
      "observacao": .texto(observacao),
    ]
    if let etiqueta { dados["tipo_id"] = .numero(Double(etiqueta)) }
    _ = try await conexao.operacao("appointments:create", [.objeto(dados)])
    await carregar()
  }
}
