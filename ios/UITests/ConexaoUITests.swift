import XCTest

@MainActor
final class ConexaoUITests: XCTestCase {
  private let springboard = XCUIApplication(bundleIdentifier: "com.apple.springboard")
  private var ultimaTela = ""
  private var ambiente: [String: String] { ProcessInfo.processInfo.environment }

  override func setUp() async throws {
    continueAfterFailure = false
    try XCTSkipIf(ambiente["AURI_VAZIO"] != nil && name.contains("Vazio") == false, "Precisa dos dados de exemplo")
  }

  func test01BoasVindasEPareamento() throws {
    let app = try aplicativo(bloqueio: false)
    app.launch()
    XCTAssertTrue(elemento(app, contendo: "Boas-vindas ao Auri").waitForExistence(timeout: 15))
    anexar(app, "01-boas-vindas")
    try auditar(app)
    tocar(app.buttons["Continuar"], "Continuar")
    XCTAssertTrue(app.tabBars.buttons["Pacientes"].waitForExistence(timeout: 30))
    permitirNotificacoes()
  }

  func test02Agenda() throws {
    let app = try abrirConectado()
    let hoje = Date.now.formatted(
      .dateTime.weekday(.wide).day().month(.wide).year().locale(Locale(identifier: "pt_BR")))
    XCTAssertTrue(app.staticTexts[hoje].waitForExistence(timeout: 15))
    sleep(2)
    anexar(app, "02-dia")
    linhaDoTempo(app).swipeDown(velocity: .slow)
    sleep(1)
    anexar(app, "02b-dia-manha")
    linhaDoTempo(app).swipeUp(velocity: .fast)
    linhaDoTempo(app).swipeUp(velocity: .fast)
    linhaDoTempo(app).swipeUp(velocity: .fast)
    try auditar(app)

    tocar(naTela(app, contendo: " – "), "sessão na linha do tempo")
    XCTAssertTrue(app.staticTexts["Etiqueta"].waitForExistence(timeout: 10))
    anexar(app, "03-sessao")
    try auditar(app)

    voltar(app)
    voltar(app)
    let mes = Date.now.formatted(.dateTime.month(.wide).locale(Locale(identifier: "pt_BR"))).capitalized
    XCTAssertTrue(app.staticTexts[mes].waitForExistence(timeout: 10))
    anexar(app, "04-mes")
    try auditar(app)
    voltar(app)
    sleep(1)
    anexar(app, "05-ano")
  }

  func test03Pacientes() throws {
    let app = try abrirConectado()
    tocar(app.tabBars.buttons["Pacientes"], "aba Pacientes")
    XCTAssertTrue(app.staticTexts["Ana Beatriz Teste"].waitForExistence(timeout: 30))
    anexar(app, "06-pacientes")
    try auditar(app)

    tocar(app.staticTexts["Ana Beatriz Teste"], "Ana Beatriz Teste")
    XCTAssertTrue(app.staticTexts["Sessões"].waitForExistence(timeout: 15))
    anexar(app, "07-ficha")
    try auditar(app)

    tocar(app.staticTexts["Anamnese"], "Anamnese")
    XCTAssertTrue(app.staticTexts["Queixa"].waitForExistence(timeout: 15))
    anexar(app, "08-anamnese")
    try auditar(app)
  }

  func test04NovaSessaoEAvisoDaRecepcao() throws {
    let app = try abrirConectado()
    tocar(app.tabBars.buttons["Pacientes"], "aba Pacientes")
    tocar(app.staticTexts["Ana Beatriz Teste"], "Ana Beatriz Teste")
    XCTAssertTrue(app.staticTexts["Sessões"].waitForExistence(timeout: 15))
    tocar(app.buttons["agendar"], "agendar")
    XCTAssertTrue(app.navigationBars["Nova sessão"].waitForExistence(timeout: 10))
    sleep(1)
    anexar(app, "09-nova-sessao")
    try auditar(app)

    tocar(app.buttons["Etiqueta"], "Etiqueta")
    XCTAssertTrue(app.buttons["Linguagem"].waitForExistence(timeout: 5))
    anexar(app, "09b-etiquetas")
    tocar(app.buttons["Linguagem"], "Linguagem")
    tocar(app.navigationBars["Nova sessão"].buttons.element(boundBy: 1), "Marcar")
    XCTAssertTrue(app.navigationBars["Nova sessão"].waitForNonExistence(timeout: 15))

    let aviso = try XCTUnwrap(visivel(contendo: "Recepção marcou", em: springboard, ate: 30), "o aviso não apareceu")
    anexar(XCUIScreen.main.screenshot(), "14-aviso")
    aviso.tap()
    let amanha = Calendar.current.date(byAdding: .day, value: 1, to: .now)!
    let aberto =
      Calendar.current.component(.weekday, from: amanha) == 1
      ? Calendar.current.date(byAdding: .day, value: 1, to: amanha)! : amanha
    let dia = aberto.formatted(
      .dateTime.weekday(.wide).day().month(.wide).year().locale(Locale(identifier: "pt_BR")))
    XCTAssertTrue(app.staticTexts[dia].waitForExistence(timeout: 15))
    sleep(1)
    anexar(app, "15-aviso-aberto")
  }

