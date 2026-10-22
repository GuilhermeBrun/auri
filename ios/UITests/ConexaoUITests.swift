import XCTest

@MainActor
final class ConexaoUITests: XCTestCase {
  func testConectaPeloQRCodeEListaPacientes() throws {
    let qr = try XCTUnwrap(ProcessInfo.processInfo.environment["AURI_QR"], "Rode com TEST_RUNNER_AURI_QR")
    let app = XCUIApplication()
    app.launchEnvironment["AURI_QR"] = qr
    app.launch()

    XCTAssertTrue(app.staticTexts["Boas-vindas ao Auri"].waitForExistence(timeout: 10))
    anexar(app, "1-boas-vindas")

    app.buttons["Conectar ao computador"].tap()
    let pacientes = app.tabBars.buttons["Pacientes"]
    XCTAssertTrue(pacientes.waitForExistence(timeout: 30))
    anexar(app, "2-agenda")

    pacientes.tap()
    XCTAssertTrue(app.staticTexts["Ana Teste"].waitForExistence(timeout: 30))
    anexar(app, "3-pacientes")

    app.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", "Conexão")).firstMatch.tap()
    XCTAssertTrue(app.navigationBars["Conexão"].waitForExistence(timeout: 10))
    anexar(app, "4-conexao")
  }

  private func anexar(_ app: XCUIApplication, _ nome: String) {
    let anexo = XCTAttachment(screenshot: app.screenshot())
    anexo.name = nome
    anexo.lifetime = .keepAlways
    add(anexo)
  }
}
