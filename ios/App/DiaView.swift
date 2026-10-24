import SwiftUI

struct DiaView: View {
  let agenda: Agenda
  let nascimentos: [Int: String]
  let abrirEvento: (Evento) -> Void

  @State private var dia: Date
  @State private var erroAoMover: String?
  @State private var arrastado: Evento?
  @State private var alvosSobre = 0
  @State private var ultimoSinal = Date.distantPast
  @Environment(\.dynamicTypeSize) private var tamanhoDoTexto
  private let foco: Int?

  init(agenda: Agenda, nascimentos: [Int: String], inicial: Date, abrirEvento: @escaping (Evento) -> Void) {
    self.agenda = agenda
    self.nascimentos = nascimentos
    self.abrirEvento = abrirEvento
    _dia = State(initialValue: DataLocal.inicioDoDia(inicial))
    let hora = DataLocal.calendario.component(.hour, from: inicial)
    foco = hora > 0 ? hora : nil
  }

  var body: some View {
    VStack(spacing: 0) {
      FaixaDaSemana(
        dia: $dia, sinal: sinalizar,
        soltar: { outro in
          if let arrastado { soltar(arrastado.id, noDia: outro) }
        })
      Text(dia.formatado(.dateTime.weekday(.wide).day().month(.wide).year()))
        .font(.footnote.weight(.semibold))
        .padding(.vertical, 8)
        .frame(maxWidth: .infinity)
        .overlay(alignment: .bottom) { Rectangle().fill(.separator).frame(height: 0.5) }
      Group {
        if tamanhoDoTexto.isAccessibilitySize {
          ListaDoDia(dia: dia, eventos: agenda.eventos(em: dia), nascimentos: nascimentos, abrirEvento: abrirEvento)
        } else {
          LinhaDoTempo(
            dia: dia, foco: foco, eventos: agenda.eventos(em: dia), clinica: agenda.clinica,
            nascimentos: nascimentos, arrastado: arrastado, abrirEvento: abrirEvento,
            comecarArraste: { evento in
              arrastado = evento
              ultimoSinal = .now
            },
            sinal: sinalizar, soltar: soltar(_:noHorario:), mover: mover)
        }
      }
      .id(dia)
      .overlay {
        if arrastado != nil {
          HStack {
            outroDia(-1)
            Spacer()
            outroDia(1)
          }
          .transition(.opacity)
        }
      }
      .animation(.snappy, value: arrastado == nil)
      .simultaneousGesture(
        DragGesture(minimumDistance: 40).onEnded { gesto in
          guard abs(gesto.translation.width) > abs(gesto.translation.height) * 2 else { return }
          withAnimation { dia = DataLocal.somar(.day, gesto.translation.width < 0 ? 1 : -1, a: dia) }
        }
      )
    }
    .navigationTitle(dia.formatado(.dateTime.day().month(.abbreviated)))
    .navigationBarTitleDisplayMode(.inline)
    .toolbar {
      ToolbarItem(placement: .principal) { Text("") }
      ToolbarItem(placement: .topBarLeading) {
        Button("Hoje") { withAnimation { dia = DataLocal.inicioDoDia(.now) } }
      }
    }
    .task(id: arrastado?.id) {
      while arrastado != nil, !Task.isCancelled {
        try? await Task.sleep(for: .seconds(1))
        if alvosSobre == 0, Date.now.timeIntervalSince(ultimoSinal) > 3 { arrastado = nil }
      }
    }
    .alert(
      "Não deu para mover a sessão",
      isPresented: Binding(get: { erroAoMover != nil }, set: { if !$0 { erroAoMover = nil } })
    ) {
      Button("OK", role: .cancel) {}
    } message: {
      Text(erroAoMover ?? "")
    }
  }

  private func outroDia(_ dias: Int) -> some View {
    Button {
      withAnimation { dia = DataLocal.somar(.day, dias, a: dia) }
    } label: {
      Image(systemName: dias < 0 ? "chevron.left" : "chevron.right")
        .font(.body.weight(.semibold))
        .frame(width: 34, height: 88)
        .background(.regularMaterial, in: .capsule)
    }
    .buttonStyle(.plain)
    .springLoadingBehavior(.enabled)
    .onDrop(of: [.text], delegate: SoltarNoDia(sinal: sinalizar, soltar: nil))
    .accessibilityLabel(dias < 0 ? "Dia anterior" : "Dia seguinte")
    .padding(.horizontal, 6)
  }

  private func sinalizar(_ dentro: Bool) {
    alvosSobre = max(0, alvosSobre + (dentro ? 1 : -1))
    ultimoSinal = .now
  }

