import SwiftUI

struct MesView: View {
  let agenda: Agenda
  let inicial: Date
  let abrirDia: (Date) -> Void

  @State private var visivel: Date?

  var body: some View {
    ScrollView {
      LazyVStack(spacing: 0) {
        ForEach(agenda.meses, id: \.self) { mes in
          BlocoDoMes(agenda: agenda, mes: mes, abrirDia: abrirDia)
            .id(mes)
        }
      }
      .scrollTargetLayout()
    }
    .scrollPosition(id: $visivel, anchor: .top)
    .safeAreaInset(edge: .top, spacing: 0) {
      CabecalhoDaSemana()
    }
    .navigationTitle((visivel ?? inicial).formatado(.dateTime.month(.wide)).capitalized)
    .navigationBarTitleDisplayMode(.large)
    .toolbar {
      ToolbarItem(placement: .topBarLeading) {
        Button("Hoje") {
          withAnimation { visivel = DataLocal.inicioDoMes(.now) }
        }
      }
    }
    .onAppear {
      if visivel == nil { visivel = inicial }
    }
  }
}

struct CabecalhoDaSemana: View {
  var body: some View {
    HStack(spacing: 0) {
      ForEach(Array(DataLocal.calendario.veryShortStandaloneWeekdaySymbols.enumerated()), id: \.offset) {
        indice, letra in
        Text(letra.uppercased())
          .font(.caption2.weight(.semibold))
          .foregroundStyle(indice == 0 || indice == 6 ? .secondary : .primary)
          .frame(maxWidth: .infinity)
      }
    }
    .padding(.vertical, 6)
    .background(.bar)
  }
}

private struct BlocoDoMes: View {
  let agenda: Agenda
  let mes: Date
  let abrirDia: (Date) -> Void

  var body: some View {
    let dias = diasDoMes
    let vazios = (DataLocal.calendario.component(.weekday, from: mes) - DataLocal.calendario.firstWeekday + 7) % 7
    let celulas: [Date?] = Array(repeating: nil, count: vazios) + dias.map { Optional($0) }
    let semanas = stride(from: 0, to: celulas.count, by: 7).map {
      Array(celulas[$0..<min($0 + 7, celulas.count)])
    }
    let ehMesAtual = DataLocal.calendario.isDate(mes, equalTo: .now, toGranularity: .month)

    VStack(alignment: .leading, spacing: 0) {
      HStack(spacing: 0) {
        ForEach(0..<7, id: \.self) { coluna in
          Group {
            if coluna == vazios {
              Text(mes.formatado(.dateTime.month(.abbreviated)).capitalized.replacingOccurrences(of: ".", with: ""))
                .font(.title3.weight(.semibold))
                .foregroundStyle(ehMesAtual ? Color.red : Color.primary)
                .fixedSize()
            } else {
              Color.clear
            }
          }
          .frame(maxWidth: .infinity, alignment: .center)
        }
      }
      .padding(.top, 20)
      .padding(.bottom, 6)
      .accessibilityAddTraits(.isHeader)

      ForEach(Array(semanas.enumerated()), id: \.offset) { _, semana in
        HStack(spacing: 0) {
          ForEach(0..<7, id: \.self) { coluna in
            if coluna < semana.count, let dia = semana[coluna] {
              CelulaDoDia(dia: dia, cores: agenda.cores(em: dia), fimDeSemana: coluna == 0 || coluna == 6)
                .onTapGesture { abrirDia(dia) }
            } else {
              Color.clear.frame(maxWidth: .infinity, minHeight: 72)
            }
          }
        }
      }
    }
  }

  private var diasDoMes: [Date] {
    guard let intervalo = DataLocal.calendario.range(of: .day, in: .month, for: mes) else { return [] }
    return intervalo.map { DataLocal.somar(.day, $0 - 1, a: mes) }
  }
}

private struct CelulaDoDia: View {
  let dia: Date
  let cores: [String]
  let fimDeSemana: Bool

  var body: some View {
    let hoje = DataLocal.calendario.isDateInToday(dia)
    VStack(spacing: 6) {
      Text(dia.formatado(.dateTime.day()))
        .font(.title3.weight(hoje ? .semibold : .regular))
        .foregroundStyle(hoje ? Color.white : fimDeSemana ? Color.secondary : Color.primary)
        .frame(width: 36, height: 36)
        .background {
          if hoje { Circle().fill(.red) }
        }
      Marcadores(cores: cores)
    }
    .frame(maxWidth: .infinity, minHeight: 72, alignment: .top)
    .padding(.top, 6)
    .overlay(alignment: .top) {
      Rectangle().fill(.separator).frame(height: 0.5)
    }
    .contentShape(.rect)
    .accessibilityElement(children: .ignore)
    .accessibilityLabel(dia.formatado(.dateTime.weekday(.wide).day().month(.wide)))
    .accessibilityValue(cores.isEmpty ? "Sem sessões" : "Com sessões")
    .accessibilityAddTraits(.isButton)
  }
}

struct Marcadores: View {
  let cores: [String]

  var body: some View {
    HStack(spacing: 0) {
      ForEach(cores, id: \.self) { cor in
        Rectangle().fill(Color(hex: cor)).frame(width: 7, height: 7)
      }
    }
    .clipShape(.capsule)
    .frame(height: 7)
  }
}
