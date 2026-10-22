import AppIntents
import Foundation

struct PacienteEntidade: AppEntity {
  static let typeDisplayRepresentation = TypeDisplayRepresentation(name: "Paciente")
  static let defaultQuery = PacientesDaClinica()

  let id: Int
  let nome: String

  var displayRepresentation: DisplayRepresentation {
    DisplayRepresentation(title: "\(nome)")
  }
}

struct PacientesDaClinica: EntityStringQuery {
  @Dependency private var conexao: Conexao

  func entities(for identifiers: [Int]) async throws -> [PacienteEntidade] {
    try await todos().filter { identifiers.contains($0.id) }
  }

  func entities(matching texto: String) async throws -> [PacienteEntidade] {
    try await todos().filter { $0.nome.range(of: texto, options: [.caseInsensitive, .diacriticInsensitive]) != nil }
  }

  func suggestedEntities() async throws -> [PacienteEntidade] {
    try await todos()
  }

  @MainActor
  private func todos() async throws -> [PacienteEntidade] {
    try await conexao.garantirConexao()
    return try await conexao.operacao("patients:list").decodificar([Paciente].self)
      .map { PacienteEntidade(id: $0.id, nome: $0.nome) }
  }
}

struct EtiquetaEntidade: AppEntity {
  static let typeDisplayRepresentation = TypeDisplayRepresentation(name: "Etiqueta")
  static let defaultQuery = EtiquetasDaClinica()

  let id: Int
  let nome: String
  let duracao: Int

  var displayRepresentation: DisplayRepresentation {
    DisplayRepresentation(title: "\(nome)", subtitle: "\(duracao) min")
  }
}

struct EtiquetasDaClinica: EntityQuery {
  @Dependency private var conexao: Conexao

  func entities(for identifiers: [Int]) async throws -> [EtiquetaEntidade] {
    try await todas().filter { identifiers.contains($0.id) }
  }

  func suggestedEntities() async throws -> [EtiquetaEntidade] {
    try await todas()
  }

  @MainActor
  private func todas() async throws -> [EtiquetaEntidade] {
    try await conexao.garantirConexao()
    return try await conexao.operacao("tipos:list").decodificar([Etiqueta].self)
      .filter { $0.categoria != "compromisso" }
      .map { EtiquetaEntidade(id: $0.id, nome: $0.nome, duracao: $0.duracao) }
  }
}

struct MarcarSessao: AppIntent {
  static let title: LocalizedStringResource = "Marcar sessão"
  static let description = IntentDescription("Marca uma sessão na agenda da clínica.")
  static let authenticationPolicy: IntentAuthenticationPolicy = .requiresLocalDeviceAuthentication

  @Parameter(title: "Paciente", requestValueDialog: "Para qual paciente?")
  var paciente: PacienteEntidade

  @Parameter(title: "Início", requestValueDialog: "Em que dia e hora?")
  var inicio: Date

  @Parameter(title: "Etiqueta")
  var etiqueta: EtiquetaEntidade?

  @Parameter(title: "Duração em minutos", inclusiveRange: (15, 240))
  var minutos: Int?

  @Dependency private var agenda: Agenda

  static var parameterSummary: some ParameterSummary {
    Summary("Marcar sessão de \(\.$paciente) em \(\.$inicio)") {
      \.$etiqueta
      \.$minutos
    }
  }

  @MainActor
  func perform() async throws -> some IntentResult & ProvidesDialog {
    try await agenda.marcar(
      paciente: paciente.id,
      inicio: inicio,
      minutos: minutos ?? etiqueta?.duracao ?? 45,
      etiqueta: etiqueta?.id,
      observacao: ""
    )
    let quando = inicio.formatado(.dateTime.weekday(.wide).day().month(.wide).hour().minute())
    return .result(dialog: "Sessão de \(Resumo.nomeCurto(paciente.nome)) marcada para \(quando).")
  }
}

struct AtalhosDoAuri: AppShortcutsProvider {
  static var appShortcuts: [AppShortcut] {
    AppShortcut(
      intent: MarcarSessao(),
      phrases: [
        "Marcar sessão no \(.applicationName)",
        "Nova sessão no \(.applicationName)",
        "Agendar no \(.applicationName)"
      ],
      shortTitle: "Marcar sessão",
      systemImageName: "calendar.badge.plus"
    )
  }
}

extension ErroDoAuri: CustomLocalizedStringResourceConvertible {
  var localizedStringResource: LocalizedStringResource { "\(mensagem)" }
}
