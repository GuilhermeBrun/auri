import SwiftUI

struct ConexaoView: View {
  let conexao: Conexao

  @State private var testando = false
  @State private var resultado: String?
  @State private var confirmando = false

  var body: some View {
    Form {
      Section {
        LabeledContent("Computador", value: conexao.servidor?.nome ?? "")
        LabeledContent("Situação", value: conexao.descricao)
      }

      Section {
        Button {
          testar()
        } label: {
          HStack {
            Text("Testar acesso pela internet")
            Spacer()
            if testando { ProgressView() }
          }
        }
        .disabled(testando || !conexao.conectado)
      } footer: {
        if let resultado { Text(resultado) }
      }

      Section {
        Button("Esquecer este computador", role: .destructive) {
          confirmando = true
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
    .navigationTitle("Conexão")
  }

  private func testar() {
    testando = true
    resultado = nil
    Task {
      do {
        let ms = try await conexao.testarPelaInternet()
        resultado = "Pela internet, o computador respondeu em \(ms) ms."
      } catch {
        resultado = error.localizedDescription
      }
      testando = false
    }
  }
}
