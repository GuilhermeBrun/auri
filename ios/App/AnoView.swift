import SwiftUI

struct AnoView: View {
  let agenda: Agenda
  let ano: Date
  let abrirMes: (Date) -> Void

  var body: some View {
    let anos = Dictionary(grouping: agenda.meses) { DataLocal.calendario.component(.year, from: $0) }
      .sorted { $0.key < $1.key }
    ScrollViewReader { leitor in
      ScrollView {
        LazyVStack(alignment: .leading, spacing: 24) {
          ForEach(anos, id: \.key) { ano, meses in
            VStack(alignment: .leading, spacing: 12) {
              Text(String(ano))
                .font(.largeTitle.bold())
                .foregroundStyle(ano == DataLocal.calendario.component(.year, from: .now) ? Color.red : Color.primary)
                .accessibilityAddTraits(.isHeader)
              LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 16), count: 3), spacing: 20) {
                ForEach(meses, id: \.self) { mes in
                  MiniMes(mes: mes)
                    .contentShape(.rect)
                    .onTapGesture { abrirMes(mes) }
                }
              }
            }
            .id(ano)
          }
        }
        .padding(.horizontal)
      }
      .onAppear { leitor.scrollTo(DataLocal.calendario.component(.year, from: ano), anchor: .top) }
    }
    .navigationTitle(String(DataLocal.calendario.component(.year, from: ano)))
    .toolbar(.hidden, for: .navigationBar)
  }
}

private struct MiniMes: View {
  let mes: Date

  var body: some View {
    let calendario = DataLocal.calendario
    let vazios = (calendario.component(.weekday, from: mes) - calendario.firstWeekday + 7) % 7
    let total = calendario.range(of: .day, in: .month, for: mes)?.count ?? 30
    let atual = calendario.isDate(mes, equalTo: .now, toGranularity: .month)
    VStack(alignment: .leading, spacing: 4) {
      Text(mes.formatado(.dateTime.month(.abbreviated)).capitalized.replacingOccurrences(of: ".", with: ""))
        .font(.headline)
        .foregroundStyle(atual ? Color.red : Color.primary)
      LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 0), count: 7), spacing: 2) {
        ForEach(0..<42, id: \.self) { indice in
          if indice < vazios || indice >= vazios + total {
            Color.clear.frame(height: 12)
          } else {
            let dia = indice - vazios + 1
            let hoje = atual && calendario.component(.day, from: .now) == dia
            Text("\(dia)")
              .font(.system(size: 8, weight: hoje ? .bold : .regular))
              .foregroundStyle(hoje ? Color.white : Color.primary)
              .frame(width: 13, height: 12)
              .background { if hoje { Circle().fill(.red) } }
          }
        }
      }
    }
    .accessibilityElement(children: .ignore)
    .accessibilityLabel(mes.formatado(.dateTime.month(.wide).year()))
    .accessibilityAddTraits(.isButton)
  }
}
