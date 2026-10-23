import Foundation

enum JSONValor: Codable, Equatable, Sendable {
  case nulo
  case booleano(Bool)
  case numero(Double)
  case texto(String)
  case lista([JSONValor])
  case objeto([String: JSONValor])

  init(from decoder: Decoder) throws {
    let valor = try decoder.singleValueContainer()
    if valor.decodeNil() {
      self = .nulo
    } else if let booleano = try? valor.decode(Bool.self) {
      self = .booleano(booleano)
    } else if let numero = try? valor.decode(Double.self) {
      self = .numero(numero)
    } else if let texto = try? valor.decode(String.self) {
      self = .texto(texto)
    } else if let lista = try? valor.decode([JSONValor].self) {
      self = .lista(lista)
    } else {
      self = .objeto(try valor.decode([String: JSONValor].self))
    }
  }

  func encode(to encoder: Encoder) throws {
    var valor = encoder.singleValueContainer()
    switch self {
    case .nulo: try valor.encodeNil()
    case .booleano(let booleano): try valor.encode(booleano)
    case .numero(let numero): try valor.encode(numero)
    case .texto(let texto): try valor.encode(texto)
    case .lista(let lista): try valor.encode(lista)
    case .objeto(let objeto): try valor.encode(objeto)
    }
  }

  subscript(chave: String) -> JSONValor? {
    if case .objeto(let objeto) = self { return objeto[chave] }
    return nil
  }

  var texto: String? {
    if case .texto(let texto) = self { return texto }
    return nil
  }

  var numero: Double? {
    if case .numero(let numero) = self { return numero }
    return nil
  }

  var booleano: Bool? {
    if case .booleano(let booleano) = self { return booleano }
    return nil
  }

  var lista: [JSONValor]? {
    if case .lista(let lista) = self { return lista }
    return nil
  }

  func decodificar<T: Decodable>(_ tipo: T.Type) throws -> T {
    let decodificador = JSONDecoder()
    decodificador.keyDecodingStrategy = .convertFromSnakeCase
    return try decodificador.decode(tipo, from: JSONEncoder().encode(self))
  }
}
