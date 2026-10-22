import SwiftUI

struct Paciente: Decodable, Identifiable {
  let id: Int
  let nome: String
}

struct PacientesView: View {
  let conexao: Conexao

  @State private var pacientes: [Paciente]?
  @State private var erro: String?
  @State private var busca = ""

  var body: some View {
    Group {
      if let pacientes {
        let encontrados = filtrar(pacientes)
        if pacientes.isEmpty {
          ContentUnavailableView(
            "Nenhum paciente",
            systemImage: "person.2",
            description: Text("Os pacientes cadastrados no computador aparecem aqui.")
          )
        } else if encontrados.isEmpty {
          ContentUnavailableView.search(text: busca)
        } else {
          List(encontrados) { paciente in
            Text(paciente.nome)
          }
        }
      } else if let erro {
        ContentUnavailableView {
          Label("Sem pacientes", systemImage: "exclamationmark.triangle")
        } description: {
          Text(erro)
        } actions: {
          Button("Tentar de novo") { Task { await carregar() } }
        }
      } else {
        ProgressView("Buscando pacientes no computador…")
      }
    }
    .searchable(text: $busca, prompt: "Buscar pacientes")
    .refreshable { await carregar() }
    .task(id: [conexao.conectado ? 1 : 0, conexao.mudancas]) {
      guard conexao.conectado else { return }
      await carregar()
    }
  }

  private func carregar() async {
    do {
      pacientes = try await conexao.operacao("patients:list").decodificar([Paciente].self)
      erro = nil
    } catch {
      if pacientes == nil { erro = error.localizedDescription }
    }
  }

  private func filtrar(_ lista: [Paciente]) -> [Paciente] {
    let termo = busca.trimmingCharacters(in: .whitespaces)
    guard !termo.isEmpty else { return lista }
    return lista.filter {
      $0.nome.range(of: termo, options: [.caseInsensitive, .diacriticInsensitive]) != nil
    }
  }
}
