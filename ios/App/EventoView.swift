import SwiftUI

struct EventoView: View {
  let evento: Evento
  let abrirPaciente: (Int) -> Void

  var body: some View {
    List {
      Section {
        VStack(alignment: .leading, spacing: 6) {
          Text(evento.titulo)
            .font(.title2.bold())
          Text(evento.inicio.formatado(.dateTime.weekday(.wide).day().month(.wide).year()))
            .foregroundStyle(.secondary)
          Text("das \(evento.inicio.hora) às \(evento.fim.hora)")
            .foregroundStyle(.secondary)
        }
        .padding(.vertical, 4)
      }

      switch evento.origem {
      case .sessao(let sessao):
        Section {
          LabeledContent("Etiqueta") {
            HStack(spacing: 6) {
              Circle().fill(Color(hex: sessao.tipoCor)).frame(width: 10, height: 10)
              Text(sessao.tipoNome)
            }
          }
          LabeledContent("Presença", value: presenca(sessao.presenca))
          if let confirmado = sessao.confirmadoEm.flatMap(DataLocal.data) {
            LabeledContent(
              "Confirmada", value: confirmado.formatado(.dateTime.day().month(.abbreviated).hour().minute()))
          }
        }
        if let observacao = sessao.observacao, !observacao.isEmpty {
          Section("Observação") { Text(observacao) }
        }
        if let evolucao = sessao.evolucao, !evolucao.isEmpty {
          Section("Evolução") { Text(evolucao) }
        }
        Section {
          Button("Ver ficha de \(sessao.patientNome)") { abrirPaciente(sessao.patientId) }
        }
      case .compromisso(let compromisso):
        Section {
          LabeledContent("Etiqueta") {
            HStack(spacing: 6) {
              Circle().fill(Color(hex: compromisso.cor)).frame(width: 10, height: 10)
              Text(compromisso.etiquetaNome)
            }
          }
        }
        if let observacao = compromisso.observacao, !observacao.isEmpty {
          Section("Observação") { Text(observacao) }
        }
      }
    }
    .navigationTitle(evento.inicio.formatado(.dateTime.day().month(.abbreviated)))
    .navigationBarTitleDisplayMode(.inline)
  }

  private func presenca(_ valor: String) -> String {
    switch valor {
    case "presente": return "Presente"
    case "falta": return "Falta"
    case "desmarcou": return "Desmarcou"
    default: return "Ainda não registrada"
    }
  }
}

struct BuscaDaAgendaView: View {
  let agenda: Agenda
  let abrir: (Evento) -> Void

  @Environment(\.dismiss) private var dismiss
  @State private var busca = ""

  var body: some View {
    NavigationStack {
      let encontrados = filtrados
      let dias = Dictionary(grouping: encontrados) { DataLocal.inicioDoDia($0.inicio) }.sorted { $0.key < $1.key }
      List {
        ForEach(dias, id: \.key) { dia, eventos in
          Section(dia.formatado(.dateTime.weekday(.wide).day().month(.wide).year())) {
            ForEach(eventos) { evento in
              Button {
                abrir(evento)
              } label: {
                HStack(spacing: 10) {
                  Circle().fill(Color(hex: evento.cor)).frame(width: 10, height: 10)
                  Text(evento.titulo).foregroundStyle(.primary)
                  Spacer()
                  Text(evento.inicio.hora).foregroundStyle(.secondary)
                }
              }
            }
          }
        }
      }
      .overlay {
        if encontrados.isEmpty && !busca.isEmpty { ContentUnavailableView.search(text: busca) }
      }
      .searchable(text: $busca, placement: .navigationBarDrawer(displayMode: .always), prompt: "Buscar")
      .navigationTitle(busca.isEmpty ? "Próximas" : "Buscar")
      .navigationBarTitleDisplayMode(.inline)
      .toolbar {
        ToolbarItem(placement: .topBarLeading) {
          Button(role: .close) { dismiss() }
        }
      }
    }
  }

  private var filtrados: [Evento] {
    let termo = busca.trimmingCharacters(in: .whitespaces)
    if termo.isEmpty {
      let hoje = DataLocal.inicioDoDia(.now)
      return Array(agenda.todos.filter { $0.inicio >= hoje }.prefix(60))
    }
    return agenda.todos.filter {
      $0.titulo.range(of: termo, options: [.caseInsensitive, .diacriticInsensitive]) != nil
    }
  }
}