  private func soltar(_ id: String, noHorario minutos: Int) {
    soltar(id) { _ in DataLocal.inicioDoDia(dia).addingTimeInterval(TimeInterval(minutos * 60)) }
  }

  private func soltar(_ id: String, noDia outro: Date) {
    soltar(id) { evento in
      let partes = DataLocal.calendario.dateComponents([.hour, .minute], from: evento.inicio)
      return DataLocal.inicioDoDia(outro).addingTimeInterval(
        TimeInterval(((partes.hour ?? 0) * 60 + (partes.minute ?? 0)) * 60))
    }
  }

  private func soltar(_ id: String, inicio: (Evento) -> Date) {
    arrastado = nil
    alvosSobre = 0
    guard let evento = agenda.evento(id), evento.sessao != nil else { return }
    let novo = inicio(evento)
    guard novo != evento.inicio else { return }
    Task { await mover(evento, para: novo) }
  }

  private func mover(_ evento: Evento, para inicio: Date) async {
    guard let sessao = evento.sessao else { return }
    do {
      try await agenda.mover(sessao, para: inicio)
    } catch {
      erroAoMover = error.localizedDescription
    }
  }
}

private struct ListaDoDia: View {
  let dia: Date
  let eventos: [Evento]
  let nascimentos: [Int: String]
  let abrirEvento: (Evento) -> Void

  var body: some View {
    List(eventos) { evento in
      Button {
        abrirEvento(evento)
      } label: {
        HStack(spacing: 12) {
          RoundedRectangle(cornerRadius: 2).fill(Color(hex: evento.cor)).frame(width: 5)
          VStack(alignment: .leading, spacing: 2) {
            TituloDoEvento(evento: evento, idade: idade(de: evento), comEtiqueta: false)
              .font(.headline)
            Text(evento.sessao == nil ? horario(evento) : "\(evento.etiqueta) · \(horario(evento))")
              .foregroundStyle(.secondary)
          }
        }
      }
      .foregroundStyle(.primary)
      .accessibilityLabel(evento.descricao(idade: idade(de: evento)))
    }
    .overlay {
      if eventos.isEmpty {
        ContentUnavailableView("Nenhuma sessão neste dia", systemImage: "calendar")
      }
    }
  }

  private func horario(_ evento: Evento) -> String {
    "\(evento.inicio.hora) – \(evento.fim.hora)"
  }

  private func idade(de evento: Evento) -> Int? {
    evento.sessao.flatMap { Paciente.idadeQueCompleta(nascimentos[$0.patientId], em: dia) }
  }
}

private struct FaixaDaSemana: View {
  @Binding var dia: Date
  let sinal: (Bool) -> Void
  let soltar: (Date) -> Void

  var body: some View {
    let calendario = DataLocal.calendario
    let recuo = (calendario.component(.weekday, from: dia) - calendario.firstWeekday + 7) % 7
    let inicio = DataLocal.somar(.day, -recuo, a: dia)
    let dias = (0..<7).map { DataLocal.somar(.day, $0, a: inicio) }
    HStack(spacing: 0) {
      ForEach(Array(dias.enumerated()), id: \.offset) { indice, outro in
        let escolhido = calendario.isDate(outro, inSameDayAs: dia)
        let hoje = calendario.isDateInToday(outro)
        Button {
          withAnimation { dia = outro }
        } label: {
          VStack(spacing: 4) {
            Text(calendario.veryShortStandaloneWeekdaySymbols[indice].uppercased())
              .font(.caption2.weight(.semibold))
              .foregroundStyle(indice == 0 || indice == 6 ? .secondary : .primary)
            Text(outro.formatado(.dateTime.day()))
              .font(.title3.weight(escolhido ? .semibold : .regular))
              .foregroundStyle(escolhido ? Color(.systemBackground) : hoje ? Color.red : Color.primary)
              .frame(width: 36, height: 36)
              .background {
                if escolhido { Circle().fill(hoje ? Color.red : Color.primary) }
              }
          }
          .frame(maxWidth: .infinity)
          .contentShape(.rect)
        }
        .buttonStyle(.plain)
        .springLoadingBehavior(.enabled)
        .onDrop(of: [.text], delegate: SoltarNoDia(sinal: sinal, soltar: { soltar(outro) }))
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(outro.formatado(.dateTime.weekday(.wide).day().month(.wide)))
        .accessibilityAddTraits(escolhido ? [.isButton, .isSelected] : .isButton)
      }
    }
    .padding(.vertical, 6)
    .dynamicTypeSize(...DynamicTypeSize.xxxLarge)
    .gesture(
      DragGesture(minimumDistance: 30).onEnded { gesto in
        withAnimation { dia = DataLocal.somar(.day, gesto.translation.width < 0 ? 7 : -7, a: dia) }
      }
    )
  }

}

