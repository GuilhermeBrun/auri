import SwiftUI

@MainActor
@Observable
final class Cadastro {
  private let conexao: Conexao
  private(set) var pacientes: [Paciente]?
  private(set) var erro: String?

  init(conexao: Conexao) {
    self.conexao = conexao
  }

  func carregar() async {
    do {
      pacientes = try await conexao.operacao("patients:list").decodificar([Paciente].self)
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
      if let pacientes = cadastro.pacientes {
        ListaDePacientes(pacientes: pacientes, busca: busca) { paciente in
          NavigationLink(value: paciente.id) { LinhaDoPaciente(paciente: paciente) }
        }
      } else if let erro = cadastro.erro {
        ContentUnavailableView {
          Label("Sem pacientes", systemImage: "exclamationmark.triangle")
        } description: {
          Text(erro)
        } actions: {
          Button("Tentar de novo") { Task { await cadastro.carregar() } }
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
    let encontrados = filtrar(pacientes)
    if pacientes.isEmpty {
      ContentUnavailableView(
        "Nenhum paciente",
        systemImage: "person.crop.circle",
        description: Text("Os pacientes cadastrados no computador aparecem aqui.")
      )
    } else if encontrados.isEmpty {
      ContentUnavailableView.search(text: busca)
    } else {
      List {
        ForEach(secoes(encontrados), id: \.letra) { secao in
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

  private func filtrar(_ lista: [Paciente]) -> [Paciente] {
    let termo = busca.trimmingCharacters(in: .whitespaces)
    guard !termo.isEmpty else { return lista }
    return lista.filter { $0.nome.range(of: termo, options: [.caseInsensitive, .diacriticInsensitive]) != nil }
  }

  private func secoes(_ lista: [Paciente]) -> [(letra: String, pacientes: [Paciente])] {
    let porLetra = Dictionary(grouping: lista) { paciente in
      let primeira = paciente.nome
        .folding(options: [.diacriticInsensitive, .caseInsensitive], locale: Locale(identifier: "pt_BR"))
        .uppercased()
        .first
      return primeira.map { $0.isLetter ? String($0) : "#" } ?? "#"
    }
    return porLetra.keys.sorted { a, b in a == "#" ? false : b == "#" ? true : a < b }.map { letra in
      (letra, porLetra[letra]!.sorted {
        $0.nome.compare($1.nome, options: [.caseInsensitive, .diacriticInsensitive], locale: Locale(identifier: "pt_BR")) == .orderedAscending
      })
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
    Text(iniciais)
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

  private var iniciais: String {
    let partes = nome.split(separator: " ").filter { $0.count > 2 || $0 == $0.uppercased() }
    let letras = [partes.first, partes.count > 1 ? partes.last : nil].compactMap { $0?.first }
    return String(letras).uppercased()
  }
}