  func test05Conexao() throws {
    let app = try abrirConectado()
    tocar(app.tabBars.buttons["Conexão"], "aba Conexão")
    XCTAssertTrue(app.navigationBars["Conexão"].waitForExistence(timeout: 10))
    anexar(app, "10-conexao")
    try auditar(app)

    tocar(elemento(app, contendo: "Recepção de teste"), "computador")
    XCTAssertTrue(app.buttons["Esquecer este computador"].waitForExistence(timeout: 10))
    anexar(app, "12-computador")
    try auditar(app)
    voltar(app)

    tocar(elemento(app, contendo: "Acesso pela internet"), "Acesso pela internet")
    tocar(app.buttons["Testar agora"], "Testar agora")
    XCTAssertTrue(app.staticTexts["Resposta"].waitForExistence(timeout: 60))
    anexar(app, "13-internet")
    try auditar(app)
    voltar(app)

    tocar(elemento(app, contendo: "Avisos"), "Avisos")
    XCTAssertTrue(app.switches.firstMatch.waitForExistence(timeout: 10))
    anexar(app, "16-avisos")
    try auditar(app)
  }

  func test06FaceID() throws {
    let app = try aplicativo(bloqueio: true)
    app.launch()
    XCTAssertTrue(app.staticTexts["Auri bloqueado"].waitForExistence(timeout: 15))
    sleep(1)
    anexar(XCUIScreen.main.screenshot(), "18-bloqueio")
    print("rosto: ligar")
    XCTAssertTrue(app.staticTexts["Auri bloqueado"].waitForNonExistence(timeout: 30))
    tocar(app.tabBars.buttons["Conexão"], "aba Conexão")
    tocar(elemento(app, contendo: "Face ID"), "Face ID")
    XCTAssertTrue(app.switches.firstMatch.waitForExistence(timeout: 10))
    anexar(app, "17-face-id")
    try auditar(app)
  }

  func test07Widgets() throws {
    XCUIDevice.shared.press(.home)
    fecharRespostaDaSiri()
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

    tocar(springboard.buttons["Marcar sessão"].firstMatch, "+ do widget")
    let app = XCUIApplication()
    XCTAssertTrue(app.navigationBars["Nova sessão"].waitForExistence(timeout: 30))
    sleep(1)
    anexar(app, "20-mais-do-widget")
    tocar(app.navigationBars["Nova sessão"].buttons.firstMatch, "fechar")
  }

