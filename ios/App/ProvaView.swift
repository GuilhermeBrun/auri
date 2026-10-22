import SwiftUI

struct Paciente: Decodable, Identifiable {
  let id: Int
  let nome: String
}

struct ProvaView: View {
  let conexao: Conexao

  @State private var host = ""
  @State private var porta = "47390"
  @State private var codigo = ""
  @State private var soPelaInternet = false
  @State private var pacientes: [Paciente] = []
  @State private var erro: String?
  @State private var ocupado = false

  var body: some View {
    NavigationStack {
      Form {
        Section("Computador") {
          LabeledContent("Situação", value: conexao.descricao)
          if let servidor = conexao.servidor {
            LabeledContent("Nome", value: servidor.nome)
            Toggle("Só pela internet", isOn: $soPelaInternet)
              .onChange(of: soPelaInternet) { _, valor in
                conexao.conectar(servidor, soPelaInternet: valor)
              }
          }
        }

        if conexao.servidor == nil {
          Section {
            TextField("Endereço do computador", text: $host)
              .textContentType(.URL)
              .keyboardType(.numbersAndPunctuation)
              .autocorrectionDisabled()
              .textInputAutocapitalization(.never)
            TextField("Porta", text: $porta)
              .keyboardType(.numberPad)
            TextField("Código", text: $codigo)
              .autocorrectionDisabled()
              .textInputAutocapitalization(.characters)
            Button("Parear", action: parear)
              .disabled(ocupado || host.isEmpty || codigo.isEmpty || Int(porta) == nil)
          } header: {
            Text("Parear")
          } footer: {
            Text("No computador, abra Configurações › Armazenamento › Conexão e gere um código.")
          }
        } else {
          Section {
            Button("Listar pacientes", action: listar)
              .disabled(ocupado)
            Button("Testar pela internet", action: testar)
              .disabled(ocupado)
            Button("Esquecer este computador", role: .destructive) {
              pacientes = []
              conexao.esquecer()
            }
          }
        }

        if let erro {
          Section {
            Text(erro)
              .foregroundStyle(.red)
          }
        }

        if !pacientes.isEmpty {
          Section("Pacientes") {
            ForEach(pacientes) { paciente in
              Text(paciente.nome)
            }
          }
        }

        if !conexao.registro.isEmpty {
          Section("Registro") {
            ForEach(Array(conexao.registro.enumerated()), id: \.offset) { _, linha in
              Text(linha)
                .font(.footnote)
                .foregroundStyle(.secondary)
            }
          }
        }
      }
      .navigationTitle("Conexão")
    }
  }

  private func executar(_ trabalho: @escaping () async throws -> Void) {
    erro = nil
    ocupado = true
    Task {
      do {
        try await trabalho()
      } catch {
        self.erro = error.localizedDescription
      }
      ocupado = false
    }
  }

  private func parear() {
    executar {
      try await conexao.parear(host: host, porta: Int(porta) ?? 0, codigo: codigo)
      codigo = ""
    }
  }

  private func listar() {
    executar {
      pacientes = try await conexao.operacao("patients:list").decodificar([Paciente].self)
    }
  }

  private func testar() {
    executar {
      let ms = try await conexao.testarPelaInternet()
      conexao.anotarTeste(ms)
    }
  }
}
