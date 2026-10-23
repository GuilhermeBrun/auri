import XCTest

@testable import Auri

final class ContratoTests: XCTestCase {
  private func contrato() throws -> JSONValor {
    let arquivo = try XCTUnwrap(Bundle(for: Self.self).url(forResource: "contrato-v1", withExtension: "json"))
    return try JSONDecoder().decode(JSONValor.self, from: Data(contentsOf: arquivo))
  }

  func testOAppLeOQueODesktopResponde() throws {
    let respostas = try contrato()
    let pacientes = try XCTUnwrap(respostas["patients:list"]).decodificar([Paciente].self)
    XCTAssertFalse(pacientes.isEmpty)
    let ficha = try XCTUnwrap(respostas["patients:get"]).decodificar(Paciente.self)
    XCTAssertFalse(ficha.nome.isEmpty)
    let sessoes = try XCTUnwrap(respostas["appointments:listRange"]).decodificar([Sessao].self)
    XCTAssertNotNil(sessoes.first.flatMap(Evento.init))
    _ = try XCTUnwrap(respostas["appointments:listByPatient"]).decodificar([Sessao].self)
    let compromissos = try XCTUnwrap(respostas["commitments:listRange"]).decodificar([Compromisso].self)
    XCTAssertNotNil(compromissos.first.flatMap(Evento.init))
    let etiquetas = try XCTUnwrap(respostas["tipos:list"]).decodificar([Etiqueta].self)
    XCTAssertFalse(etiquetas.isEmpty)
    let anamnese = try XCTUnwrap(respostas["anamneses:get"]).decodificar(Anamnese.self)
    XCTAssertNotNil(anamnese.queixa)
  }
}
