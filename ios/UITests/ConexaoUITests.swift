import XCTest

@MainActor
final class ConexaoUITests: XCTestCase {
  func testPercorreAsTelasConectadoPeloQRCode() throws {
    try XCTSkipIf(ProcessInfo.processInfo.environment["AURI_VAZIO"] != nil, "Precisa dos dados de exemplo")
    let qr = try XCTUnwrap(ProcessInfo.processInfo.environment["AURI_QR"], "Rode com TEST_RUNNER_AURI_QR")
    let app = XCUIApplication()
    app.launchEnvironment["AURI_QR"] = qr
    app.launchEnvironment["AURI_BOOTSTRAP"] = ProcessInfo.processInfo.environment["AURI_BOOTSTRAP"]
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
    app.launchEnvironment["AURI_BOOTSTRAP"] = ProcessInfo.processInfo.environment["AURI_BOOTSTRAP"]
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
    for tamanho in ["Small", "Medium", "Large"] {
      adicionarWidget(tamanho)
    }
    sleep(2)
    anexar(XCUIScreen.main.screenshot(), "19-widgets")
    springboard.swipeLeft()
    sleep(1)
    anexar(XCUIScreen.main.screenshot(), "19-widgets-2")
    springboard.swipeRight()
    sleep(1)

    springboard.buttons["Marcar sessão"].firstMatch.tap()
    let app = XCUIApplication()
    XCTAssertTrue(app.navigationBars["Nova sessão"].waitForExistence(timeout: 30))
    sleep(1)
    anexar(app, "20-mais-do-widget")
    app.navigationBars["Nova sessão"].buttons.firstMatch.tap()

    let atalhos = XCUIApplication(bundleIdentifier: "com.apple.shortcuts")
    atalhos.launch()
    sleep(3)
    for rotulo in ["Continue", "Not Now"] where atalhos.buttons[rotulo].exists {
      atalhos.buttons[rotulo].tap()
      sleep(1)
    }
    if atalhos.navigationBars.buttons.firstMatch.exists { atalhos.navigationBars.buttons.firstMatch.tap() }
    sleep(2)
    anexar(atalhos.screenshot(), "21-atalhos")
    let estrutura = XCTAttachment(string: atalhos.debugDescription)
    estrutura.name = "21-atalhos-estrutura"
    estrutura.lifetime = .keepAlways
    add(estrutura)
    let auri = atalhos.descendants(matching: .any).matching(NSPredicate(format: "label CONTAINS %@", "Auri")).firstMatch
    XCTAssertTrue(auri.waitForExistence(timeout: 10))
    auri.tap()
    sleep(2)
    anexar(atalhos.screenshot(), "22-atalhos-auri")
    let marcar = atalhos.descendants(matching: .any).matching(NSPredicate(format: "label CONTAINS %@", "Marcar sessão"))
      .firstMatch
    XCTAssertTrue(marcar.waitForExistence(timeout: 10))
    marcar.tap()
    let ana = springboard.descendants(matching: .any).matching(NSPredicate(format: "label CONTAINS %@", "Ana Beatriz"))
      .firstMatch
    let anaNoApp = atalhos.descendants(matching: .any).matching(NSPredicate(format: "label CONTAINS %@", "Ana Beatriz"))
      .firstMatch
    let apareceu = ana.waitForExistence(timeout: 30) || anaNoApp.waitForExistence(timeout: 5)
    anexar(XCUIScreen.main.screenshot(), "23-atalho-paciente")
    XCTAssertTrue(apareceu)
    (ana.exists ? ana : anaNoApp).tap()
    sleep(2)
    let proximoMes =
      springboard.buttons["Next Month"].exists ? springboard.buttons["Next Month"] : atalhos.buttons["Next Month"]
    if proximoMes.exists {
      proximoMes.tap()
      sleep(1)
      let calendario = Calendar(identifier: .gregorian)
      let mes = calendario.date(byAdding: .month, value: 1, to: .now)!
      let quarta = (10...16).first { dia in
        var partes = calendario.dateComponents([.year, .month], from: mes)
        partes.day = dia
        return calendario.component(.weekday, from: calendario.date(from: partes)!) == 4
      }!
      let rotulo = String(quarta)
      let dia = springboard.staticTexts[rotulo].exists ? springboard.staticTexts[rotulo] : atalhos.staticTexts[rotulo]
      if dia.exists { dia.tap() }
    }
    sleep(1)
    anexar(XCUIScreen.main.screenshot(), "24-atalho-inicio")
    for rotulo in ["Done", "Concluído", "OK"] {
      let botao = springboard.buttons[rotulo].exists ? springboard.buttons[rotulo] : atalhos.buttons[rotulo]
      if botao.exists {
        botao.tap()
        break
      }
    }
    let marcada = springboard.descendants(matching: .any).matching(
      NSPredicate(format: "label CONTAINS %@", "marcada para")
    ).firstMatch
    let marcadaNoApp = atalhos.descendants(matching: .any).matching(
      NSPredicate(format: "label CONTAINS %@", "marcada para")
    ).firstMatch
    sleep(2)
    anexar(XCUIScreen.main.screenshot(), "25a-atalho-depois")
    let terminou = marcada.waitForExistence(timeout: 40) || marcadaNoApp.waitForExistence(timeout: 5)
    anexar(XCUIScreen.main.screenshot(), "25-atalho-marcou")
    XCTAssertTrue(terminou)
  }

  private func adicionarWidget(_ tamanho: String) {
    let adicionar = springboard.buttons["Add Widget"]
    for ponto in [0.72, 0.62, 0.78] where !adicionar.exists {
      XCUIDevice.shared.press(.home)
      sleep(1)
      springboard.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: ponto)).press(forDuration: 1.5)
      let editar = springboard.buttons["Edit"]
      if editar.waitForExistence(timeout: 3) { editar.tap() }
      _ = adicionar.waitForExistence(timeout: 3)
    }
    XCTAssertTrue(adicionar.exists)
    adicionar.tap()
    let busca = springboard.searchFields.firstMatch
    XCTAssertTrue(busca.waitForExistence(timeout: 5))
    busca.tap()
    busca.typeText("Auri")
    let resultado = springboard.cells.containing(NSPredicate(format: "label CONTAINS %@", "Auri")).firstMatch
    XCTAssertTrue(resultado.waitForExistence(timeout: 5))
    resultado.tap()
    sleep(1)
    for _ in 0..<(["Small": 0, "Medium": 1, "Large": 2][tamanho] ?? 0) {
      springboard.swipeLeft()
      sleep(1)
    }
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