private struct LinhaDoTempo: View {
  let dia: Date
  let foco: Int?
  let eventos: [Evento]
  let clinica: Clinica?
  let nascimentos: [Int: String]
  let arrastado: Evento?
  let abrirEvento: (Evento) -> Void
  let comecarArraste: (Evento) -> Void
  let sinal: (Bool) -> Void
  let soltar: (String, Int) -> Void
  let mover: (Evento, Date) async -> Void

  @State private var alvo: Int?

  private let alturaDaHora: CGFloat = 60
  private let margem: CGFloat = 56
  private let topo: CGFloat = 8

  var body: some View {
    ScrollViewReader { leitor in
      ScrollView {
        ZStack(alignment: .topLeading) {
          ForEach(Array(faixasFechadas.enumerated()), id: \.offset) { _, faixa in
            Rectangle()
              .fill(Color(.systemGray6))
              .frame(height: CGFloat(faixa.fim - faixa.inicio) / 60 * alturaDaHora)
              .padding(.leading, margem)
              .offset(y: topo + CGFloat(faixa.inicio) / 60 * alturaDaHora)
              .accessibilityHidden(true)
          }
          VStack(spacing: 0) {
            ForEach(0..<24, id: \.self) { hora in
              HStack(alignment: .center, spacing: 8) {
                Text(String(format: "%02d:00", hora))
                  .font(.caption2)
                  .foregroundStyle(.secondary)
                  .frame(width: margem - 8, height: topo * 2, alignment: .trailing)
                  .opacity(pertoDeAgora(hora) ? 0 : 1)
                  .accessibilityHidden(pertoDeAgora(hora))
                Rectangle().fill(.separator).frame(height: 0.5)
              }
              .frame(height: alturaDaHora, alignment: .top)
              .id(hora)
            }
          }
          GeometryReader { espaco in
            let largura = espaco.size.width - margem - 4
            ForEach(eventos.emColunas(), id: \.evento.id) { item in
              bloco(item.evento, largura: largura / CGFloat(item.total) - 2)
                .offset(
                  x: margem + largura / CGFloat(item.total) * CGFloat(item.coluna),
                  y: topo + posicao(de: item.evento.inicio) + 1
                )
            }
            if let alvo, let arrastado {
              LugarDeSoltar(inicio: alvo, duracao: arrastado.fim.timeIntervalSince(arrastado.inicio))
                .frame(width: largura, height: altura(duracao: arrastado.fim.timeIntervalSince(arrastado.inicio)))
                .offset(x: margem, y: topo + CGFloat(alvo) / 60 * alturaDaHora + 1)
                .allowsHitTesting(false)
                .accessibilityHidden(true)
            }
            if DataLocal.calendario.isDateInToday(dia) {
              Agora(margem: margem)
                .offset(y: topo + posicao(de: .now) - 22)
            }
          }
        }
        .frame(height: alturaDaHora * 24)
        .onDrop(
          of: [.text],
          delegate: SoltarNaLinha(
            alvo: $alvo, minutos: minutos(no:), sinal: sinal,
            soltar: {
              if let alvo, let arrastado { soltar(arrastado.id, alvo) }
            }))
      }
      .onAppear {
        let primeira = eventos.first.map { DataLocal.calendario.component(.hour, from: $0.inicio) }
        let alvo =
          foco
          ?? (DataLocal.calendario.isDateInToday(dia)
            ? DataLocal.calendario.component(.hour, from: .now) : (primeira ?? 8))
        leitor.scrollTo(max(alvo - 1, 0), anchor: .top)
      }
    }
  }

