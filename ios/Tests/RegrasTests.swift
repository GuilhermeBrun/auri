import XCTest

@testable import Auri

final class RegrasTests: XCTestCase {
  private func hora(_ texto: String) -> Date {
    DataLocal.data("2026-10-22T\(texto)")!
  }

  private func sessao(
    _ id: Int, _ inicio: String, _ fim: String, paciente: String = "Ana Beatriz Teste", presenca: String = "",
    confirmadoEm: String? = nil, assinatura: Assinatura? = nil, pedido: Pedido? = nil
  ) -> Evento {
    Evento(
      Sessao(
        id: id, patientId: 1, patientNome: paciente, inicio: "2026-10-22T\(inicio)", fim: "2026-10-22T\(fim)",
        observacao: nil, tipoId: 2, tipoNome: "Linguagem", tipoCor: "#7c3aed", categoria: "sessao",
        presenca: presenca, evolucao: nil, confirmadoEm: confirmadoEm, assinatura: assinatura, pedido: pedido))!
  }

  func testMarcasDoCardComoNoDesktop() {
    XCTAssertEqual(sessao(1, "09:00", "09:45").marcas, [])
    XCTAssertEqual(sessao(1, "09:00", "09:45", confirmadoEm: "2026-10-21 10:00").marcas, [.confirmada])
    XCTAssertEqual(
      sessao(1, "09:00", "09:45", confirmadoEm: "2026-10-21 10:00", assinatura: Assinatura(signerNome: "Mãe"))
        .marcas, [.assinada])
    XCTAssertEqual(
      sessao(1, "09:00", "09:45", pedido: Pedido(estado: "aguardando", prazo: "2026-10-21T18:00")).marcas,
      [.aguardando(ate: "18:00")])
    XCTAssertEqual(
      sessao(1, "09:00", "09:45", pedido: Pedido(estado: "sem_resposta", prazo: "2026-10-21T18:00")).marcas,
      [.semResposta])
    XCTAssertTrue(sessao(1, "09:00", "09:45", presenca: "falta").faltou)
    XCTAssertTrue(sessao(1, "09:00", "09:45", presenca: "desmarcou").faltou)
    XCTAssertFalse(sessao(1, "09:00", "09:45", presenca: "presente").faltou)
    XCTAssertEqual(
      sessao(1, "09:00", "09:45", presenca: "falta", confirmadoEm: "2026-10-21 10:00").descricao(idade: 7),
      "Ana Beatriz Teste, 09:00 – 09:45, Linguagem, Faltou, Confirmado, Faz 7 anos neste dia")
  }

  func testSoArrastaSessaoFuturaESemAssinatura() {
    let antes = hora("08:00")
    XCTAssertTrue(sessao(1, "09:00", "09:45").podeArrastar(agora: antes))
    XCTAssertFalse(sessao(1, "09:00", "09:45").podeArrastar(agora: hora("09:00")))
    XCTAssertFalse(sessao(1, "09:00", "09:45").podeArrastar(agora: hora("10:00")))
    XCTAssertFalse(
      sessao(1, "09:00", "09:45", assinatura: Assinatura(signerNome: "Mãe")).podeArrastar(agora: antes))
    let compromisso = Evento(
      Compromisso(
        id: 9, etiquetaNome: "Palestra", titulo: "Reunião", cor: "#0d9488", inicio: "2026-10-22T17:00",
        fim: "2026-10-22T18:00", observacao: nil))!
    XCTAssertFalse(compromisso.podeArrastar(agora: antes))
    XCTAssertEqual(sessao(1, "09:00", "09:45").horario, "09:00 – 09:45")
  }

  func testAniversarioNoDiaDaSessao() {
    XCTAssertEqual(Paciente.idadeQueCompleta("2019-10-22", em: hora("09:00")), 7)
    XCTAssertNil(Paciente.idadeQueCompleta("2019-10-23", em: hora("09:00")))
    XCTAssertNil(Paciente.idadeQueCompleta("2026-10-22", em: hora("09:00")))
    XCTAssertNil(Paciente.idadeQueCompleta(nil, em: hora("09:00")))
    let fevereiro = DataLocal.data("2027-02-28T09:00")!
    XCTAssertEqual(Paciente.idadeQueCompleta("2020-02-29", em: fevereiro), 7)
  }

