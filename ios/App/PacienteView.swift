import SwiftUI

struct PacienteView: View {
  let conexao: Conexao
  let id: Int
  let marcar: (Paciente) -> Void

  @Environment(\.openURL) private var openURL
  @State private var paciente: Paciente?
  @State private var erro: String?

  var body: some View {
    Group {
      if let paciente {
        ficha(paciente)
      } else if let erro {
        ContentUnavailableView("Ficha indisponível", systemImage: "person.crop.circle.badge.exclamationmark", description: Text(erro))
      } else {
        ProgressView()
      }
    }
    .navigationBarTitleDisplayMode(.inline)
    .toolbar {
      ToolbarItem(placement: .topBarTrailing) {
        Button {
          if let paciente { marcar(paciente) }
        } label: {
          Image(systemName: "calendar.badge.plus")
        }
        .accessibilityLabel("Marcar sessão")
        .disabled(paciente == nil)
      }
    }
    .task {
      do {
        paciente = try await conexao.operacao("patients:get", [.numero(Double(id))]).decodificar(Paciente.self)
      } catch {
        erro = error.localizedDescription
      }
    }
  }

  private func ficha(_ paciente: Paciente) -> some View {
    let nascimento = paciente.dataNascimento.flatMap(DataLocal.dia)
    let telefone = paciente.telefone
    return List {
      Section {
        VStack(spacing: 12) {
          Avatar(nome: paciente.nome, tamanho: 96)
          Text(paciente.nome)
            .font(.title.bold())
            .multilineTextAlignment(.center)
          if let nascimento {
            let anos = DataLocal.idade(nascimento)
            Text(anos == 1 ? "1 ano" : "\(anos) anos")
              .foregroundStyle(.secondary)
          }
          HStack(spacing: 10) {
            AcaoRapida(titulo: "mensagem", simbolo: "message.fill", ativa: telefone != nil) {
              abrir("sms", telefone)
            }
            AcaoRapida(titulo: "ligar", simbolo: "phone.fill", ativa: telefone != nil) {
              abrir("tel", telefone)
            }
            AcaoRapida(titulo: "agendar", simbolo: "calendar.badge.plus", ativa: true) {
              marcar(paciente)
            }
          }
          .padding(.top, 4)
        }
        .frame(maxWidth: .infinity)
        .listRowBackground(Color.clear)
        .listRowInsets(EdgeInsets())
      }

      Section {
        if let telefone {
          Campo(rotulo: "celular", valor: telefone, destaque: true)
            .onTapGesture { abrir("tel", telefone) }
        }
        if let responsavel = paciente.responsavel, !responsavel.nome.isEmpty {
          Campo(rotulo: "responsável", valor: responsavel.nome)
        }
        if let nascimento {
          Campo(rotulo: "nascimento", valor: nascimento.formatado(.dateTime.day().month(.wide).year()))
        }
        if let escola = paciente.escola, !escola.isEmpty {
          Campo(rotulo: "escola", valor: escola)
        }
      }

      Section {
        NavigationLink("Sessões") { SessoesDoPacienteView(conexao: conexao, paciente: paciente) }
        NavigationLink("Anamnese") { AnamneseView(conexao: conexao, paciente: paciente) }
        NavigationLink("Evoluções") { EvolucoesView(conexao: conexao, paciente: paciente) }
      }
    }
    .listStyle(.insetGrouped)
  }

  private func abrir(_ esquema: String, _ telefone: String?) {
    guard let telefone else { return }
    let digitos = telefone.filter(\.isNumber)
    if let url = URL(string: "\(esquema):\(digitos)") { openURL(url) }
  }
}

private struct AcaoRapida: View {
  let titulo: String
  let simbolo: String
  let ativa: Bool
  let acao: () -> Void

  var body: some View {
    Button(action: acao) {
      VStack(spacing: 4) {
        Image(systemName: simbolo)
          .font(.title3)
          .frame(height: 26)
        Text(titulo)
          .font(.caption)
      }
      .frame(maxWidth: .infinity, minHeight: 56)
      .background(Color(.secondarySystemGroupedBackground), in: .rect(cornerRadius: 12))
    }
    .buttonStyle(.plain)
    .foregroundStyle(ativa ? Color.accentColor : Color.secondary)
    .disabled(!ativa)
  }
}

private struct Campo: View {
  let rotulo: String
  let valor: String
  var destaque = false

  var body: some View {
    VStack(alignment: .leading, spacing: 2) {
      Text(rotulo)
        .font(.subheadline)
      Text(valor)
        .foregroundStyle(destaque ? Color.accentColor : Color.primary)
    }
    .padding(.vertical, 2)
    .accessibilityElement(children: .combine)
  }
}

struct SessoesDoPacienteView: View {
  let conexao: Conexao
  let paciente: Paciente

  @State private var sessoes: [Sessao]?
  @State private var erro: String?

