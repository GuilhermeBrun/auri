import SwiftUI

struct ConexaoView: View {
  let conexao: Conexao

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
          Label {
            Text("Acesso pela internet")
          } icon: {
            IconeDeAjuste(nome: "internet", cor: .blue)
          }
        }
        NavigationLink {
          EsteIPhoneView()
        } label: {
          Label {
            Text("Este iPhone")
          } icon: {
            IconeDeAjuste(nome: "iphone", cor: .gray)
          }
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

private struct EsteIPhoneView: View {
  var body: some View {
    let info = Bundle.main.infoDictionary
    let versao = info?["CFBundleShortVersionString"] as? String ?? ""
    let build = info?["CFBundleVersion"] as? String ?? ""
    List {
      Section {
        LabeledContent("Versão do Auri", value: "\(versao) (\(build))")
      } footer: {
        Text("A chave que identifica este iPhone fica guardada só nele, no Chaveiro, e não vai para o backup do iCloud.")
      }
    }
    .navigationTitle("Este iPhone")
    .navigationBarTitleDisplayMode(.inline)
  }
}

struct IconeDeAjuste: View {
  let nome: String
  let cor: Color

  var body: some View {
    Image(nome)
      .resizable()
      .scaledToFit()
      .frame(width: 18, height: 18)
      .foregroundStyle(.white)
      .frame(width: 30, height: 30)
      .background(cor.gradient, in: .rect(cornerRadius: 8))
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