  func testHorarioDaClinica() throws {
    let json = Data(#"{"nome":"Clínica","funcionamento":{"4":{"abre":"07:00","fecha":"20:00"}}}"#.utf8)
    let decodificador = JSONDecoder()
    decodificador.keyDecodingStrategy = .convertFromSnakeCase
    let clinica = try decodificador.decode(Clinica.self, from: json)
    let quinta = hora("09:00")
    XCTAssertEqual(clinica.horario(em: quinta)?.abre, 7 * 60)
    XCTAssertEqual(clinica.horario(em: quinta)?.fecha, 20 * 60)
    XCTAssertNil(clinica.horario(em: DataLocal.somar(.day, 1, a: quinta)))
  }

  func testSessoesSobrepostasDividemAsColunas() {
    let a = sessao(1, "09:00", "10:00")
    let b = sessao(2, "09:30", "10:30")
    let c = sessao(3, "10:00", "11:00")
    let d = sessao(4, "14:00", "14:45")
    let colunas = [d, c, b, a].emColunas()
    let porId = Dictionary(uniqueKeysWithValues: colunas.map { ($0.evento.id, ($0.coluna, $0.total)) })
    XCTAssertEqual(porId["s1"]?.0, 0)
    XCTAssertEqual(porId["s2"]?.0, 1)
    XCTAssertEqual(porId["s3"]?.0, 0)
    XCTAssertEqual(porId["s1"]?.1, 2)
    XCTAssertEqual(porId["s4"]?.0, 0)
    XCTAssertEqual(porId["s4"]?.1, 1)
  }

  func testListaDePacientesPorLetraComAcentos() {
    let nomes = ["Bruno Exemplo", "Érica Teste", "ana Clara", "Álvaro Teste", "123 Sem Nome"]
    let pacientes = nomes.enumerated().map { indice, nome in
      Paciente(
        id: indice, nome: nome, dataNascimento: nil, celular: nil, email: nil, escola: nil, serie: nil,
        professora: nil, maeNome: nil, maeCelular: nil, paiNome: nil, paiCelular: nil, respTipo: nil,
        respNome: nil, respCelular: nil)
    }
    let secoes = Paciente.secoes(pacientes)
    XCTAssertEqual(secoes.map(\.letra), ["A", "B", "E", "#"])
    XCTAssertEqual(secoes[0].pacientes.map(\.nome), ["Álvaro Teste", "ana Clara"])
    XCTAssertEqual(Paciente.filtrar(pacientes, busca: "alvaro").map(\.nome), ["Álvaro Teste"])
    XCTAssertEqual(Paciente.filtrar(pacientes, busca: "  ").count, 5)
  }

  func testIniciaisDoAvatar() {
    XCTAssertEqual(Paciente.iniciais("Ana Beatriz Teste"), "AT")
    XCTAssertEqual(Paciente.iniciais("Ana de Souza"), "AS")
    XCTAssertEqual(Paciente.iniciais("Alice"), "A")
  }

  func testHorarioSugeridoParaNovaSessao() {
    let agora = hora("14:11")
    let calendario = DataLocal.calendario
    XCTAssertEqual(DataLocal.texto(NovaSessaoView.horarioSugerido(nil, agora: agora)), "2026-10-22T15:00")
    let amanha = calendario.date(byAdding: .day, value: 1, to: agora)!
    XCTAssertEqual(DataLocal.texto(NovaSessaoView.horarioSugerido(amanha, agora: agora)), "2026-10-23T09:00")
    let json = Data(
      #"{"nome":"","funcionamento":{"4":{"abre":"07:00","fecha":"20:00"},"5":{"abre":"08:00","fecha":"20:00"}}}"#.utf8)
    let decodificador = JSONDecoder()
    decodificador.keyDecodingStrategy = .convertFromSnakeCase
    let clinica = try! decodificador.decode(Clinica.self, from: json)
    XCTAssertEqual(
      DataLocal.texto(NovaSessaoView.horarioSugerido(nil, agora: agora, clinica: clinica)), "2026-10-22T15:00")
    XCTAssertEqual(
      DataLocal.texto(NovaSessaoView.horarioSugerido(nil, agora: hora("19:40"), clinica: clinica)),
      "2026-10-23T08:00")
    XCTAssertEqual(
      DataLocal.texto(NovaSessaoView.horarioSugerido(nil, agora: hora("05:10"), clinica: clinica)),
      "2026-10-22T07:00")
    XCTAssertEqual(
      DataLocal.texto(NovaSessaoView.horarioSugerido(amanha, agora: agora, clinica: clinica)), "2026-10-23T09:00")
    let tarde = try! decodificador.decode(
      Clinica.self, from: Data(#"{"nome":"","funcionamento":{"5":{"abre":"13:00","fecha":"19:00"}}}"#.utf8))
    XCTAssertEqual(
      DataLocal.texto(NovaSessaoView.horarioSugerido(amanha, agora: agora, clinica: tarde)), "2026-10-23T13:00")
  }

  func testIntervaloParaPedirOFaceIDDeNovo() {
    let saida = hora("10:00")
    XCTAssertTrue(Bloqueio.Intervalo.imediatamente.venceu(desde: saida, ate: saida))
    XCTAssertFalse(Bloqueio.Intervalo.umMinuto.venceu(desde: saida, ate: saida.addingTimeInterval(59)))
    XCTAssertTrue(Bloqueio.Intervalo.umMinuto.venceu(desde: saida, ate: saida.addingTimeInterval(60)))
    XCTAssertFalse(Bloqueio.Intervalo.quinzeMinutos.venceu(desde: saida, ate: saida.addingTimeInterval(600)))
  }

  func testResumoSemNomesNaoLevaNomeDePaciente() {
    let compromisso = Evento(
      Compromisso(
        id: 9, etiquetaNome: "Palestra", titulo: "Reunião", cor: "#0d9488", inicio: "2026-10-22T17:00",
        fim: "2026-10-22T18:00", observacao: nil))!
    let eventos = [sessao(1, "09:00", "09:45", paciente: "Helena Prado Albuquerque"), compromisso]

    let semNomes = Agenda.itensDoResumo(eventos, nomes: false)
    XCTAssertEqual(semNomes.map(\.titulo), ["Linguagem", "Palestra: Reunião"])
    XCTAssertFalse(semNomes.contains { $0.titulo.contains("Helena") || $0.etiqueta.contains("Helena") })

    let comNomes = Agenda.itensDoResumo(eventos, nomes: true)
    XCTAssertEqual(comNomes.first?.titulo, "Helena Prado")
    XCTAssertEqual(comNomes.first?.etiqueta, "Linguagem")
  }

  func testWidgetMostraSoOQueFaltaHojeEOPrimeiroDeAmanha() {
    let item = { (inicio: String, fim: String) in
      Resumo.Item(
        inicio: DataLocal.data(inicio)!, fim: DataLocal.data(fim)!, cor: "#7c3aed", titulo: "Ana", etiqueta: "Sessão")
    }
    let resumo = Resumo(
      itens: [
        item("2026-10-22T15:00", "2026-10-22T15:45"),
        item("2026-10-22T09:00", "2026-10-22T09:45"),
        item("2026-10-22T14:00", "2026-10-22T14:45"),
        item("2026-10-23T08:00", "2026-10-23T08:45"),
      ],
      atualizado: .now
    )
    let agora = hora("14:30")
    let calendario = DataLocal.calendario
    XCTAssertEqual(
      resumo.restantes(em: agora, calendario: calendario).map { DataLocal.texto($0.inicio) },
      ["2026-10-22T14:00", "2026-10-22T15:00"])
    XCTAssertEqual(
      resumo.doDiaSeguinte(a: agora, calendario: calendario).map { DataLocal.texto($0.inicio) },
      ["2026-10-23T08:00"])
  }

  @MainActor
  func testMensagensDoWorkletEmPedacos() {
    let conexao = Conexao()
    conexao.receber(Data(#"{"t":"estado","status":"con"#.utf8))
    XCTAssertEqual(conexao.situacao, .conectando)
    conexao.receber(Data("nected\",\"via\":\"internet\"}\nlixo sem json\n{\"t\":\"estado\"".utf8))
    XCTAssertEqual(conexao.situacao, .conectado(pelaInternet: true))
    conexao.receber(Data((#","status":"offline"}"# + "\n").utf8))
    XCTAssertEqual(conexao.situacao, .semConexao)
  }
}
