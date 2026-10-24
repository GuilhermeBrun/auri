import SwiftUI

@MainActor
@Observable
final class Cadastro {
  private let conexao: Conexao
  private(set) var pacientes: [Paciente]?
  private(set) var nascimentos: [Int: String] = [:]
  private(set) var erro: String?

  init(conexao: Conexao) {
    self.conexao = conexao
  }

  func carregar() async {
    do {
      let lista = try await conexao.operacao("patients:list").decodificar([Paciente].self)
      pacientes = lista
      nascimentos = Dictionary(lista.compactMap { p in p.dataNascimento.map { (p.id, $0) } }) { a, _ in a }
      erro = nil
    } catch {
      erro = error.localizedDescription
    }
  }
}

struct PacientesView: View {
  let conexao: Conexao
  let cadastro: Cadastro
  let marcar: (Paciente?) -> Void

  @State private var busca = ""

  var body: some View {
    Group {
      if let pacientes = cadastro.pacientes, pacientes.isEmpty {
        ContentUnavailableView {
          Label("Nenhum paciente", systemImage: "person.crop.circle.fill")
        } description: {
          Text("Os pacientes cadastrados no computador da clínica aparecem aqui.")
            .fixedSize(horizontal: false, vertical: true)
        } actions: {
          Button {
            Task { await cadastro.carregar() }
          } label: {
            Text("Atualizar").frame(minHeight: 44).contentShape(.rect)
          }
        }
      } else if let pacientes = cadastro.pacientes {
        ListaDePacientes(pacientes: pacientes, busca: busca) { paciente in
          NavigationLink(value: paciente.id) { LinhaDoPaciente(paciente: paciente) }
        }
      } else if let erro = cadastro.erro {
        ContentUnavailableView {
          Label("Sem pacientes", systemImage: "exclamationmark.triangle")
        } description: {
          Text(erro)
            .fixedSize(horizontal: false, vertical: true)
        } actions: {
          Button {
            Task { await cadastro.carregar() }
          } label: {
            Text("Tentar de novo").frame(minHeight: 44).contentShape(.rect)
          }
        }
      } else {
        ProgressView()
      }
    }
    .navigationTitle("Pacientes")
    .navigationBarTitleDisplayMode(.inline)
    .searchable(text: $busca, placement: .navigationBarDrawer(displayMode: .always), prompt: "Buscar")
    .refreshable { await cadastro.carregar() }
    .navigationDestination(for: Int.self) { id in
      PacienteView(conexao: conexao, id: id) { marcar($0) }
    }
    .toolbar {
      ToolbarItem(placement: .topBarTrailing) {
        Button {
          marcar(nil)
        } label: {
          Image(systemName: "calendar.badge.plus")
        }
        .accessibilityLabel("Marcar sessão")
      }
    }
  }
}

struct ListaDePacientes<Linha: View>: View {
  let pacientes: [Paciente]
  let busca: String
  @ViewBuilder let linha: (Paciente) -> Linha

  var body: some View {
    let encontrados = Paciente.filtrar(pacientes, busca: busca)
    if pacientes.isEmpty {
      Indisponivel(
        "Nenhum paciente", icone: "person.crop.circle",
        descricao: "Os pacientes cadastrados no computador aparecem aqui.")
    } else if encontrados.isEmpty {
      ContentUnavailableView.search(text: busca)
    } else {
      List {
        ForEach(Paciente.secoes(encontrados), id: \.letra) { secao in
          Section {
            ForEach(secao.pacientes) { linha($0) }
          } header: {
            Text(secao.letra)
          }
          .sectionIndexLabel(secao.letra)
        }
        Section {
          Text(encontrados.count == 1 ? "1 paciente" : "\(encontrados.count) pacientes")
            .font(.footnote)
            .foregroundStyle(.secondary)
            .frame(maxWidth: .infinity)
            .listRowSeparator(.hidden)
        }
      }
      .listStyle(.plain)
      .listSectionIndexVisibility(.visible)
    }
  }
}

struct LinhaDoPaciente: View {
  let paciente: Paciente

  var body: some View {
    HStack(spacing: 12) {
      Avatar(nome: paciente.nome, tamanho: 40)
      Text(paciente.nome)
    }
  }
}

struct Avatar: View {
  let nome: String
  let tamanho: CGFloat

  var body: some View {
    Text(Paciente.iniciais(nome))
      .font(.system(size: tamanho * 0.4, weight: .medium, design: .rounded))
      .foregroundStyle(.white)
      .frame(width: tamanho, height: tamanho)
      .background(
        LinearGradient(
          colors: [Color(white: 0.66), Color(white: 0.5)],
          startPoint: .top,
          endPoint: .bottom
        ),
        in: .circle
      )
      .accessibilityHidden(true)
  }

}

struct Indisponivel: View {
  let titulo: String
  let icone: String
  let descricao: String

  init(_ titulo: String, icone: String, descricao: String) {
    self.titulo = titulo
    self.icone = icone
    self.descricao = descricao
  }

  var body: some View {
    ContentUnavailableView {
      Label(titulo, systemImage: icone)
    } description: {
      Text(descricao)
        .fixedSize(horizontal: false, vertical: true)
    }
  }
}
