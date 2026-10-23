import SwiftUI

struct ConexaoView: View {
  let conexao: Conexao
  let agenda: Agenda
  let avisos: Avisos
  let bloqueio: Bloqueio

  var body: some View {
    List {
      Section {
        NavigationLink {
          ComputadorView(conexao: conexao)
        } label: {
          HStack(spacing: 14) {
            MarcaDoAuri(tamanho: 60)
            VStack(alignment: .leading, spacing: 2) {
              Text(conexao.servidor?.nome ?? "Computador")
                .font(.title3.weight(.semibold))
              Text(conexao.descricao)
                .font(.subheadline)
                .foregroundStyle(conexao.conectado ? Color.secondary : Color.red)
            }
          }
          .padding(.vertical, 6)
        }
      }

      Section {
        NavigationLink {
          AcessoPelaInternetView(conexao: conexao)
        } label: {
          LinhaDeAjuste(Text("Acesso pela internet"), icone: "internet", cor: .blue)
        }
        NavigationLink {
          AvisosView(avisos: avisos)
        } label: {
          LinhaDeAjuste(Text("Avisos"), icone: "avisos", cor: .red)
        }
        NavigationLink {
          WidgetsView(agenda: agenda)
        } label: {
          LinhaDeAjuste(Text("Widgets"), icone: "widgets", cor: .indigo)
        }
        NavigationLink {
          BloqueioView(bloqueio: bloqueio)
        } label: {
          LinhaDeAjuste(
            Text(bloqueio.metodo == "código do iPhone" ? "Bloqueio" : bloqueio.metodo), icone: "bloqueio", cor: .green)
        }
        NavigationLink {
          EsteIPhoneView()
        } label: {
          LinhaDeAjuste(Text("Este iPhone"), icone: "iphone", cor: .gray)
        }
      }
    }
    .navigationTitle("Conexão")
  }
}

private struct ComputadorView: View {
  let conexao: Conexao

  @State private var confirmando = false

  var body: some View {
    List {
      Section {
        VStack(spacing: 10) {
          MarcaDoAuri(tamanho: 88)
          Text(conexao.servidor?.nome ?? "Computador")
            .font(.title2.bold())
          Text("Os dados da clínica ficam neste computador. O iPhone só mostra as telas.")
            .font(.subheadline)
            .foregroundStyle(.secondary)
            .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
        .listRowBackground(Color.clear)
      }

      Section {
        LabeledContent("Situação", value: conexao.descricao)
      }

      Section {
        Button(role: .destructive) {
          confirmando = true
        } label: {
          Text("Esquecer este computador")
            .frame(maxWidth: .infinity)
        }
        .confirmationDialog(
          "Esquecer este computador?",
          isPresented: $confirmando,
          titleVisibility: .visible
        ) {
          Button("Esquecer", role: .destructive) {
            conexao.esquecer()
          }
        } message: {
          Text("Para conectar de novo, você vai precisar ler outro QR code no computador.")
        }
      }
    }
    .navigationTitle(conexao.servidor?.nome ?? "Computador")
    .navigationBarTitleDisplayMode(.inline)
  }
}

private struct AcessoPelaInternetView: View {
  let conexao: Conexao

  @State private var testando = false
  @State private var resultado: Result<Int, ErroDoAuri>?

  var body: some View {
    List {
      Section {
        Button {
          testar()
        } label: {
          HStack {
            Text("Testar agora")
            Spacer()
            if testando { ProgressView() }
          }
        }
        .disabled(testando || !conexao.conectado)
      } footer: {
        Text("O teste conecta ao computador só pela internet, como quando você está fora da clínica.")
      }

      if let resultado {
        Section {
          switch resultado {
          case .success(let ms):
            LabeledContent("Resposta", value: "\(ms) ms")
          case .failure(let erro):
            Text(erro.mensagem)
              .foregroundStyle(.red)
          }
        }
      }
    }
    .navigationTitle("Acesso pela internet")
    .navigationBarTitleDisplayMode(.inline)
  }

  private func testar() {
    testando = true
    resultado = nil
    Task {
      do {
        resultado = .success(try await conexao.testarPelaInternet())
      } catch {
        resultado = .failure(ErroDoAuri(mensagem: error.localizedDescription))
      }
      testando = false
    }
  }
}

private struct AvisosView: View {
  @Bindable var avisos: Avisos

