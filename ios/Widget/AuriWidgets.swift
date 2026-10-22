import AppIntents
import SwiftUI
import WidgetKit

@main
struct AuriWidgets: WidgetBundle {
  var body: some Widget {
    ProximasSessoes()
    ControleNovaSessao()
  }
}

struct ControleNovaSessao: ControlWidget {
  var body: some ControlWidgetConfiguration {
    StaticControlConfiguration(kind: "com.auri.ios.nova-sessao") {
      ControlWidgetButton(action: AbrirNovaSessao()) {
        Label("Nova sessão", systemImage: "calendar.badge.plus")
      }
    }
    .displayName("Nova sessão")
    .description("Abre o Auri para marcar uma sessão.")
  }
}

private struct BotaoNovaSessao: View {
  var body: some View {
    Button(intent: AbrirNovaSessao()) {
      Image(systemName: "plus")
        .font(.system(size: 15, weight: .bold))
        .foregroundStyle(.white)
        .frame(width: 28, height: 28)
        .background(Color.accentColor, in: .circle)
    }
    .buttonStyle(.plain)
    .accessibilityLabel("Marcar sessão")
  }
}

struct ProximasSessoes: Widget {
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: Resumo.widget, provider: Fornecedor()) { entrada in
      VisaoDoWidget(entrada: entrada)
        .containerBackground(.background, for: .widget)
    }
    .configurationDisplayName("A seguir")
    .description("As próximas sessões da agenda da clínica.")
    .supportedFamilies([
      .systemSmall, .systemMedium, .systemLarge,
      .accessoryRectangular, .accessoryInline, .accessoryCircular,
    ])
  }
}

struct Entrada: TimelineEntry {
  let date: Date
  let resumo: Resumo?
}

struct Fornecedor: TimelineProvider {
  func placeholder(in context: Context) -> Entrada {
    Entrada(date: .now, resumo: .exemplo)
  }

  func getSnapshot(in context: Context, completion: @escaping (Entrada) -> Void) {
    completion(Entrada(date: .now, resumo: context.isPreview ? .exemplo : Resumo.ler()))
  }

  func getTimeline(in context: Context, completion: @escaping (Timeline<Entrada>) -> Void) {
    let resumo = Resumo.ler()
    let agora = Date.now
    let calendario = Calendar.current
    let mudancas = (resumo?.itens ?? []).flatMap { [$0.inicio, $0.fim] }.filter { $0 > agora }
    let meiaNoite = calendario.startOfDay(for: calendario.date(byAdding: .day, value: 1, to: agora) ?? agora)
    let datas = ([agora] + mudancas.filter { $0 < meiaNoite } + [meiaNoite]).sorted()
    let entradas = datas.map { Entrada(date: $0, resumo: resumo) }
    completion(Timeline(entries: entradas, policy: .after(meiaNoite.addingTimeInterval(60))))
  }
}

private extension Resumo {
  static var exemplo: Resumo {
    let hoje = Calendar.current.startOfDay(for: .now)
    let item = { (hora: Int, titulo: String, etiqueta: String, cor: String) in
      Resumo.Item(
        inicio: hoje.addingTimeInterval(TimeInterval(hora * 3600)),
        fim: hoje.addingTimeInterval(TimeInterval(hora * 3600 + 2700)),
        cor: cor,
        titulo: titulo,
        etiqueta: etiqueta
      )
    }
    return Resumo(
      itens: [
        item(14, "Ana Beatriz", "Linguagem", "#7c3aed"),
        item(15, "Bruno Exemplo", "Avaliação", "#2563eb"),
        item(16, "Carla Fictícia", "Motricidade", "#ea580c"),
      ],
      atualizado: .now
    )
  }
}

struct VisaoDoWidget: View {
  let entrada: Entrada

  @Environment(\.widgetFamily) private var familia

  private var hoje: [Resumo.Item] {
    let calendario = Calendar.current
    return (entrada.resumo?.itens ?? []).filter {
      calendario.isDate($0.inicio, inSameDayAs: entrada.date) && $0.fim > entrada.date
    }
  }

  private var amanha: [Resumo.Item] {
    let calendario = Calendar.current
    guard let dia = calendario.date(byAdding: .day, value: 1, to: entrada.date) else { return [] }
    return (entrada.resumo?.itens ?? []).filter { calendario.isDate($0.inicio, inSameDayAs: dia) }
  }

  var body: some View {
    Group {
      if entrada.resumo == nil {
        SemConexao(familia: familia)
      } else {
        switch familia {
        case .accessoryInline: inline
        case .accessoryCircular: circular
        case .accessoryRectangular: retangular
        case .systemSmall: pequeno
        case .systemMedium: medio
        default: grande
        }
      }
    }
    .widgetURL(Resumo.url(hoje.first?.inicio ?? entrada.date))
  }

  @ViewBuilder
  private var inline: some View {
    if let proxima = hoje.first {
      Text("\(proxima.inicio.formatted(date: .omitted, time: .shortened)) · próxima sessão")
    } else {
      Text("Sem mais sessões hoje")
    }
  }

  private var circular: some View {
    VStack(spacing: 0) {
      Text("\(hoje.count)")
        .font(.title2.bold())
      Text("hoje")
        .font(.caption2)
    }
    .widgetAccentable()
    .accessibilityLabel(hoje.count == 1 ? "1 sessão hoje" : "\(hoje.count) sessões hoje")
  }

