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

  @State private var caminho: [RotaDaAgenda] = [
    .mes(DataLocal.inicioDoMes(.now)), .dia(DataLocal.inicioDoDia(.now)),
  ]
  @State private var novaSessao: NovaSessao?
  @State private var buscando = false
  @State private var diaNaTela: Date?
  @State private var atendido = 0

  var body: some View {
    NavigationStack(path: $caminho) {
      AnoView(agenda: agenda, ano: DataLocal.inicioDoMes(.now)) { mes in
        caminho = [.mes(mes)]
      }
      .navigationDestination(for: RotaDaAgenda.self) { rota in
        switch rota {
        case .mes(let mes):
          MesView(agenda: agenda, inicial: mes) { caminho.append(.dia($0)) }
            .id(mes)
            .toolbar { acoes(dia: nil) }
        case .dia(let dia):
          DiaView(
            agenda: agenda, nascimentos: cadastro.nascimentos, inicial: dia, aoMostrar: { diaNaTela = $0 }
          ) { caminho.append(.evento($0)) }
          .id(dia)
          .toolbar { acoes(dia: diaNaTela ?? dia) }
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
    .onChange(of: destino.pedido, initial: true) { _, pedido in
      guard pedido > atendido, let data = destino.data else { return }
      atendido = pedido
      caminho = [.mes(DataLocal.inicioDoMes(data)), .dia(data)]
    }
  }

  @ToolbarContentBuilder
  private func acoes(dia: Date?) -> some ToolbarContent {
    ToolbarItemGroup(placement: .topBarTrailing) {
      if !agenda.etiquetasDeSessao.isEmpty {
        Menu {
          ForEach(agenda.etiquetasDeSessao) { etiqueta in
            Toggle(
              isOn: Binding(
                get: { !agenda.ocultas.contains(etiqueta.id) },
                set: { mostrar in
                  if mostrar { agenda.ocultas.remove(etiqueta.id) } else { agenda.ocultas.insert(etiqueta.id) }
                })
            ) {
              Label {
                Text(etiqueta.nome)
              } icon: {
                Image(uiImage: NovaSessaoView.ponto(etiqueta.cor))
              }
            }
          }
          if !agenda.ocultas.isEmpty {
            Button("Mostrar todas") { agenda.ocultas = [] }
          }
        } label: {
          Image(
            systemName: agenda.ocultas.isEmpty
              ? "line.3.horizontal.decrease.circle" : "line.3.horizontal.decrease.circle.fill")
        }
        .accessibilityLabel(agenda.ocultas.isEmpty ? "Etiquetas" : "Etiquetas, com filtro")
      }
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
