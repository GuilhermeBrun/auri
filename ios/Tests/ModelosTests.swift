import XCTest

@testable import Auri

final class ModelosTests: XCTestCase {
  private func valor(_ json: String) throws -> JSONValor {
    try JSONDecoder().decode(JSONValor.self, from: Data(json.utf8))
  }

  func testJSONValorIdaEVolta() throws {
    let original = try valor(#"{"a":[1,true,null,"texto"],"b":{"c":2.5}}"#)
    let recodificado = try JSONDecoder().decode(JSONValor.self, from: JSONEncoder().encode(original))
    XCTAssertEqual(original, recodificado)
    XCTAssertEqual(original["b"]?["c"]?.numero, 2.5)
    XCTAssertEqual(original["a"]?.lista?.count, 4)
    XCTAssertNil(original["inexistente"])
  }

  func testDecodificaASessaoComoODesktopManda() throws {
    let sessao = try valor(
      #"""
      {"id":73,"patient_id":2,"patient_nome":"Bruno Exemplo","inicio":"2026-10-22T09:00","fim":"2026-10-22T09:45",
      "observacao":"","tipo_id":1,"tipo_nome":"Linguagem","tipo_cor":"#7c3aed","categoria":"sessao","presenca":"",
      "evolucao":"","confirmado_em":null,"pedido":null,"assinatura":null}
      """#
    ).decodificar(Sessao.self)
    XCTAssertEqual(sessao.patientNome, "Bruno Exemplo")
    XCTAssertEqual(sessao.tipoCor, "#7c3aed")

    let evento = try XCTUnwrap(Evento(sessao))
    XCTAssertEqual(evento.id, "s73")
    XCTAssertEqual(evento.titulo, "Bruno Exemplo")
    XCTAssertEqual(evento.fim.timeIntervalSince(evento.inicio), 45 * 60)
  }

  func testCompromissoMostraEtiquetaETitulo() throws {
    let compromisso = Compromisso(
      id: 5,
      etiquetaNome: "Palestra",
      titulo: "Reunião de equipe",
      cor: "#0d9488",
      inicio: "2026-10-23T17:00",
      fim: "2026-10-23T18:00",
      observacao: nil
    )
    XCTAssertEqual(Evento(compromisso)?.titulo, "Palestra: Reunião de equipe")
  }

  func testHorarioInvalidoNaoViraEvento() {
    let compromisso = Compromisso(
      id: 6, etiquetaNome: "Palestra", titulo: "", cor: "#0d9488", inicio: "ontem", fim: "hoje", observacao: nil)
    XCTAssertNil(Evento(compromisso))
  }

  func testDataLocalSemFusoNoTexto() throws {
    let data = try XCTUnwrap(DataLocal.data("2026-10-22T09:05"))
    let partes = DataLocal.calendario.dateComponents([.year, .month, .day, .hour, .minute], from: data)
    XCTAssertEqual([partes.year, partes.month, partes.day, partes.hour, partes.minute], [2026, 10, 22, 9, 5])
    XCTAssertEqual(DataLocal.texto(data), "2026-10-22T09:05")
    XCTAssertEqual(DataLocal.calendario.component(.day, from: DataLocal.inicioDoMes(data)), 1)
    XCTAssertNil(DataLocal.data("22/10/2026"))
  }

  func testIdadeContaAniversario() throws {
    let nascimento = try XCTUnwrap(DataLocal.dia("2019-03-14"))
    let vespera = try XCTUnwrap(DataLocal.dia("2026-03-13"))
    let aniversario = try XCTUnwrap(DataLocal.dia("2026-03-14"))
    XCTAssertEqual(DataLocal.idade(nascimento, em: vespera), 6)
    XCTAssertEqual(DataLocal.idade(nascimento, em: aniversario), 7)
  }

  func testResponsavelETelefoneDaFicha() throws {
    let comMae = try valor(
      #"{"id":1,"nome":"Ana","resp_tipo":"mae","mae_nome":"Mariana","mae_celular":"(11) 98000-0000","celular":""}"#
    ).decodificar(Paciente.self)
    XCTAssertEqual(comMae.responsavel?.nome, "Mariana")
    XCTAssertEqual(comMae.telefone, "(11) 98000-0000")

    let comCelular = try valor(
      #"{"id":2,"nome":"Bruno","resp_tipo":"","celular":"(11) 97000-0000"}"#
    ).decodificar(Paciente.self)
    XCTAssertNil(comCelular.responsavel)
    XCTAssertEqual(comCelular.telefone, "(11) 97000-0000")
  }
}