  var body: some View {
    let agora = Date.now
    let lista = (sessoes ?? []).compactMap { sessao in DataLocal.data(sessao.inicio).map { (sessao, $0) } }
    let proximas = lista.filter { $0.1 >= agora }.sorted { $0.1 < $1.1 }
    let anteriores = lista.filter { $0.1 < agora }.sorted { $0.1 > $1.1 }
    List {
      if !proximas.isEmpty {
        Section("Próximas") { ForEach(proximas, id: \.0.id) { LinhaDaSessao(sessao: $0.0, inicio: $0.1) } }
      }
      if !anteriores.isEmpty {
        Section("Anteriores") { ForEach(anteriores, id: \.0.id) { LinhaDaSessao(sessao: $0.0, inicio: $0.1) } }
      }
    }
    .overlay {
      if let erro {
        ContentUnavailableView("Sessões indisponíveis", systemImage: "calendar", description: Text(erro))
      } else if sessoes == nil {
        ProgressView()
      } else if lista.isEmpty {
        ContentUnavailableView("Nenhuma sessão", systemImage: "calendar")
      }
    }
    .navigationTitle("Sessões")
    .task {
      do {
        sessoes = try await conexao.operacao("appointments:listByPatient", [.numero(Double(paciente.id))])
          .decodificar([Sessao].self)
      } catch {
        erro = error.localizedDescription
      }
    }
  }
}

private struct LinhaDaSessao: View {
  let sessao: Sessao
  let inicio: Date

  var body: some View {
    HStack(spacing: 10) {
      Circle().fill(Color(hex: sessao.tipoCor)).frame(width: 10, height: 10)
      VStack(alignment: .leading, spacing: 2) {
        Text(inicio.formatado(.dateTime.weekday(.abbreviated).day().month(.abbreviated).year()))
        Text("\(inicio.hora) · \(sessao.tipoNome)")
          .font(.subheadline)
          .foregroundStyle(.secondary)
      }
      Spacer()
      if !sessao.presenca.isEmpty {
        Text(sessao.presenca.capitalized)
          .font(.subheadline)
          .foregroundStyle(.secondary)
      }
    }
    .accessibilityElement(children: .combine)
  }
}

struct AnamneseView: View {
  let conexao: Conexao
  let paciente: Paciente

  @State private var anamnese: Anamnese?
  @State private var erro: String?

  var body: some View {
    let temas = anamnese.map(temasPreenchidos) ?? []
    List {
      if let data = anamnese?.data.flatMap(DataLocal.dia) {
        Section { LabeledContent("Data", value: data.formatado(.dateTime.day().month(.wide).year())) }
      }
      ForEach(temas, id: \.0) { titulo, texto in
        Section(titulo) { Text(texto) }
      }
    }
    .overlay {
      if let erro {
        ContentUnavailableView("Anamnese indisponível", systemImage: "doc.text", description: Text(erro))
      } else if anamnese == nil {
        ProgressView()
      } else if temas.isEmpty {
        ContentUnavailableView("Sem anamnese", systemImage: "doc.text", description: Text("A anamnese é preenchida no computador do consultório."))
      }
    }
    .navigationTitle("Anamnese")
    .task {
      do {
        anamnese = try await conexao.operacao("anamneses:get", [.numero(Double(paciente.id))]).decodificar(Anamnese.self)
      } catch {
        erro = error.localizedDescription
      }
    }
  }

  private func temasPreenchidos(_ a: Anamnese) -> [(String, String)] {
    [
      ("Queixa", a.queixa), ("Gestação e parto", a.gestacao), ("Alimentação", a.alimentacao),
      ("Sono", a.sono), ("Desenvolvimento", a.desenvolvimento), ("Saúde", a.saude),
      ("Rotina", a.rotina), ("Terapias", a.terapias), ("Observações", a.observacoes)
    ].compactMap { titulo, texto in
      guard let texto, !texto.isEmpty else { return nil }
      return (titulo, texto)
    }
  }
}

struct EvolucoesView: View {
  let conexao: Conexao
  let paciente: Paciente

  @State private var sessoes: [Sessao]?
  @State private var erro: String?

  var body: some View {
    let comEvolucao = (sessoes ?? [])
      .compactMap { sessao -> (Sessao, Date, String)? in
        guard let texto = sessao.evolucao, !texto.isEmpty, let inicio = DataLocal.data(sessao.inicio) else { return nil }
        return (sessao, inicio, texto)
      }
      .sorted { $0.1 > $1.1 }
    List {
      ForEach(comEvolucao, id: \.0.id) { _, inicio, texto in
        Section(inicio.formatado(.dateTime.day().month(.wide).year())) { Text(texto) }
      }
    }
    .overlay {
      if let erro {
        ContentUnavailableView("Evoluções indisponíveis", systemImage: "text.document", description: Text(erro))
      } else if sessoes == nil {
        ProgressView()
      } else if comEvolucao.isEmpty {
        ContentUnavailableView("Nenhuma evolução", systemImage: "text.document", description: Text("As evoluções são escritas no computador do consultório."))
      }
    }
    .navigationTitle("Evoluções")
    .task {
      do {
        sessoes = try await conexao.operacao("appointments:listByPatient", [.numero(Double(paciente.id))])
          .decodificar([Sessao].self)
      } catch {
        erro = error.localizedDescription
      }
    }
  }
}