  func test08MarcarPelosAtalhos() throws {
    let hora = Calendar.current.component(.hour, from: .now)
    try XCTSkipIf(hora < 7 || hora >= 19, "Os Atalhos sugerem a hora atual, fora do horário da clínica agora.")
    let atalhos = XCUIApplication(bundleIdentifier: "com.apple.shortcuts")
    atalhos.launch()
    sleep(2)
    for rotulo in ["Continue", "Not Now"] where atalhos.buttons[rotulo].exists {
      atalhos.buttons[rotulo].tap()
      sleep(1)
    }
    if atalhos.navigationBars.buttons.firstMatch.exists { atalhos.navigationBars.buttons.firstMatch.tap() }
    tocar(elemento(atalhos, contendo: "Auri"), "Auri nos Atalhos")
    sleep(1)
    anexar(atalhos.screenshot(), "22-atalhos-auri")
    tocar(elemento(atalhos, contendo: "Marcar sessão"), "Marcar sessão")

    let ana = qualquer(contendo: "Ana Beatriz", em: [springboard, atalhos])
    XCTAssertTrue(ana.waitForExistence(timeout: 30))
    anexar(XCUIScreen.main.screenshot(), "23-atalho-paciente")
    ana.tap()
    sleep(2)
    let proximoMes = qualquer(contendo: "Next Month", em: [springboard, atalhos])
    if proximoMes.waitForExistence(timeout: 5) {
      proximoMes.tap()
      sleep(1)
      let dia = qualquer(igual: String(Self.quartaDoMesQueVem()), em: [springboard, atalhos])
      if dia.exists { dia.tap() }
    }
    sleep(1)
    anexar(XCUIScreen.main.screenshot(), "24-atalho-inicio")
    tocar(qualquer(igual: "Done", em: [springboard, atalhos]), "Done")
    let marcada = qualquer(contendo: "marcada para", em: [springboard, atalhos])
    XCTAssertTrue(marcada.waitForExistence(timeout: 45))
    anexar(XCUIScreen.main.screenshot(), "25-atalho-marcou")
    fecharRespostaDaSiri()
  }

  private func fecharRespostaDaSiri() {
    let pronto = springboard.buttons["Done"]
    if pronto.waitForExistence(timeout: 2) {
      pronto.tap()
      sleep(1)
    }
  }

  func test09TextoGrande() throws {
    let app = try aplicativo(bloqueio: false)
    app.launchArguments += ["-UIPreferredContentSizeCategoryName", "UICTContentSizeCategoryAccessibilityXXXL"]
    app.launch()
    XCTAssertTrue(app.tabBars.buttons["Agenda"].waitForExistence(timeout: 30))
    XCTAssertTrue(elemento(app, contendo: " – ").waitForExistence(timeout: 15), "o dia em lista mostra as sessões")
    anexar(app, "26-texto-grande-dia")
    try auditar(app)
    tocar(app.tabBars.buttons["Pacientes"], "aba Pacientes")
    XCTAssertTrue(app.staticTexts["Ana Beatriz Teste"].waitForExistence(timeout: 30))
    anexar(app, "27-texto-grande-pacientes")
    tocar(app.tabBars.buttons["Conexão"], "aba Conexão")
    XCTAssertTrue(app.navigationBars["Conexão"].waitForExistence(timeout: 10))
    anexar(app, "28-texto-grande-conexao")
  }

