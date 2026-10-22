import SwiftUI

struct ConexaoView: View {
  let conexao: Conexao

  @Environment(\.dismiss) private var dismiss
  @State private var testando = false
  @State private var resultado: String?
  @State private var confirmando = false

  var body: some View {
    NavigationStack {
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
              dismiss()
            }
          } message: {
            Text("Para conectar de novo, você vai precisar ler outro QR code no computador.")
          }
        }
      }
      .navigationTitle("Conexão")
      .navigationBarTitleDisplayMode(.inline)
      .toolbar {
        ToolbarItem(placement: .topBarTrailing) {
          Button(role: .close) {
            dismiss()
          }
        }
      }
    }
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
