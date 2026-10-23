import SwiftUI

struct BoasVindasView: View {
  let conexao: Conexao

  @State private var lendo = false

  var body: some View {
    ScrollView {
      VStack(alignment: .leading, spacing: 36) {
        VStack(alignment: .leading, spacing: 2) {
          Text("Boas-vindas ao Auri")
            .font(.title.bold())
          Text("A agenda e os pacientes da clínica no seu iPhone.")
            .font(.title)
            .foregroundStyle(.secondary)
        }
        .accessibilityElement(children: .combine)
        .accessibilityAddTraits(.isHeader)

        VStack(alignment: .leading, spacing: 24) {
          Recurso(
            icone: "agenda",
            titulo: "Agenda",
            texto: "Veja o dia, marque e remarque sessões de onde estiver."
          )
          Recurso(
            icone: "pacientes",
            titulo: "Pacientes",
            texto: "Consulte a ficha, as sessões, a anamnese e as evoluções."
          )
          Recurso(
            icone: "conexao",
            titulo: "Dados na clínica",
            texto: "Tudo continua no computador da clínica. O iPhone se conecta a ele com cifra, de dentro ou de fora."
          )
        }
      }
      .frame(maxWidth: .infinity, alignment: .leading)
      .padding(.horizontal, 32)
      .padding(.top, 64)
    }
    .scrollBounceBehavior(.basedOnSize)
    .safeAreaInset(edge: .bottom) {
      Button {
        lendo = true
      } label: {
        Text("Continuar")
          .font(.headline)
          .frame(maxWidth: .infinity)
      }
      .buttonStyle(.glassProminent)
      .controlSize(.extraLarge)
      .padding(.horizontal, 32)
      .padding(.bottom, 12)
    }
    .fullScreenCover(isPresented: $lendo) {
      LeitorQRView(conexao: conexao)
    }
  }
}

private struct Recurso: View {
  let icone: String
  let titulo: String
  let texto: String

  var body: some View {
    HStack(alignment: .top, spacing: 18) {
      Image(icone)
        .resizable()
        .scaledToFit()
        .frame(width: 34, height: 34)
        .foregroundStyle(.tint)
        .accessibilityHidden(true)
      VStack(alignment: .leading, spacing: 2) {
        Text(titulo)
          .font(.headline)
        Text(texto)
          .foregroundStyle(.secondary)
      }
    }
    .accessibilityElement(children: .combine)
  }
}