  func test10ArrastarSessao() throws {
    let app = try abrirConectado()
    let calendario = Calendar.current
    let pt = Locale(identifier: "pt_BR")
    var diaDoRui = calendario.date(byAdding: .day, value: 1, to: .now)!
    if calendario.component(.weekday, from: diaDoRui) == 1 {
      diaDoRui = calendario.date(byAdding: .day, value: 1, to: diaDoRui)!
    }
    let cabecalho = diaDoRui.formatted(.dateTime.weekday(.wide).day().month(.wide).year().locale(pt))
    for _ in 0..<4 where !app.staticTexts[cabecalho].exists {
      linhaDoTempo(app).swipeLeft()
      sleep(1)
    }
    XCTAssertTrue(app.staticTexts[cabecalho].waitForExistence(timeout: 5), "não chegou ao dia do Rui")
    let rui = NSPredicate(format: "label BEGINSWITH %@", "Rui Arrastável,")
    let sessao = app.descendants(matching: .any).matching(rui).firstMatch
    XCTAssertTrue(sessao.waitForExistence(timeout: 15), "sem a sessão de arrastar")
    for _ in 0..<6 where !sessao.isHittable {
      linhaDoTempo(app).swipeDown()
    }
    let hora = try XCTUnwrap(sessao.label.matches(of: /(\d\d):(\d\d)/).compactMap { Int($0.output.1) }.first)
    let centro = sessao.coordinate(withNormalizedOffset: CGVector(dx: 0.3, dy: 0.5))
    centro.press(
      forDuration: 1.2, thenDragTo: centro.withOffset(CGVector(dx: 0, dy: 15)), withVelocity: .slow,
      thenHoldForDuration: 0.8)
    let antes = String(format: "%02d:00 – %02d:30", hora, hora)
    let movida = app.descendants(matching: .any)
      .matching(
        NSPredicate(
          format: "label BEGINSWITH %@ AND NOT (label CONTAINS %@) AND (label CONTAINS %@ OR label CONTAINS %@)",
          "Rui Arrastável,", antes, String(format: "%02d:15", hora), String(format: "%02d:30", hora))
      )
      .firstMatch
    XCTAssertTrue(movida.waitForExistence(timeout: 15), "a sessão não saiu de \(antes)")
    anexar(app, "29-arrastada")

    let seguinte = calendario.date(byAdding: .day, value: 1, to: diaDoRui)!
    guard (2...6).contains(calendario.component(.weekday, from: seguinte)),
      calendario.isDate(seguinte, equalTo: diaDoRui, toGranularity: .weekOfYear)
    else { return }
    let rotulo = seguinte.formatted(.dateTime.weekday(.wide).day().month(.wide).locale(pt))
    let diaSeguinte = app.buttons[rotulo]
    XCTAssertTrue(diaSeguinte.waitForExistence(timeout: 5))
    let origem = movida.coordinate(withNormalizedOffset: CGVector(dx: 0.3, dy: 0.5))
    origem.press(
      forDuration: 1.2, thenDragTo: diaSeguinte.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5)),
      withVelocity: .slow, thenHoldForDuration: 0.3)
    XCTAssertTrue(sumiu(app, rui, ate: 15), "a sessão continuou no mesmo dia")
    diaSeguinte.tap()
    XCTAssertTrue(movida.waitForExistence(timeout: 15), "a sessão não apareceu no dia seguinte")
  }

  func test11DeslizarDias() throws {
    let app = try abrirConectado()
    let cabecalho = { (dias: Int) -> XCUIElement in
      let dia = Calendar.current.date(byAdding: .day, value: dias, to: .now)!
      return app.staticTexts[
        dia.formatted(.dateTime.weekday(.wide).day().month(.wide).year().locale(Locale(identifier: "pt_BR")))]
    }
    XCTAssertTrue(cabecalho(0).waitForExistence(timeout: 15))
    linhaDoTempo(app).swipeLeft()
    XCTAssertTrue(cabecalho(1).waitForExistence(timeout: 5), "deslizar para a esquerda não foi para o dia seguinte")
    linhaDoTempo(app).swipeRight()
    XCTAssertTrue(cabecalho(0).waitForExistence(timeout: 5), "deslizar para a direita não voltou um dia")
    linhaDoTempo(app).swipeRight()
    XCTAssertTrue(cabecalho(-1).waitForExistence(timeout: 5), "deslizar para a direita saiu do dia")
    let borda = app.coordinate(withNormalizedOffset: CGVector(dx: 0.01, dy: 0.6))
    borda.press(
      forDuration: 0.05, thenDragTo: app.coordinate(withNormalizedOffset: CGVector(dx: 0.8, dy: 0.6)),
      withVelocity: .fast, thenHoldForDuration: 0)
    XCTAssertTrue(cabecalho(-2).waitForExistence(timeout: 5), "deslizar da borda saiu do dia")
    anexar(app, "30-dia-deslizado")
    tocar(app.buttons["Hoje"], "Hoje")
    XCTAssertTrue(cabecalho(0).waitForExistence(timeout: 5))
    let ateDomingo = 8 - Calendar.current.component(.weekday, from: .now)
    for _ in 0..<ateDomingo { linhaDoTempo(app).swipeLeft() }
    XCTAssertTrue(cabecalho(ateDomingo).waitForExistence(timeout: 5), "não chegou ao domingo")
    let domingo = Calendar.current.date(byAdding: .day, value: ateDomingo, to: .now)!
    let naFaixa = app.buttons[
      domingo.formatted(.dateTime.weekday(.wide).day().month(.wide).locale(Locale(identifier: "pt_BR")))]
    XCTAssertTrue(
      app.frame.contains(CGPoint(x: naFaixa.frame.midX, y: naFaixa.frame.midY)), "a faixa não foi para a semana do dia")
    tocar(app.buttons["Hoje"], "Hoje")
    XCTAssertTrue(cabecalho(0).waitForExistence(timeout: 5))
    deslizarFaixa(app, paraEsquerda: true)
    XCTAssertTrue(cabecalho(7).waitForExistence(timeout: 5), "a faixa da semana não foi para a semana seguinte")
    anexar(app, "31-semana-seguinte")
    deslizarFaixa(app, paraEsquerda: false)
    XCTAssertTrue(cabecalho(0).waitForExistence(timeout: 5), "a faixa da semana não voltou")
  }

  func test99PacientesVazio() throws {
    try XCTSkipUnless(ambiente["AURI_VAZIO"] != nil, "Só com o servidor vazio")
    let app = try abrirConectado()
    tocar(app.tabBars.buttons["Pacientes"], "aba Pacientes")
    XCTAssertTrue(app.staticTexts["Nenhum paciente"].waitForExistence(timeout: 30))
    anexar(app, "11-pacientes-vazio")
    try auditar(app)
  }

  private func aplicativo(bloqueio: Bool) throws -> XCUIApplication {
    let app = XCUIApplication()
    app.launchEnvironment["AURI_QR"] = try XCTUnwrap(ambiente["AURI_QR"], "Rode pelo scripts/telas.sh")
    app.launchEnvironment["AURI_BOOTSTRAP"] = ambiente["AURI_BOOTSTRAP"]
    if !bloqueio { app.launchArguments += ["-bloqueio", "NO"] }
    return app
  }

  private func abrirConectado() throws -> XCUIApplication {
    let app = try aplicativo(bloqueio: false)
    app.launch()
    let continuar = app.buttons["Continuar"]
    if continuar.waitForExistence(timeout: 3) {
      continuar.tap()
      XCTAssertTrue(app.tabBars.buttons["Pacientes"].waitForExistence(timeout: 30))
      permitirNotificacoes()
    }
    XCTAssertTrue(app.tabBars.buttons["Agenda"].waitForExistence(timeout: 30))
    return app
  }

  private func visivel(contendo texto: String, em app: XCUIApplication, ate segundos: Double) -> XCUIElement? {
    let fim = Date.now.addingTimeInterval(segundos)
    while Date.now < fim {
      let achados = app.descendants(matching: .any).matching(NSPredicate(format: "label CONTAINS %@", texto))
      if let alvo = achados.allElementsBoundByIndex.first(where: { $0.isHittable }) { return alvo }
      sleep(1)
    }
    return nil
  }

  private func auditar(_ app: XCUIApplication, tentativa: Int = 1) throws {
    do {
      try auditarUmaVez(app)
    } catch let erro as NSError where erro.domain == "com.apple.accessibilityAudit" && tentativa < 3 {
      sleep(2)
      try auditar(app, tentativa: tentativa + 1)
    }
  }

  private func auditarUmaVez(_ app: XCUIApplication) throws {
    let tela = ultimaTela
    sleep(1)
    let tipos: XCUIAccessibilityAuditType = [
      .elementDetection, .hitRegion, .sufficientElementDescription, .textClipped, .trait,
    ]
    try app.performAccessibilityAudit(for: tipos) { problema in
      let rotulo = problema.element?.label ?? ""
      let doSistema = problema.auditType == .hitRegion && rotulo == "Índice de seção"
      if !doSistema {
        let detalhe = problema.element?.debugDescription.replacingOccurrences(of: "\n", with: " ") ?? "?"
        print(
          "acessibilidade: \(tela) | \(problema.compactDescription) | \(rotulo) | \(detalhe) | \(problema.detailedDescription)"
        )
      }
      return doSistema
    }
  }

  private func linhaDoTempo(_ app: XCUIApplication) -> XCUIElement {
    app.scrollViews["linha-do-tempo"]
  }

  private func deslizarFaixa(_ app: XCUIApplication, paraEsquerda: Bool) {
    let faixa = app.scrollViews["faixa-da-semana"].frame
    let origem = app.coordinate(withNormalizedOffset: .zero)
    let esquerda = origem.withOffset(CGVector(dx: faixa.minX + 40, dy: faixa.maxY - 25))
    let direita = origem.withOffset(CGVector(dx: faixa.maxX - 40, dy: faixa.maxY - 25))
    (paraEsquerda ? direita : esquerda).press(
      forDuration: 0.05, thenDragTo: paraEsquerda ? esquerda : direita, withVelocity: .fast, thenHoldForDuration: 0)
  }

  private func tocar(_ alvo: XCUIElement, _ nome: String) {
    XCTAssertTrue(alvo.waitForExistence(timeout: 15), "\(nome) não apareceu")
    alvo.tap()
  }

  private func voltar(_ app: XCUIApplication) {
    tocar(app.navigationBars.buttons.firstMatch, "voltar")
  }

  private func permitirNotificacoes() {
    let alerta = springboard.alerts.firstMatch
    guard alerta.waitForExistence(timeout: 10) else { return }
    for rotulo in ["Allow", "Permitir"] where alerta.buttons[rotulo].exists {
      alerta.buttons[rotulo].tap()
      return
    }
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
    tocar(adicionar, "Add Widget")
    let busca = springboard.searchFields.firstMatch
    if !busca.waitForExistence(timeout: 10) {
      anexar(XCUIScreen.main.screenshot(), "19-galeria-sem-busca")
      XCUIDevice.shared.press(.home)
      sleep(1)
      return adicionarWidget(tamanho)
    }
    tocar(busca, "busca de widgets")
    XCTAssertTrue(springboard.keyboards.firstMatch.waitForExistence(timeout: 5), "o teclado da busca não abriu")
    springboard.typeText("Auri")
    tocar(springboard.cells.containing(NSPredicate(format: "label CONTAINS %@", "Auri")).firstMatch, "Auri na galeria")
    sleep(1)
    for _ in 0..<(["Small": 0, "Medium": 1, "Large": 2][tamanho] ?? 0) {
      springboard.swipeLeft()
      sleep(1)
    }
    anexar(XCUIScreen.main.screenshot(), "19-galeria-\(tamanho)")
    tocar(
      springboard.buttons.matching(NSPredicate(format: "label CONTAINS %@", "Add Widget")).firstMatch,
      "Add Widget da galeria")
    sleep(1)
    let pronto = springboard.buttons["Done"]
    if pronto.waitForExistence(timeout: 3) { pronto.tap() }
    sleep(1)
  }

  private static func quartaDoMesQueVem() -> Int {
    let calendario = Calendar(identifier: .gregorian)
    let mes = calendario.date(byAdding: .month, value: 1, to: .now)!
    return (10...16).first { dia in
      var partes = calendario.dateComponents([.year, .month], from: mes)
      partes.day = dia
      return calendario.component(.weekday, from: calendario.date(from: partes)!) == 4
    }!
  }

  private func naTela(_ app: XCUIApplication, contendo texto: String) -> XCUIElement {
    let candidatos = app.descendants(matching: .any).matching(NSPredicate(format: "label CONTAINS %@", texto))
    return candidatos.allElementsBoundByIndex.first { app.frame.contains(CGPoint(x: $0.frame.midX, y: $0.frame.midY)) }
      ?? candidatos.firstMatch
  }

  private func sumiu(_ app: XCUIApplication, _ predicado: NSPredicate, ate segundos: Double) -> Bool {
    let fim = Date.now.addingTimeInterval(segundos)
    while Date.now < fim {
      let naTela = app.descendants(matching: .any).matching(predicado).allElementsBoundByIndex.contains {
        app.frame.contains(CGPoint(x: $0.frame.midX, y: $0.frame.midY))
      }
      if !naTela { return true }
      sleep(1)
    }
    return false
  }

  private func elemento(_ app: XCUIApplication, contendo texto: String) -> XCUIElement {
    app.descendants(matching: .any).matching(NSPredicate(format: "label CONTAINS %@", texto)).firstMatch
  }

  private func qualquer(contendo texto: String, em apps: [XCUIApplication]) -> XCUIElement {
    let candidatos = apps.map { elemento($0, contendo: texto) }
    return candidatos.first { $0.exists } ?? candidatos[0]
  }

  private func qualquer(igual texto: String, em apps: [XCUIApplication]) -> XCUIElement {
    let candidatos = apps.map {
      $0.descendants(matching: .any).matching(NSPredicate(format: "label == %@", texto)).firstMatch
    }
    return candidatos.first { $0.exists } ?? candidatos[0]
  }

  private func anexar(_ app: XCUIApplication, _ nome: String) {
    anexar(app.screenshot(), nome)
  }

  private func anexar(_ tela: XCUIScreenshot, _ nome: String) {
    let anexo = XCTAttachment(screenshot: tela)
    ultimaTela = nome
    anexo.name = nome
    anexo.lifetime = .keepAlways
    add(anexo)
  }
}
