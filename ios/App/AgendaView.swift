import SwiftUI

enum RotaDaAgenda: Hashable {
  case mes(Date)
  case dia(Date)
  case evento(Evento)
  case paciente(Int)
}

struct AgendaView: View {
  let conexao: Conexao
  let agenda: Agenda
  let cadastro: Cadastro
  let destino: Destino

  @State private var caminho: [RotaDaAgenda] = [.mes(DataLocal.inicioDoMes(.now))]
  @State private var novaSessao: NovaSessao?
  @State private var buscando = false

  var body: some View {
    NavigationStack(path: $caminho) {
      AnoView(agenda: agenda, ano: DataLocal.inicioDoMes(.now)) { mes in
        caminho = [.mes(mes)]
      }
      .navigationDestination(for: RotaDaAgenda.self) { rota in
        switch rota {
        case .mes(let mes):
          MesView(agenda: agenda, inicial: mes) { caminho.append(.dia($0)) }
            .toolbar { acoes(dia: nil) }
        case .dia(let dia):
          DiaView(agenda: agenda, inicial: dia) { caminho.append(.evento($0)) }
            .toolbar { acoes(dia: dia) }
        case .evento(let evento):
          EventoView(evento: evento) { caminho.append(.paciente($0)) }
        case .paciente(let id):
          PacienteView(conexao: conexao, id: id) { novaSessao = NovaSessao(paciente: $0) }
        }
      }
    }
    .sheet(item: $novaSessao) { nova in
      NovaSessaoView(agenda: agenda, cadastro: cadastro, nova: nova)
    }
    .sheet(isPresented: $buscando) {
      BuscaDaAgendaView(agenda: agenda) { evento in
        buscando = false
        caminho.append(.evento(evento))
      }
    }
    .task(id: [conexao.conectado ? 1 : 0, conexao.mudancas]) {
      guard conexao.conectado else { return }
      await agenda.carregar()
    }
    .onChange(of: destino.data, initial: true) { _, data in
      guard let data else { return }
      caminho = [.mes(DataLocal.inicioDoMes(data)), .dia(data)]
      destino.data = nil
    }
  }

  @ToolbarContentBuilder
  private func acoes(dia: Date?) -> some ToolbarContent {
    ToolbarItemGroup(placement: .topBarTrailing) {
      Button {
        buscando = true
      } label: {
        Image(systemName: "magnifyingglass")
      }
      .accessibilityLabel("Buscar sessões")
      Button {
        novaSessao = NovaSessao(dia: dia)
      } label: {
        Image(systemName: "plus")
      }
      .accessibilityLabel("Marcar sessão")
    }
  }
}

struct NovaSessao: Identifiable {
  let id = UUID()
  var paciente: Paciente?
  var dia: Date?
}
