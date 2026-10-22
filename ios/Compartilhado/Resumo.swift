import Foundation

struct Resumo: Codable, Sendable {
  struct Item: Codable, Sendable, Hashable {
    let inicio: Date
    let fim: Date
    let cor: String
    let titulo: String
    let etiqueta: String
  }

  var itens: [Item]
  var atualizado: Date

  static let grupo = "group.com.auri.ios"
  static let tarefa = "com.auri.ios.resumo"
  static let widget = "com.auri.ios.proximas"

  private static var arquivo: URL? {
    FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: grupo)?
      .appendingPathComponent("resumo.json")
  }

  static func ler() -> Resumo? {
    guard let arquivo, let dados = try? Data(contentsOf: arquivo) else { return nil }
    let decodificador = JSONDecoder()
    decodificador.dateDecodingStrategy = .iso8601
    return try? decodificador.decode(Resumo.self, from: dados)
  }

  func gravar() throws {
    guard let arquivo = Self.arquivo else { return }
    let codificador = JSONEncoder()
    codificador.dateEncodingStrategy = .iso8601
    try codificador.encode(self).write(
      to: arquivo,
      options: [.atomic, .completeFileProtectionUntilFirstUserAuthentication]
    )
  }

  static func apagar() {
    guard let arquivo else { return }
    try? FileManager.default.removeItem(at: arquivo)
  }

  static func nomeCurto(_ nome: String) -> String {
    let particulas: Set = ["de", "da", "do", "dos", "das", "e"]
    var mantidas: [Substring] = []
    for parte in nome.split(whereSeparator: \.isWhitespace) {
      if !mantidas.isEmpty && particulas.contains(parte.lowercased()) { continue }
      mantidas.append(parte)
      if mantidas.count == 2 { break }
    }
    return mantidas.joined(separator: " ")
  }

  static func url(_ data: Date) -> URL? {
    let formato = DateFormatter()
    formato.locale = Locale(identifier: "en_US_POSIX")
    formato.dateFormat = "yyyy-MM-dd'T'HH:mm"
    return URL(string: "auri://agenda?data=\(formato.string(from: data))")
  }
}