  private func bloco(_ evento: Evento, largura: CGFloat) -> some View {
    let idade = evento.sessao.flatMap { Paciente.idadeQueCompleta(nascimentos[$0.patientId], em: dia) }
    let cartao = BlocoDoEvento(evento: evento, inicio: evento.inicio, fim: evento.fim, idade: idade)
    let duracao = evento.fim.timeIntervalSince(evento.inicio)
    return
      cartao
      .frame(height: max(altura(duracao: duracao), 22))
      .frame(width: largura, height: max(altura(duracao: duracao), 44), alignment: .top)
      .contentShape(.rect)
      .contentShape(.dragPreview, .rect(cornerRadius: 6))
      .contentShape(.accessibility, .rect)
      .opacity(arrastado?.id == evento.id ? 0.35 : 1)
      .accessibilityElement(children: .ignore)
      .accessibilityLabel(evento.descricao(idade: idade))
      .accessibilityAddTraits(.isButton)
      .accessibilityActions {
        if evento.sessao != nil {
          Button("Adiantar 15 minutos") { Task { await mover(evento, evento.inicio.addingTimeInterval(-15 * 60)) } }
          Button("Atrasar 15 minutos") { Task { await mover(evento, evento.inicio.addingTimeInterval(15 * 60)) } }
          Button("Passar para o dia seguinte") {
            Task { await mover(evento, DataLocal.somar(.day, 1, a: evento.inicio)) }
          }
        }
      }
      .onTapGesture { abrirEvento(evento) }
      .modifier(
        Arrastavel(ativo: evento.sessao != nil, id: evento.id, comecar: { comecarArraste(evento) }) {
          cartao.frame(width: largura, height: max(altura(duracao: duracao), 22))
        })
  }

  private func minutos(no y: CGFloat) -> Int {
    let duracao = Int((arrastado.map { $0.fim.timeIntervalSince($0.inicio) } ?? 45 * 60) / 60)
    let comeco = Double((y - topo) / alturaDaHora * 60) - Double(duracao) / 2
    let arredondado = Int((comeco / 15).rounded()) * 15
    return min(max(arredondado, 0), 24 * 60 - duracao)
  }

  private var faixasFechadas: [(inicio: Int, fim: Int)] {
    guard let clinica else { return [] }
    guard let horario = clinica.horario(em: dia) else { return [(0, 24 * 60)] }
    return [(0, horario.abre), (horario.fecha, 24 * 60)].filter { $0.0 < $0.1 }
  }

  private func pertoDeAgora(_ hora: Int) -> Bool {
    guard DataLocal.calendario.isDateInToday(dia) else { return false }
    let partes = DataLocal.calendario.dateComponents([.hour, .minute], from: .now)
    let minutos = (partes.hour ?? 0) * 60 + (partes.minute ?? 0)
    return abs(minutos - hora * 60) < 15
  }

  private func posicao(de data: Date) -> CGFloat {
    let partes = DataLocal.calendario.dateComponents([.hour, .minute], from: data)
    return CGFloat((partes.hour ?? 0) * 60 + (partes.minute ?? 0)) / 60 * alturaDaHora
  }

  private func altura(duracao: TimeInterval) -> CGFloat {
    CGFloat(duracao / 3600) * alturaDaHora - 3
  }
}

private struct Arrastavel<Previa: View>: ViewModifier {
  let ativo: Bool
  let id: String
  let comecar: () -> Void
  @ViewBuilder let previa: () -> Previa

  func body(content: Content) -> some View {
    if ativo {
      content.onDrag {
        comecar()
        return NSItemProvider(object: id as NSString)
      } preview: {
        previa()
      }
    } else {
      content
    }
  }
}

private struct SoltarNaLinha: DropDelegate {
  @Binding var alvo: Int?
  let minutos: (CGFloat) -> Int
  let sinal: (Bool) -> Void
  let soltar: () -> Void

  func validateDrop(info: DropInfo) -> Bool {
    info.hasItemsConforming(to: [.text])
  }

  func dropEntered(info: DropInfo) {
    sinal(true)
    alvo = minutos(info.location.y)
  }

  func dropUpdated(info: DropInfo) -> DropProposal? {
    let novo = minutos(info.location.y)
    if novo != alvo { alvo = novo }
    return DropProposal(operation: .move)
  }

  func dropExited(info: DropInfo) {
    sinal(false)
    alvo = nil
  }

  func performDrop(info: DropInfo) -> Bool {
    guard alvo != nil else { return false }
    soltar()
    alvo = nil
    sinal(false)
    return true
  }
}

private struct SoltarNoDia: DropDelegate {
  let sinal: (Bool) -> Void
  let soltar: (() -> Void)?

  func validateDrop(info: DropInfo) -> Bool {
    info.hasItemsConforming(to: [.text])
  }

  func dropEntered(info: DropInfo) {
    sinal(true)
  }

  func dropUpdated(info: DropInfo) -> DropProposal? {
    DropProposal(operation: soltar == nil ? .forbidden : .move)
  }

  func dropExited(info: DropInfo) {
    sinal(false)
  }

  func performDrop(info: DropInfo) -> Bool {
    sinal(false)
    guard let soltar else { return false }
    soltar()
    return true
  }
}

private struct LugarDeSoltar: View {
  let inicio: Int
  let duracao: TimeInterval

