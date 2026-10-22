import XCTest

@MainActor
final class ConexaoUITests: XCTestCase {
  private var ambiente: [String: String] { ProcessInfo.processInfo.environment }

  func testPareiaConectaPelasDuasRotasELista() throws {
    let codigo = try XCTUnwrap(ambiente["AURI_CODIGO"], "Rode com TEST_RUNNER_AURI_CODIGO")
    let porta = ambiente["AURI_PORTA"] ?? "47391"
    let app = XCUIApplication()
    app.launch()

    let endereco = app.textFields["Endereço do computador"]
    XCTAssertTrue(endereco.waitForExistence(timeout: 10))
    endereco.tap()
    endereco.typeText("127.0.0.1")

    let campoDaPorta = app.textFields["Porta"]
    campoDaPorta.tap()
    campoDaPorta.typeText(String(repeating: XCUIKeyboardKey.delete.rawValue, count: 8) + porta)

    let campoDoCodigo = app.textFields["Código"]
    campoDoCodigo.tap()
    campoDoCodigo.typeText(codigo)
    anexar(app, "1-parear")

    app.buttons["Parear"].tap()
    XCTAssertTrue(texto(app, "Conectado pela rede da clínica").waitForExistence(timeout: 30))
    anexar(app, "2-conectado")

    app.buttons["Listar pacientes"].tap()
    XCTAssertTrue(app.staticTexts["Ana Teste"].waitForExistence(timeout: 15))
    anexar(app, "3-pacientes")

    app.switches["Só pela internet"].switches.firstMatch.tap()
    XCTAssertTrue(texto(app, "Conectado pela internet").waitForExistence(timeout: 60))

    app.buttons["Testar pela internet"].tap()
    XCTAssertTrue(texto(app, "respondeu em").waitForExistence(timeout: 60))
    anexar(app, "4-internet")
  }

  private func anexar(_ app: XCUIApplication, _ nome: String) {
    let anexo = XCTAttachment(screenshot: app.screenshot())
    anexo.name = nome
    anexo.lifetime = .keepAlways
    add(anexo)
  }

  private func texto(_ app: XCUIApplication, _ trecho: String) -> XCUIElement {
    app.staticTexts.containing(NSPredicate(format: "label CONTAINS %@", trecho)).firstMatch
  }
}