  private var retangular: some View {
    VStack(alignment: .leading, spacing: 1) {
      if let proxima = hoje.first {
        Text("Próxima sessão")
          .font(.headline)
          .widgetAccentable()
        Text(Self.horario(proxima))
        Text(hoje.count == 1 ? "Última de hoje" : "\(hoje.count) até o fim do dia")
          .foregroundStyle(.secondary)
      } else {
        Text("Agenda")
          .font(.headline)
          .widgetAccentable()
        Text("Sem mais sessões hoje")
        if let primeira = amanha.first {
          Text("Amanhã às \(primeira.inicio.formatted(date: .omitted, time: .shortened))")
            .foregroundStyle(.secondary)
        }
      }
    }
    .frame(maxWidth: .infinity, alignment: .leading)
  }

  private var pequeno: some View {
    VStack(alignment: .leading, spacing: 6) {
      HStack(alignment: .top) {
        Cabecalho(data: entrada.date, compacto: true)
        Spacer(minLength: 0)
        BotaoNovaSessao()
      }
      Spacer(minLength: 0)
      if let proxima = hoje.first {
        LinhaDoWidget(item: proxima)
        if hoje.count > 1 {
          Text(hoje.count == 2 ? "Mais 1 sessão" : "Mais \(hoje.count - 1) sessões")
            .font(.caption2)
            .foregroundStyle(.secondary)
        }
      } else {
        Vazio(amanha: amanha.first)
      }
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
  }

  private var medio: some View {
    HStack(alignment: .top, spacing: 14) {
      VStack(alignment: .leading, spacing: 4) {
        Cabecalho(data: entrada.date, compacto: true)
        Spacer(minLength: 0)
        Text(hoje.count == 1 ? "1 sessão" : "\(hoje.count) sessões")
          .font(.caption)
          .foregroundStyle(.secondary)
      }
      .frame(width: 84, alignment: .leading)
      VStack(alignment: .leading, spacing: 8) {
        if hoje.isEmpty {
          Vazio(amanha: amanha.first)
        } else {
          ForEach(hoje.prefix(3), id: \.self) { LinhaDoWidget(item: $0) }
        }
        Spacer(minLength: 0)
      }
      .frame(maxWidth: .infinity, alignment: .leading)
      BotaoNovaSessao()
    }
  }

  private var grande: some View {
    VStack(alignment: .leading, spacing: 10) {
      HStack(alignment: .top) {
        Cabecalho(data: entrada.date, compacto: false)
        Spacer(minLength: 0)
        BotaoNovaSessao()
      }
      if hoje.isEmpty {
        Vazio(amanha: amanha.first)
      } else {
        ForEach(hoje.prefix(8), id: \.self) { LinhaDoWidget(item: $0) }
      }
      Spacer(minLength: 0)
    }
    .frame(maxWidth: .infinity, alignment: .leading)
  }

  static func horario(_ item: Resumo.Item) -> String {
    "\(item.inicio.formatted(date: .omitted, time: .shortened)) – \(item.fim.formatted(date: .omitted, time: .shortened))"
  }
}

private struct Cabecalho: View {
  let data: Date
  let compacto: Bool

  var body: some View {
    VStack(alignment: .leading, spacing: 0) {
      Text(data.formatted(.dateTime.weekday(.wide)).replacingOccurrences(of: "-feira", with: "").uppercased())
        .font(.caption.weight(.semibold))
        .foregroundStyle(.red)
      Text(compacto ? data.formatted(.dateTime.day()) : data.formatted(.dateTime.day().month(.wide)))
        .font(compacto ? .system(size: 32, weight: .regular) : .title2.weight(.semibold))
    }
  }
}

private struct LinhaDoWidget: View {
  let item: Resumo.Item

  var body: some View {
    HStack(spacing: 6) {
      RoundedRectangle(cornerRadius: 2)
        .fill(Color(hex: item.cor))
        .frame(width: 4)
      VStack(alignment: .leading, spacing: 0) {
        Text(item.titulo)
          .font(.caption.weight(.semibold))
          .lineLimit(1)
          .privacySensitive()
        Text(
          item.titulo == item.etiqueta
            ? VisaoDoWidget.horario(item) : "\(VisaoDoWidget.horario(item)) · \(item.etiqueta)"
        )
        .font(.caption2)
        .foregroundStyle(.secondary)
        .lineLimit(1)
      }
    }
    .fixedSize(horizontal: false, vertical: true)
  }
}

private struct Vazio: View {
  let amanha: Resumo.Item?

  var body: some View {
    VStack(alignment: .leading, spacing: 2) {
      Text("Sem mais sessões hoje")
        .font(.caption.weight(.semibold))
      if let amanha {
        Text("Amanhã às \(amanha.inicio.formatted(date: .omitted, time: .shortened))")
          .font(.caption2)
          .foregroundStyle(.secondary)
      }
    }
  }
}

private struct SemConexao: View {
  let familia: WidgetFamily

  var body: some View {
    switch familia {
    case .accessoryInline:
      Text("Abra o Auri")
    case .accessoryCircular:
      Image(systemName: "calendar")
    default:
      VStack(alignment: .leading, spacing: 4) {
        Text("Auri")
          .font(.headline)
        Text("Abra o Auri e conecte ao computador da clínica.")
          .font(.caption)
          .foregroundStyle(.secondary)
      }
      .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }
  }
}