  var body: some View {
    let comeco = String(format: "%02d:%02d", inicio / 60, inicio % 60)
    RoundedRectangle(cornerRadius: 6)
      .strokeBorder(style: StrokeStyle(lineWidth: 1.5, dash: [5, 3]))
      .foregroundStyle(.tint)
      .background(Color.accentColor.opacity(0.08), in: .rect(cornerRadius: 6))
      .overlay(alignment: .topLeading) {
        Text(comeco)
          .font(.caption.weight(.semibold))
          .monospacedDigit()
          .padding(.horizontal, 6)
          .padding(.vertical, 3)
      }
  }
}

private struct BlocoDoEvento: View {
  let evento: Evento
  let inicio: Date
  let fim: Date
  let idade: Int?

  @Environment(\.colorScheme) private var esquema

  var body: some View {
    let cor = Color(hex: evento.cor)
    let curta = fim.timeIntervalSince(inicio) < 45 * 60
    let horario = "\(inicio.hora) – \(fim.hora)"
    HStack(alignment: .top, spacing: 6) {
      Capsule()
        .fill(cor)
        .frame(width: 4)
        .frame(maxHeight: .infinity)
        .padding(.vertical, 3)
      VStack(alignment: .leading, spacing: 1) {
        HStack(alignment: .firstTextBaseline, spacing: 6) {
          TituloDoEvento(evento: evento, idade: idade, comEtiqueta: curta)
            .font(.subheadline.weight(evento.sessao == nil || evento.faltou ? .medium : .semibold))
          Spacer(minLength: 0)
          if curta {
            Text(horario)
              .font(.caption)
              .monospacedDigit()
              .foregroundStyle(.secondary)
          }
        }
        if !curta {
          Text(evento.sessao == nil ? horario : "\(evento.etiqueta) · \(horario)")
            .font(.caption)
            .monospacedDigit()
            .foregroundStyle(.secondary)
        }
      }
      .lineLimit(1)
      .padding(.vertical, 4)
    }
    .padding(.leading, 3)
    .padding(.trailing, 6)
    .frame(maxHeight: .infinity, alignment: .top)
    .dynamicTypeSize(...DynamicTypeSize.large)
    .background {
      if evento.sessao == nil {
        ZStack {
          Color(.systemGray6)
          Listras().fill(Color.primary.opacity(0.06))
        }
      } else {
        cor.opacity(evento.faltou ? (esquema == .dark ? 0.14 : 0.08) : (esquema == .dark ? 0.3 : 0.16))
      }
    }
    .clipShape(.rect(cornerRadius: 6))
  }
}

private struct TituloDoEvento: View {
  let evento: Evento
  let idade: Int?
  let comEtiqueta: Bool

  var body: some View {
    switch evento.origem {
    case .compromisso(let compromisso):
      Text(
        compromisso.titulo.isEmpty ? compromisso.etiquetaNome : "\(compromisso.etiquetaNome) · \(compromisso.titulo)"
      )
      .foregroundStyle(.secondary)
    case .sessao:
      let bolo = idade == nil ? Text("") : Text("\(Image(systemName: "birthday.cake")) ")
      let nome = Text(evento.titulo).strikethrough(evento.faltou)
      let marcas = evento.marcas.reduce(Text("")) { texto, marca in
        Text("\(texto) \(Image(systemName: marca.simbolo))")
      }
      let etiqueta = comEtiqueta ? Text(" · \(evento.etiqueta)").font(.caption).foregroundStyle(.secondary) : Text("")
      Text("\(bolo)\(nome)\(marcas)\(etiqueta)")
        .foregroundStyle(evento.faltou ? Color.secondary : Color.primary)
    }
  }
}

private struct Listras: Shape {
  func path(in rect: CGRect) -> Path {
    var caminho = Path()
    var x = -rect.height
    while x < rect.width {
      caminho.move(to: CGPoint(x: x, y: rect.height))
      caminho.addLine(to: CGPoint(x: x + rect.height, y: 0))
      x += 8
    }
    return caminho.strokedPath(StrokeStyle(lineWidth: 3))
  }
}

private struct Agora: View {
  let margem: CGFloat

  var body: some View {
    HStack(spacing: 0) {
      Text(Date.now.hora)
        .font(.caption2.weight(.semibold))
        .foregroundStyle(.red)
        .frame(width: margem - 8, alignment: .trailing)
        .padding(.trailing, 4)
      Circle().fill(.red).frame(width: 8, height: 8)
      Rectangle().fill(.red).frame(height: 1.5)
    }
    .frame(height: 44)
    .allowsHitTesting(false)
    .accessibilityElement(children: .ignore)
    .accessibilityLabel("Agora, \(Date.now.hora)")
    .accessibilityAddTraits(.isStaticText)
  }
}