  @Environment(\.openURL) private var openURL

  var body: some View {
    List {
      Section {
        Toggle("Avisar quando a agenda mudar", isOn: $avisos.ligados)
          .disabled(avisos.negados)
      } footer: {
        Text(
          "Mostra um aviso quando alguém marca, remarca, desmarca ou registra a chegada em outro aparelho, como no computador. Os avisos chegam com o Auri aberto; com o app fechado, o iPhone não recebe."
        )
      }
      if avisos.negados {
        Section {
          Button("Abrir Ajustes do iPhone") {
            if let ajustes = URL(string: UIApplication.openNotificationSettingsURLString) { openURL(ajustes) }
          }
        } footer: {
          Text("As notificações do Auri estão desligadas nos Ajustes do iPhone.")
        }
      }
    }
    .navigationTitle("Avisos")
    .navigationBarTitleDisplayMode(.inline)
    .onChange(of: avisos.ligados) { _, ligados in
      if ligados { Task { await avisos.pedirSeNecessario() } }
    }
    .task { await avisos.atualizar() }
  }
}

private struct WidgetsView: View {
  let agenda: Agenda

  @State private var nomes = Agenda.nomesNosWidgets

  var body: some View {
    List {
      Section {
        Toggle("Mostrar nomes dos pacientes", isOn: $nomes)
      } footer: {
        Text(
          "Ligado, os widgets mostram o nome curto do paciente, o horário e a etiqueta. Desligado, só o horário e a etiqueta. Com o iPhone bloqueado, os nomes ficam sempre escondidos."
        )
      }
      Section {
      } footer: {
        Text(
          "Para pôr um widget, toque e segure a tela inicial, toque em Editar › Adicionar Widget e procure por Auri.")
      }
    }
    .navigationTitle("Widgets")
    .navigationBarTitleDisplayMode(.inline)
    .onChange(of: nomes) { _, valor in
      Agenda.nomesNosWidgets = valor
      agenda.atualizarResumo()
    }
  }
}

private struct EsteIPhoneView: View {
  var body: some View {
    let info = Bundle.main.infoDictionary
    let versao = info?["CFBundleShortVersionString"] as? String ?? ""
    let build = info?["CFBundleVersion"] as? String ?? ""
    List {
      Section {
        LabeledContent("Versão do Auri", value: "\(versao) (\(build))")
      } footer: {
        Text(
          "A chave que identifica este iPhone fica guardada só nele, no Chaveiro, e não vai para o backup do iCloud.")
      }
    }
    .navigationTitle("Este iPhone")
    .navigationBarTitleDisplayMode(.inline)
  }
}

struct LinhaDeAjuste: View {
  let titulo: Text
  let icone: String
  let cor: Color

  init(_ titulo: Text, icone: String, cor: Color) {
    self.titulo = titulo
    self.icone = icone
    self.cor = cor
  }

  var body: some View {
    HStack(spacing: 16) {
      IconeDeAjuste(nome: icone, cor: cor)
      titulo
    }
  }
}

struct IconeDeAjuste: View {
  let nome: String
  let cor: Color

  @ScaledMetric(relativeTo: .body) private var lado = 30

  var body: some View {
    Image(nome)
      .resizable()
      .scaledToFit()
      .frame(width: lado * 0.6, height: lado * 0.6)
      .foregroundStyle(.white)
      .frame(width: lado, height: lado)
      .background(cor.gradient, in: .rect(cornerRadius: lado * 0.27))
      .accessibilityHidden(true)
  }
}

struct MarcaDoAuri: View {
  let tamanho: CGFloat

  var body: some View {
    Image("simbolo")
      .resizable()
      .scaledToFit()
      .foregroundStyle(.white)
      .padding(tamanho * 0.2)
      .frame(width: tamanho, height: tamanho)
      .background(
        LinearGradient(
          colors: [Color(hex: "#303039"), Color(hex: "#17171D")],
          startPoint: .top,
          endPoint: .bottom
        ),
        in: .rect(cornerRadius: tamanho * 0.225)
      )
      .accessibilityHidden(true)
  }
}
