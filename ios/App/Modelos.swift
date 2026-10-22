import SwiftUI

struct Sessao: Decodable, Identifiable, Hashable, Sendable {
  let id: Int
  let patientId: Int
  let patientNome: String
  let inicio: String
  let fim: String
  let observacao: String?
  let tipoId: Int
  let tipoNome: String
  let tipoCor: String
  let categoria: String
  let presenca: String
  let evolucao: String?
  let confirmadoEm: String?
}

struct Compromisso: Decodable, Identifiable, Hashable, Sendable {
  let id: Int
  let etiquetaNome: String
  let titulo: String
  let cor: String
  let inicio: String
  let fim: String
  let observacao: String?
}

struct Etiqueta: Decodable, Identifiable, Hashable, Sendable {
  let id: Int
  let nome: String
  let categoria: String
  let cor: String
  let duracao: Int
}

struct Paciente: Decodable, Identifiable, Hashable, Sendable {
  let id: Int
  let nome: String
  let dataNascimento: String?
  let celular: String?
  let email: String?
  let escola: String?
  let serie: String?
  let professora: String?
  let maeNome: String?
  let maeCelular: String?
  let paiNome: String?
  let paiCelular: String?
  let respTipo: String?
  let respNome: String?
  let respCelular: String?
}

struct Anamnese: Decodable, Sendable {
  let data: String?
  let queixa: String?
  let gestacao: String?
  let alimentacao: String?
  let sono: String?
  let desenvolvimento: String?
  let saude: String?
  let rotina: String?
  let terapias: String?
  let observacoes: String?
}

struct Evento: Identifiable, Hashable, Sendable {
  enum Origem: Hashable, Sendable {
    case sessao(Sessao)
    case compromisso(Compromisso)
  }

  let id: String
  let titulo: String
  let inicio: Date
  let fim: Date
  let cor: String
  let origem: Origem

  init?(_ sessao: Sessao) {
    guard let inicio = DataLocal.data(sessao.inicio), let fim = DataLocal.data(sessao.fim) else {
      return nil
    }
    id = "s\(sessao.id)"
    titulo = sessao.patientNome
    self.inicio = inicio
    self.fim = fim
    cor = sessao.tipoCor
    origem = .sessao(sessao)
  }

  init?(_ compromisso: Compromisso) {
    guard let inicio = DataLocal.data(compromisso.inicio), let fim = DataLocal.data(compromisso.fim)
    else { return nil }
    id = "c\(compromisso.id)"
    titulo =
      compromisso.titulo.isEmpty
      ? compromisso.etiquetaNome : "\(compromisso.etiquetaNome): \(compromisso.titulo)"
    self.inicio = inicio
    self.fim = fim
    cor = compromisso.cor
    origem = .compromisso(compromisso)
  }
}

extension Array where Element == Evento {
  func emColunas() -> [(evento: Evento, coluna: Int, total: Int)] {
    var grupos: [[Evento]] = []
    var fimDoGrupo = Date.distantPast
    for evento in sorted(by: { $0.inicio < $1.inicio }) {
      if evento.inicio >= fimDoGrupo || grupos.isEmpty {
        grupos.append([evento])
      } else {
        grupos[grupos.count - 1].append(evento)
      }
      fimDoGrupo = Swift.max(fimDoGrupo, evento.fim)
    }
    return grupos.flatMap { grupo in
      var fins: [Date] = []
      var lugares: [(Evento, Int)] = []
      for evento in grupo {
        if let livre = fins.firstIndex(where: { $0 <= evento.inicio }) {
          fins[livre] = evento.fim
          lugares.append((evento, livre))
        } else {
          fins.append(evento.fim)
          lugares.append((evento, fins.count - 1))
        }
      }
      return lugares.map { (evento: $0.0, coluna: $0.1, total: fins.count) }
    }
  }
}

