import SwiftUI

struct PrincipalView: View {
  let conexao: Conexao
  let agenda: Agenda
  let cadastro: Cadastro
  let destino: Destino
  let avisos: Avisos
  let bloqueio: Bloqueio

  @State private var aba = Aba.agenda
  @State private var novaSessao: NovaSessao?

  enum Aba: Hashable {
    case agenda
    case pacientes
    case conexao
  }

  var body: some View {
    TabView(selection: $aba) {
      Tab("Agenda", image: "agenda", value: Aba.agenda) {
        AgendaView(conexao: conexao, agenda: agenda, cadastro: cadastro, destino: destino)
      }
      Tab("Pacientes", image: "pacientes", value: Aba.pacientes) {
        NavigationStack {
          PacientesView(conexao: conexao, cadastro: cadastro) { novaSessao = NovaSessao(paciente: $0) }
        }
      }
      Tab("Conexão", image: "conexao", value: Aba.conexao) {
        NavigationStack {
          ConexaoView(conexao: conexao, agenda: agenda, avisos: avisos, bloqueio: bloqueio)
        }
      }
    }
    .onChange(of: destino.data, initial: true) { _, data in
      if data != nil { aba = .agenda }
    }
    .task { await avisos.pedirSeNecessario() }
    .sheet(item: $novaSessao) { nova in
      NovaSessaoView(agenda: agenda, cadastro: cadastro, nova: nova)
    }
    .task(id: [conexao.conectado ? 1 : 0, conexao.mudancas]) {
      guard conexao.conectado else { return }
      await cadastro.carregar()
    }
  }
}
