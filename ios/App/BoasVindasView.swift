import SwiftUI

struct BoasVindasView: View {
  let conexao: Conexao

  @State private var lendo = false

  var body: some View {
    ScrollView {
      VStack(alignment: .leading, spacing: 40) {
        Text("Boas-vindas ao Auri")
          .font(.largeTitle.bold())
          .frame(maxWidth: .infinity, alignment: .center)
          .multilineTextAlignment(.center)
          .padding(.top, 72)

        VStack(alignment: .leading, spacing: 28) {
          Recurso(
            simbolo: "calendar",
            titulo: "Agenda",
            texto: "Veja o dia, marque e remarque sessões de onde estiver."
          )
          Recurso(
            simbolo: "person.text.rectangle",
            titulo: "Pacientes",
            texto: "Consulte a ficha, as sessões, a anamnese e as evoluções."
          )
          Recurso(
            simbolo: "lock.laptopcomputer",
            titulo: "Dados na clínica",
            texto:
              "Tudo continua guardado no computador da clínica. O iPhone se conecta a ele com cifra, de dentro ou de fora."
          )
        }
      }
      .padding(.horizontal, 32)
    }
    .scrollBounceBehavior(.basedOnSize)
    .safeAreaInset(edge: .bottom) {
      VStack(spacing: 16) {
        Text("No computador da clínica, abra Configurações › Armazenamento › Conexão e escolha Conectar celular.")
          .font(.footnote)
          .foregroundStyle(.secondary)
          .multilineTextAlignment(.center)
        Button {
          lendo = true
        } label: {
          Text("Conectar ao computador")
            .frame(maxWidth: .infinity)
        }
        .buttonStyle(.glassProminent)
        .controlSize(.large)
      }
      .padding(.horizontal, 32)
      .padding(.bottom, 16)
    }
    .fullScreenCover(isPresented: $lendo) {
      LeitorQRView(conexao: conexao)
    }
  }
}

private struct Recurso: View {
  let simbolo: String
  let titulo: String
  let texto: String

  var body: some View {
    HStack(alignment: .top, spacing: 16) {
      Image(systemName: simbolo)
        .font(.title)
        .foregroundStyle(.tint)
        .frame(width: 44)
        .accessibilityHidden(true)
      VStack(alignment: .leading, spacing: 2) {
        Text(titulo)
          .font(.headline)
        Text(texto)
          .font(.subheadline)
          .foregroundStyle(.secondary)
      }
    }
    .accessibilityElement(children: .combine)
  }
}