extension Paciente {
  static func filtrar(_ lista: [Paciente], busca: String) -> [Paciente] {
    let termo = busca.trimmingCharacters(in: .whitespaces)
    guard !termo.isEmpty else { return lista }
    return lista.filter { $0.nome.range(of: termo, options: [.caseInsensitive, .diacriticInsensitive]) != nil }
  }

  static func secoes(_ lista: [Paciente]) -> [(letra: String, pacientes: [Paciente])] {
    let local = Locale(identifier: "pt_BR")
    let porLetra = Dictionary(grouping: lista) { paciente in
      let primeira = paciente.nome.trimmingCharacters(in: .whitespaces)
        .folding(options: [.diacriticInsensitive, .caseInsensitive], locale: local)
        .uppercased()
        .first
      return primeira.map { $0.isLetter ? String($0) : "#" } ?? "#"
    }
    return porLetra.keys.sorted { a, b in a == "#" ? false : b == "#" ? true : a < b }.map { letra in
      (
        letra,
        porLetra[letra, default: []].sorted {
          $0.nome.compare($1.nome, options: [.caseInsensitive, .diacriticInsensitive], locale: local)
            == .orderedAscending
        }
      )
    }
  }

  static func iniciais(_ nome: String) -> String {
    let partes = nome.split(separator: " ").filter { $0.count > 2 || $0 == $0.uppercased() }
    let letras = [partes.first, partes.count > 1 ? partes.last : nil].compactMap { $0?.first }
    return String(letras).uppercased()
  }

  var responsavel: (nome: String, celular: String)? {
    switch respTipo {
    case "mae": return (maeNome ?? "", maeCelular ?? "")
    case "pai": return (paiNome ?? "", paiCelular ?? "")
    case "outro": return (respNome ?? "", respCelular ?? "")
    default: return nil
    }
  }

  var telefone: String? {
    [celular, responsavel?.celular].compactMap { $0 }.first { !$0.isEmpty }
  }
}

enum DataLocal {
  static let calendario: Calendar = {
    var calendario = Calendar(identifier: .gregorian)
    calendario.locale = Locale(identifier: "pt_BR")
    calendario.firstWeekday = 1
    return calendario
  }()

  private static let formato: DateFormatter = {
    let formato = DateFormatter()
    formato.locale = Locale(identifier: "en_US_POSIX")
    formato.calendar = Calendar(identifier: .gregorian)
    formato.dateFormat = "yyyy-MM-dd'T'HH:mm"
    return formato
  }()

  private static let soData: DateFormatter = {
    let formato = DateFormatter()
    formato.locale = Locale(identifier: "en_US_POSIX")
    formato.calendar = Calendar(identifier: .gregorian)
    formato.dateFormat = "yyyy-MM-dd"
    return formato
  }()

  static func data(_ texto: String) -> Date? {
    formato.date(from: String(texto.prefix(16)))
  }

  static func dia(_ texto: String) -> Date? {
    soData.date(from: String(texto.prefix(10)))
  }

  static func texto(_ data: Date) -> String {
    formato.string(from: data)
  }

  static func inicioDoDia(_ data: Date) -> Date {
    calendario.startOfDay(for: data)
  }

  static func inicioDoMes(_ data: Date) -> Date {
    calendario.date(from: calendario.dateComponents([.year, .month], from: data)) ?? data
  }

  static func somar(_ componente: Calendar.Component, _ valor: Int, a data: Date) -> Date {
    calendario.date(byAdding: componente, value: valor, to: data) ?? data
  }

  static func idade(_ nascimento: Date, em hoje: Date = .now) -> Int {
    calendario.dateComponents([.year], from: nascimento, to: hoje).year ?? 0
  }
}

extension Date {
  func formatado(_ estilo: Date.FormatStyle) -> String {
    formatted(estilo.locale(Locale(identifier: "pt_BR")))
  }

  var hora: String {
    formatado(.dateTime.hour(.twoDigits(amPM: .omitted)).minute(.twoDigits))
  }
}
