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
    let clinica = try XCTUnwrap(respostas["clinic:get"]).decodificar(Clinica.self)
    XCTAssertFalse(clinica.funcionamento.isEmpty)
  }

  func testPedidoEAssinaturaNoFormatoDoDesktop() throws {
    let json = Data(
      #"""
      {"id":7,"patient_id":1,"patient_nome":"Ana Beatriz Teste","inicio":"2026-10-23T15:00","fim":"2026-10-23T15:45",
      "observacao":"","tipo_id":2,"tipo_nome":"Linguagem","tipo_cor":"#7c3aed","categoria":"sessao","presenca":"",
      "evolucao":"","confirmado_em":null,"assinatura":null,
      "pedido":{"estado":"aguardando","prazo":"2026-10-23T17:00:00.000Z"},"updated_at":"2026-10-23T14:00:00.000Z"}
      """#.utf8)
    let sessao = try JSONDecoder().decode(JSONValor.self, from: json).decodificar(Sessao.self)
    let evento = try XCTUnwrap(Evento(sessao))
    let prazo = try XCTUnwrap(ISO8601DateFormatter().date(from: "2026-10-23T17:00:00Z"))
    XCTAssertEqual(evento.marcas, [.aguardando(ate: prazo.hora)])
    XCTAssertEqual(sessao.updatedAt, "2026-10-23T14:00:00.000Z")
  }
}
