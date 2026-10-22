import XCTest

@testable import Auri

final class ResumoTests: XCTestCase {
  func testNomeCurtoSegueORegraDoDesktop() {
    XCTAssertEqual(Resumo.nomeCurto("Helena Prado Albuquerque"), "Helena Prado")
    XCTAssertEqual(Resumo.nomeCurto("Maria Eduarda Vasconcelos de Albuquerque Santos"), "Maria Eduarda")
    XCTAssertEqual(Resumo.nomeCurto("Alice"), "Alice")
    XCTAssertEqual(Resumo.nomeCurto("Ana de Souza Lima"), "Ana Souza")
    XCTAssertEqual(Resumo.nomeCurto("João dos Santos"), "João Santos")
    XCTAssertEqual(Resumo.nomeCurto("  Theo   Barros  Cardoso "), "Theo Barros")
    XCTAssertEqual(Resumo.nomeCurto(""), "")
  }

  func testGravaELeOResumoDoWidget() throws {
    let inicio = Date(timeIntervalSince1970: 1_800_000_000)
    let resumo = Resumo(
      itens: [
        Resumo.Item(
          inicio: inicio,
          fim: inicio.addingTimeInterval(2700),
          cor: "#7c3aed",
          titulo: "Ana Beatriz",
          etiqueta: "Linguagem"
        )
      ],
      atualizado: inicio
    )
    try resumo.gravar()
    let lido = try XCTUnwrap(Resumo.ler())
    XCTAssertEqual(lido.itens, resumo.itens)
    Resumo.apagar()
    XCTAssertNil(Resumo.ler())
  }

  func testEnderecoDoWidgetAbreAAgendaNoHorario() throws {
    var partes = DateComponents()
    (partes.year, partes.month, partes.day, partes.hour, partes.minute) = (2026, 10, 22, 14, 30)
    let data = try XCTUnwrap(Calendar.current.date(from: partes))
    XCTAssertEqual(Resumo.url(data)?.absoluteString, "auri://agenda?data=2026-10-22T14:30")
  }
}
