import SwiftUI

struct NovaSessaoView: View {
  let agenda: Agenda
  let cadastro: Cadastro

  @Environment(\.dismiss) private var dismiss
  @State private var paciente: Paciente?
  @State private var inicio: Date
  @State private var etiqueta: Int?
  @State private var minutos = 45
  @State private var observacao = ""
  @State private var salvando = false
  @State private var erro: String?
  @State private var descartando = false

  private static let duracoes = [15, 20, 30, 40, 45, 50, 60, 75, 90, 120]

  init(agenda: Agenda, cadastro: Cadastro, nova: NovaSessao) {
    self.agenda = agenda
    self.cadastro = cadastro
    _paciente = State(initialValue: nova.paciente)
    _inicio = State(initialValue: Self.horarioSugerido(nova.dia, clinica: agenda.clinica))
  }

  var body: some View {
    NavigationStack {
      Form {
        Section {
          NavigationLink {
            EscolherPacienteView(cadastro: cadastro, escolhido: $paciente)
          } label: {
            LabeledContent("Paciente", value: paciente?.nome ?? "Escolher")
          }
        }

        Section {
          Menu {
            Picker("Etiqueta", selection: $etiqueta) {
              ForEach(gruposDeEtiquetas, id: \.titulo) { grupo in
                Section(grupo.titulo) {
                  ForEach(grupo.etiquetas) { item in
                    Label {
                      Text(item.nome)
                    } icon: {
                      Image(uiImage: Self.ponto(item.cor))
                    }
                    .tag(Optional(item.id))
                  }
                }
              }
            }
          } label: {
            HStack(spacing: 6) {
              Text("Etiqueta")
                .foregroundStyle(.primary)
              Spacer()
              if let escolhida {
                Circle().fill(Color(hex: escolhida.cor)).frame(width: 10, height: 10)
                Text(escolhida.nome)
                  .foregroundStyle(.secondary)
              }
              Image(systemName: "chevron.up.chevron.down")
                .font(.footnote.weight(.semibold))
                .foregroundStyle(.secondary)
            }
            .contentShape(.rect)
          }
          .buttonStyle(.plain)
          .accessibilityLabel("Etiqueta")
          .accessibilityValue(escolhida?.nome ?? "nenhuma")
          DatePicker("Início", selection: $inicio)
          Picker("Duração", selection: $minutos) {
            ForEach(Self.duracoes, id: \.self) { Text("\($0) min").tag($0) }
          }
        }

        Section {
          TextField("Observação", text: $observacao, axis: .vertical)
            .lineLimit(2...6)
        }

        if let erro {
          Section {
            Text(erro).foregroundStyle(.red)
          }
        }
      }
      .navigationTitle("Nova sessão")
      .navigationBarTitleDisplayMode(.inline)
      .interactiveDismissDisabled(paciente != nil)
      .toolbar {
        ToolbarItem(placement: .cancellationAction) {
          Button(role: .cancel) {
            if paciente != nil { descartando = true } else { dismiss() }
          }
          .confirmationDialog("Descartar esta sessão?", isPresented: $descartando) {
            Button("Descartar", role: .destructive) { dismiss() }
          }
        }
        ToolbarItem(placement: .confirmationAction) {
          Button(role: .confirm) {
            salvar()
          } label: {
            if salvando { ProgressView() } else { Text("Marcar") }
          }
          .disabled(paciente == nil || salvando)
        }
      }
      .onChange(of: etiqueta) { _, nova in
        if let duracao = agenda.etiquetas.first(where: { $0.id == nova })?.duracao { minutos = duracao }
      }
      .task {
        if agenda.etiquetas.isEmpty { await agenda.carregar() }
        if cadastro.pacientes == nil { await cadastro.carregar() }
        if etiqueta == nil { etiqueta = agenda.etiquetasDeSessao.first?.id }
      }
    }
  }

  private var escolhida: Etiqueta? {
    agenda.etiquetas.first { $0.id == etiqueta }
  }

  private var gruposDeEtiquetas: [(titulo: String, etiquetas: [Etiqueta])] {
    [("sessao", "Sessões"), ("avaliacao", "Avaliações"), ("exame", "Exames")].compactMap { categoria, titulo in
      let etiquetas = agenda.etiquetasDeSessao.filter { $0.categoria == categoria }
      return etiquetas.isEmpty ? nil : (titulo, etiquetas)
    }
  }

  static func ponto(_ cor: String) -> UIImage {
    let imagem = UIImage(systemName: "circle.fill") ?? UIImage()
    return imagem.withTintColor(UIColor(Color(hex: cor)), renderingMode: .alwaysOriginal)
  }

  private func salvar() {
    guard let paciente else { return }
    salvando = true
    erro = nil
    Task {
      do {
        try await agenda.marcar(
          paciente: paciente.id,
          inicio: inicio,
          minutos: minutos,
          etiqueta: etiqueta,
          observacao: observacao.trimmingCharacters(in: .whitespacesAndNewlines)
        )
        dismiss()
      } catch {
        erro = error.localizedDescription
      }
      salvando = false
    }
  }

  static func horarioSugerido(_ dia: Date?, agora: Date = .now, clinica: Clinica? = nil, minutos: Int = 45) -> Date {
    let calendario = DataLocal.calendario
    let base = dia ?? agora
    guard calendario.isDate(base, inSameDayAs: agora) else {
      return calendario.date(bySettingHour: 9, minute: 0, second: 0, of: base) ?? base
    }
    let proxima = calendario.date(byAdding: .hour, value: 1, to: agora) ?? agora
    let cheia =
      calendario.date(bySettingHour: calendario.component(.hour, from: proxima), minute: 0, second: 0, of: proxima)
      ?? proxima
    guard let clinica else { return cheia }
    let comeco = calendario.component(.hour, from: cheia) * 60
    if calendario.isDate(cheia, inSameDayAs: agora), let horario = clinica.horario(em: agora) {
      if comeco < horario.abre {
        return DataLocal.inicioDoDia(agora).addingTimeInterval(TimeInterval(horario.abre * 60))
      }
      if comeco + minutos <= horario.fecha { return cheia }
    }
    for dias in 1...7 {
      let outro = DataLocal.somar(.day, dias, a: DataLocal.inicioDoDia(agora))
      if let horario = clinica.horario(em: outro) { return outro.addingTimeInterval(TimeInterval(horario.abre * 60)) }
    }
    return cheia
  }
}

private struct EscolherPacienteView: View {
  let cadastro: Cadastro
  @Binding var escolhido: Paciente?

  @Environment(\.dismiss) private var dismiss
  @State private var busca = ""

  var body: some View {
    Group {
      if let pacientes = cadastro.pacientes {
        ListaDePacientes(pacientes: pacientes, busca: busca) { paciente in
          Button {
            escolhido = paciente
            dismiss()
          } label: {
            HStack {
              LinhaDoPaciente(paciente: paciente)
              Spacer()
              if escolhido?.id == paciente.id {
                Image(systemName: "checkmark").foregroundStyle(.tint)
              }
            }
          }
          .foregroundStyle(.primary)
        }
      } else {
        ProgressView()
      }
    }
    .navigationTitle("Paciente")
    .navigationBarTitleDisplayMode(.inline)
    .searchable(text: $busca, placement: .navigationBarDrawer(displayMode: .always), prompt: "Buscar")
  }
}
