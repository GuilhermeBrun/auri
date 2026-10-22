import XCTest

@MainActor
final class ConexaoUITests: XCTestCase {
  func testPercorreAsTelasConectadoPeloQRCode() throws {
    try XCTSkipIf(ProcessInfo.processInfo.environment["AURI_VAZIO"] != nil, "Precisa dos dados de exemplo")
    let qr = try XCTUnwrap(ProcessInfo.processInfo.environment["AURI_QR"], "Rode com TEST_RUNNER_AURI_QR")
    let app = XCUIApplication()
    app.launchEnvironment["AURI_QR"] = qr
    app.launch()

    XCTAssertTrue(elemento(app, contendo: "Boas-vindas ao Auri").waitForExistence(timeout: 10))
    anexar(app, "01-boas-vindas")

    app.buttons["Continuar"].tap()
    XCTAssertTrue(app.tabBars.buttons["Pacientes"].waitForExistence(timeout: 30))
    sleep(3)
    anexar(app, "02-mes")

    let hoje = Date.now.formatted(.dateTime.weekday(.wide).day().month(.wide).locale(Locale(identifier: "pt_BR")))
    elemento(app, igual: hoje).tap()
    sleep(1)
    anexar(app, "03-dia")

    let sessao = elemento(app, contendo: " – ")
    XCTAssertTrue(sessao.waitForExistence(timeout: 10))
    sessao.tap()
    sleep(1)
    anexar(app, "04-sessao")

    app.navigationBars.buttons.firstMatch.tap()
    app.navigationBars.buttons.firstMatch.tap()
    app.navigationBars.buttons.firstMatch.tap()
    sleep(1)
    anexar(app, "05-ano")

    app.tabBars.buttons["Pacientes"].tap()
    XCTAssertTrue(app.staticTexts["Ana Beatriz Teste"].waitForExistence(timeout: 30))
    anexar(app, "06-pacientes")

    app.staticTexts["Ana Beatriz Teste"].tap()
    XCTAssertTrue(app.staticTexts["Sessões"].waitForExistence(timeout: 15))
    anexar(app, "07-ficha")

    app.staticTexts["Anamnese"].tap()
    sleep(2)
    anexar(app, "08-anamnese")
    app.navigationBars.buttons.firstMatch.tap()

    app.buttons["Marcar sessão"].firstMatch.tap()
    XCTAssertTrue(app.navigationBars["Nova sessão"].waitForExistence(timeout: 10))
    sleep(1)
    anexar(app, "09-nova-sessao")
    app.buttons["Etiqueta"].tap()
    sleep(2)
    anexar(app, "09b-etiquetas")
    XCTAssertTrue(app.buttons["Linguagem"].waitForExistence(timeout: 5))
    app.buttons["Linguagem"].tap()
    sleep(1)
    app.navigationBars["Nova sessão"].buttons.element(boundBy: 1).tap()
    XCTAssertTrue(app.navigationBars["Nova sessão"].waitForNonExistence(timeout: 15))

    app.tabBars.buttons["Conexão"].tap()
    XCTAssertTrue(app.navigationBars["Conexão"].waitForExistence(timeout: 10))
    anexar(app, "10-conexao")

    elemento(app, contendo: "Recepção de teste").tap()
    XCTAssertTrue(app.buttons["Esquecer este computador"].waitForExistence(timeout: 10))
    anexar(app, "12-computador")
    app.navigationBars.buttons.firstMatch.tap()

    elemento(app, contendo: "Acesso pela internet").tap()
    app.buttons["Testar agora"].tap()
    XCTAssertTrue(app.staticTexts["Resposta"].waitForExistence(timeout: 60))
    anexar(app, "13-internet")
  }

  func testPacientesVazio() throws {
    try XCTSkipUnless(ProcessInfo.processInfo.environment["AURI_VAZIO"] != nil, "Só com o servidor vazio")
    let qr = try XCTUnwrap(ProcessInfo.processInfo.environment["AURI_QR"])
    let app = XCUIApplication()
    app.launchEnvironment["AURI_QR"] = qr
    app.launch()

    XCTAssertTrue(app.buttons["Continuar"].waitForExistence(timeout: 10))
    app.buttons["Continuar"].tap()
    XCTAssertTrue(app.tabBars.buttons["Pacientes"].waitForExistence(timeout: 30))
    app.tabBars.buttons["Pacientes"].tap()
    XCTAssertTrue(app.staticTexts["Nenhum paciente"].waitForExistence(timeout: 30))
    anexar(app, "11-pacientes-vazio")
  }

  private func elemento(_ app: XCUIApplication, igual texto: String) -> XCUIElement {
    app.descendants(matching: .any).matching(NSPredicate(format: "label == %@", texto)).firstMatch
  }

  private func elemento(_ app: XCUIApplication, contendo texto: String) -> XCUIElement {
    app.descendants(matching: .any).matching(NSPredicate(format: "label CONTAINS %@", texto)).firstMatch
  }

  private func anexar(_ app: XCUIApplication, _ nome: String) {
    let anexo = XCTAttachment(screenshot: app.screenshot())
    anexo.name = nome
    anexo.lifetime = .keepAlways
    add(anexo)
  }
}
