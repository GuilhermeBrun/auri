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
    permitirNotificacoes()
    let hoje = Date.now.formatted(
      .dateTime.weekday(.wide).day().month(.wide).year().locale(Locale(identifier: "pt_BR"))
    )
    XCTAssertTrue(app.staticTexts[hoje].waitForExistence(timeout: 10))
    sleep(3)
    anexar(app, "02-dia")

    let sessao = elemento(app, contendo: " – ")
    XCTAssertTrue(sessao.waitForExistence(timeout: 10))
    sessao.tap()
    sleep(1)
    anexar(app, "03-sessao")

    app.navigationBars.buttons.firstMatch.tap()
    app.navigationBars.buttons.firstMatch.tap()
    sleep(1)
    anexar(app, "04-mes")
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

    let aviso = springboard.descendants(matching: .any)
      .matching(NSPredicate(format: "label CONTAINS %@", "Recepção marcou")).firstMatch
    XCTAssertTrue(aviso.waitForExistence(timeout: 30))
    anexar(XCUIScreen.main.screenshot(), "14-aviso")
    aviso.tap()
    let amanha = Calendar.current.date(byAdding: .day, value: 1, to: .now)!
      .formatted(.dateTime.weekday(.wide).day().month(.wide).year().locale(Locale(identifier: "pt_BR")))
    XCTAssertTrue(app.staticTexts[amanha].waitForExistence(timeout: 15))
    sleep(1)
    anexar(app, "15-aviso-aberto")

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
    app.navigationBars.buttons.firstMatch.tap()

    elemento(app, contendo: "Avisos").tap()
    XCTAssertTrue(app.switches.firstMatch.waitForExistence(timeout: 10))
    anexar(app, "16-avisos")
    app.navigationBars.buttons.firstMatch.tap()

    elemento(app, contendo: "Face ID").tap()
    XCTAssertTrue(app.switches.firstMatch.waitForExistence(timeout: 10))
    anexar(app, "17-face-id")

    XCUIDevice.shared.press(.home)
    sleep(2)
    app.activate()
    XCTAssertTrue(app.staticTexts["Auri bloqueado"].waitForExistence(timeout: 10))
    sleep(1)
    anexar(XCUIScreen.main.screenshot(), "18-bloqueio")
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

  func testWidgetsNaTelaInicial() throws {
    try XCTSkipIf(ProcessInfo.processInfo.environment["AURI_VAZIO"] != nil, "Precisa dos dados de exemplo")
    XCUIDevice.shared.press(.home)
    sleep(1)
    for tamanho in ["Medium", "Small"] {
      adicionarWidget(tamanho)
    }
    sleep(2)
    anexar(XCUIScreen.main.screenshot(), "19-widgets")
  }

  private func adicionarWidget(_ tamanho: String) {
    springboard.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.62)).press(forDuration: 1.5)
    let editar = springboard.buttons["Edit"]
    if editar.waitForExistence(timeout: 5) { editar.tap() }
    let adicionar = springboard.buttons["Add Widget"]
    XCTAssertTrue(adicionar.waitForExistence(timeout: 5))
    adicionar.tap()
    let busca = springboard.searchFields.firstMatch
    XCTAssertTrue(busca.waitForExistence(timeout: 5))
    busca.tap()
    busca.typeText("Auri")
    let resultado = springboard.cells.containing(NSPredicate(format: "label CONTAINS %@", "Auri")).firstMatch
    XCTAssertTrue(resultado.waitForExistence(timeout: 5))
    resultado.tap()
    sleep(1)
    if tamanho == "Medium" { springboard.swipeLeft() }
    sleep(1)
    anexar(XCUIScreen.main.screenshot(), "19-galeria-\(tamanho)")
    let confirmar = springboard.buttons.matching(NSPredicate(format: "label CONTAINS %@", "Add Widget")).firstMatch
    XCTAssertTrue(confirmar.waitForExistence(timeout: 10))
    confirmar.tap()
    sleep(1)
    let pronto = springboard.buttons["Done"]
    if pronto.waitForExistence(timeout: 3) { pronto.tap() }
    sleep(1)
  }

  private func elemento(_ app: XCUIApplication, igual texto: String) -> XCUIElement {
    app.descendants(matching: .any).matching(NSPredicate(format: "label == %@", texto)).firstMatch
  }

  private func elemento(_ app: XCUIApplication, contendo texto: String) -> XCUIElement {
    app.descendants(matching: .any).matching(NSPredicate(format: "label CONTAINS %@", texto)).firstMatch
  }

  private let springboard = XCUIApplication(bundleIdentifier: "com.apple.springboard")

  private func permitirNotificacoes() {
    let alerta = springboard.alerts.firstMatch
    guard alerta.waitForExistence(timeout: 10) else { return }
    for rotulo in ["Allow", "Permitir"] where alerta.buttons[rotulo].exists {
      alerta.buttons[rotulo].tap()
      return
    }
  }

  private func anexar(_ app: XCUIApplication, _ nome: String) {
    anexar(app.screenshot(), nome)
  }

  private func anexar(_ tela: XCUIScreenshot, _ nome: String) {
    let anexo = XCTAttachment(screenshot: tela)
    anexo.name = nome
    anexo.lifetime = .keepAlways
    add(anexo)
  }
}
