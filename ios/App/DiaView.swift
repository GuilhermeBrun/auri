import SwiftUI

struct DiaView: View {
  let agenda: Agenda
  let abrirEvento: (Evento) -> Void

  @State private var dia: Date
  @Environment(\.dynamicTypeSize) private var tamanhoDoTexto
  private let foco: Int?

  init(agenda: Agenda, inicial: Date, abrirEvento: @escaping (Evento) -> Void) {
    self.agenda = agenda
    self.abrirEvento = abrirEvento
    _dia = State(initialValue: DataLocal.inicioDoDia(inicial))
    let hora = DataLocal.calendario.component(.hour, from: inicial)
    foco = hora > 0 ? hora : nil
  }

  var body: some View {
    VStack(spacing: 0) {
      FaixaDaSemana(dia: $dia)
      Text(dia.formatado(.dateTime.weekday(.wide).day().month(.wide).year()))
        .font(.footnote.weight(.semibold))
        .padding(.vertical, 8)
        .frame(maxWidth: .infinity)
        .overlay(alignment: .bottom) { Rectangle().fill(.separator).frame(height: 0.5) }
      Group {
        if tamanhoDoTexto.isAccessibilitySize {
          ListaDoDia(eventos: agenda.eventos(em: dia), abrirEvento: abrirEvento)
        } else {
          LinhaDoTempo(dia: dia, foco: foco, eventos: agenda.eventos(em: dia), abrirEvento: abrirEvento)
        }
      }
      .id(dia)
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
  }
}

private struct ListaDoDia: View {
  let eventos: [Evento]
  let abrirEvento: (Evento) -> Void

  var body: some View {
    List(eventos) { evento in
      Button {
        abrirEvento(evento)
      } label: {
        HStack(spacing: 12) {
          RoundedRectangle(cornerRadius: 2).fill(Color(hex: evento.cor)).frame(width: 5)
          VStack(alignment: .leading, spacing: 2) {
            Text(evento.titulo)
              .font(.headline)
            Text("\(evento.inicio.hora) – \(evento.fim.hora)")
              .foregroundStyle(.secondary)
          }
        }
      }
      .foregroundStyle(.primary)
    }
    .overlay {
      if eventos.isEmpty {
        ContentUnavailableView("Nenhuma sessão neste dia", systemImage: "calendar")
      }
    }
  }
}

private struct FaixaDaSemana: View {
  @Binding var dia: Date

  var body: some View {
    let calendario = DataLocal.calendario
    let recuo = (calendario.component(.weekday, from: dia) - calendario.firstWeekday + 7) % 7
    let inicio = DataLocal.somar(.day, -recuo, a: dia)
    let dias = (0..<7).map { DataLocal.somar(.day, $0, a: inicio) }
    HStack(spacing: 0) {
      ForEach(Array(dias.enumerated()), id: \.offset) { indice, outro in
        let escolhido = calendario.isDate(outro, inSameDayAs: dia)
        let hoje = calendario.isDateInToday(outro)
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
        .onTapGesture { withAnimation { dia = outro } }
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
  let abrirEvento: (Evento) -> Void

  private let alturaDaHora: CGFloat = 60
  private let margem: CGFloat = 56
  private let topo: CGFloat = 8

  var body: some View {
    ScrollViewReader { leitor in
      ScrollView {
        ZStack(alignment: .topLeading) {
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
              BlocoDoEvento(evento: item.evento)
                .frame(height: max(altura(de: item.evento), 22))
                .frame(
                  width: largura / CGFloat(item.total) - 2,
                  height: max(altura(de: item.evento), 44),
                  alignment: .top
                )
                .contentShape(.rect)
                .contentShape(.accessibility, .rect)
                .accessibilityElement(children: .ignore)
                .accessibilityLabel(
                  "\(item.evento.titulo), \(item.evento.inicio.hora) – \(item.evento.fim.hora)"
                )
                .accessibilityAddTraits(.isButton)
                .offset(
                  x: margem + largura / CGFloat(item.total) * CGFloat(item.coluna),
                  y: topo + posicao(de: item.evento.inicio) + 1
                )
                .onTapGesture { abrirEvento(item.evento) }
            }
            if DataLocal.calendario.isDateInToday(dia) {
              Agora(margem: margem)
                .offset(y: topo + posicao(de: .now) - 22)
            }
          }
        }
        .frame(height: alturaDaHora * 24)
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

  private func altura(de evento: Evento) -> CGFloat {
    CGFloat(evento.fim.timeIntervalSince(evento.inicio) / 3600) * alturaDaHora - 3
  }
}

private struct BlocoDoEvento: View {
  let evento: Evento

  @Environment(\.colorScheme) private var esquema

  var body: some View {
    let cor = Color(hex: evento.cor)
    let curta = evento.fim.timeIntervalSince(evento.inicio) < 45 * 60
    HStack(alignment: .top, spacing: 6) {
      Capsule()
        .fill(cor)
        .frame(width: 4)
        .frame(maxHeight: .infinity)
        .padding(.vertical, 3)
      Group {
        if curta {
          HStack(spacing: 6) {
            Text(evento.titulo)
              .font(.subheadline.weight(.semibold))
            Text(evento.inicio.hora)
              .font(.caption)
              .foregroundStyle(.secondary)
          }
        } else {
          VStack(alignment: .leading, spacing: 1) {
            Text(evento.titulo)
              .font(.subheadline.weight(.semibold))
            Text("\(evento.inicio.hora) – \(evento.fim.hora)")
              .font(.caption)
              .foregroundStyle(.secondary)
          }
        }
      }
      .lineLimit(1)
      .padding(.vertical, 4)
      Spacer(minLength: 0)
    }
    .padding(.leading, 3)
    .padding(.trailing, 6)
    .frame(maxHeight: .infinity, alignment: .top)
    .background(cor.opacity(esquema == .dark ? 0.3 : 0.16))
    .clipShape(.rect(cornerRadius: 6))
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
