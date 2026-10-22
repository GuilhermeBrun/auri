import AppIntents
import SwiftUI

@main
struct AuriApp: App {
  @State private var conexao: Conexao
  @State private var agenda: Agenda
  @State private var cadastro: Cadastro
  @State private var destino: Destino
  @State private var avisos: Avisos
  @State private var bloqueio = Bloqueio()
  @State private var protecao = Protecao()
  @Environment(\.scenePhase) private var fase

  init() {
    UIDatePicker.appearance().minuteInterval = 5
    let conexao = Conexao()
    let agenda = Agenda(conexao: conexao)
    let destino = Destino()
    _conexao = State(initialValue: conexao)
    _agenda = State(initialValue: agenda)
    _cadastro = State(initialValue: Cadastro(conexao: conexao))
    _destino = State(initialValue: destino)
    _avisos = State(initialValue: Avisos(destino: destino))
    AppDependencyManager.shared.add(dependency: conexao)
    AppDependencyManager.shared.add(dependency: agenda)
  }

  private var estadoDaProtecao: Protecao.Estado {
    guard conexao.servidor != nil else { return .nenhuma }
    if bloqueio.bloqueado { return .bloqueio }
    return fase == .active ? .nenhuma : .capa
  }

  var body: some Scene {
    WindowGroup {
      Group {
        if conexao.servidor == nil {
          BoasVindasView(conexao: conexao)
        } else {
          PrincipalView(
            conexao: conexao,
            agenda: agenda,
            cadastro: cadastro,
            destino: destino,
            avisos: avisos,
            bloqueio: bloqueio
          )
        }
      }
      .onChange(of: estadoDaProtecao, initial: true) { _, estado in
        protecao.aplicar(estado, bloqueio: bloqueio)
      }
      .onAppear {
        conexao.aoAvisar = { avisos.publicar($0) }
        conexao.iniciar()
        if conexao.servidor != nil { bloqueio.abrir() }
        if AbrirNovaSessao.pedida() { destino.novaSessao = true }
      }
      .onOpenURL { url in
        guard url.scheme == "auri" else { return }
        switch url.host {
        case "agenda":
          let texto = URLComponents(url: url, resolvingAgainstBaseURL: false)?
            .queryItems?.first { $0.name == "data" }?.value
          destino.data = texto.flatMap(DataLocal.data) ?? .now
        case "nova-sessao":
          destino.novaSessao = true
        default:
          break
        }
      }
      .onChange(of: conexao.servidor == nil) { _, semServidor in
        if semServidor { agenda.esquecer() }
      }
    }
    .onChange(of: fase) { _, nova in
      switch nova {
      case .background:
        conexao.suspender()
        bloqueio.saiu()
        if conexao.servidor != nil { Agenda.agendarAtualizacao() }
      case .active:
        conexao.retomar()
        bloqueio.voltou()
        if AbrirNovaSessao.pedida() { destino.novaSessao = true }
        Task { await avisos.atualizar() }
      default: break
      }
    }
    .backgroundTask(.appRefresh(Resumo.tarefa)) { [agenda] in
      await agenda.atualizarEmSegundoPlano()
    }
  }
}
