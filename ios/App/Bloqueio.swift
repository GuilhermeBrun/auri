import LocalAuthentication
import Observation
import SwiftUI

@MainActor
@Observable
final class Bloqueio {
  enum Intervalo: Int, CaseIterable, Identifiable {
    case imediatamente = 0
    case umMinuto = 60
    case cincoMinutos = 300
    case quinzeMinutos = 900

    var id: Int { rawValue }

    func venceu(desde saida: Date, ate agora: Date) -> Bool {
      agora.timeIntervalSince(saida) >= Double(rawValue)
    }

    var nome: String {
      switch self {
      case .imediatamente: return "Imediatamente"
      case .umMinuto: return "Depois de 1 minuto"
      case .cincoMinutos: return "Depois de 5 minutos"
      case .quinzeMinutos: return "Depois de 15 minutos"
      }
    }
  }

  private(set) var exigir: Bool {
    didSet { UserDefaults.standard.set(exigir, forKey: "bloqueio") }
  }

  var intervalo: Intervalo {
    didSet { UserDefaults.standard.set(intervalo.rawValue, forKey: "bloqueio-intervalo") }
  }

  private(set) var bloqueado = false
  private var autenticando = false
  private var saiuEm: Date?

  init() {
    exigir = UserDefaults.standard.object(forKey: "bloqueio") == nil || UserDefaults.standard.bool(forKey: "bloqueio")
    intervalo = Intervalo(rawValue: UserDefaults.standard.integer(forKey: "bloqueio-intervalo")) ?? .imediatamente
  }

  var disponivel: Bool {
    LAContext().canEvaluatePolicy(.deviceOwnerAuthentication, error: nil)
  }

  var metodo: String {
    let contexto = LAContext()
    _ = contexto.canEvaluatePolicy(.deviceOwnerAuthentication, error: nil)
    switch contexto.biometryType {
    case .faceID: return "Face ID"
    case .touchID: return "Touch ID"
    case .opticID: return "Optic ID"
    default: return "código do iPhone"
    }
  }

  func abrir() {
    bloqueado = exigir && disponivel
  }

  func saiu() {
    saiuEm = .now
  }

  func voltou() {
    defer { saiuEm = nil }
    guard exigir, disponivel, let saiuEm else { return }
    if intervalo.venceu(desde: saiuEm, ate: .now) { bloqueado = true }
  }

  func desbloquear() async {
    guard bloqueado, !autenticando else { return }
    autenticando = true
    if await autenticar("Desbloquear o Auri") { bloqueado = false }
    autenticando = false
  }

  func mudarExigencia(_ nova: Bool) async {
    guard nova != exigir else { return }
    if await autenticar(nova ? "Ligar o bloqueio do Auri" : "Desligar o bloqueio do Auri") { exigir = nova }
  }

  private func autenticar(_ motivo: String) async -> Bool {
    let contexto = LAContext()
    return (try? await contexto.evaluatePolicy(.deviceOwnerAuthentication, localizedReason: motivo)) ?? false
  }
}

struct TelaDeBloqueio: View {
  let bloqueio: Bloqueio

  var body: some View {
    VStack(spacing: 16) {
      Spacer()
      MarcaDoAuri(tamanho: 88)
      Text("Auri bloqueado")
        .font(.title2.bold())
      Text("Desbloqueie para ver a agenda e os pacientes.")
        .foregroundStyle(.secondary)
        .multilineTextAlignment(.center)
      Spacer()
      Button {
        Task { await bloqueio.desbloquear() }
      } label: {
        Text("Desbloquear com \(bloqueio.metodo)")
          .font(.headline)
          .frame(maxWidth: .infinity)
      }
      .buttonStyle(.glassProminent)
      .controlSize(.extraLarge)
    }
    .padding(32)
    .frame(maxWidth: .infinity, maxHeight: .infinity)
    .background(Color(.systemBackground))
    .task { await bloqueio.desbloquear() }
  }
}

struct CapaDePrivacidade: View {
  var body: some View {
    MarcaDoAuri(tamanho: 88)
      .frame(maxWidth: .infinity, maxHeight: .infinity)
      .background(Color(.systemBackground))
  }
}

struct BloqueioView: View {
  let bloqueio: Bloqueio

  var body: some View {
    let metodo = bloqueio.metodo
    let disponivel = bloqueio.disponivel
    List {
      Section {
        Toggle(
          "Exigir \(metodo)",
          isOn: Binding(
            get: { bloqueio.exigir },
            set: { nova in Task { await bloqueio.mudarExigencia(nova) } }
          )
        )
        .disabled(!disponivel)
      } footer: {
        if disponivel {
          Text(
            "O Auri pede o \(metodo) ao abrir e ao voltar para o app. Se não reconhecer, dá para usar o código do iPhone."
          )
        } else {
          Text("Para usar o bloqueio, defina um código no iPhone em Ajustes › Face ID e Código.")
        }
      }

      if bloqueio.exigir && disponivel {
        Section {
          Picker("Pedir de novo", selection: Bindable(bloqueio).intervalo) {
            ForEach(Bloqueio.Intervalo.allCases) { Text($0.nome).tag($0) }
          }
          .pickerStyle(.inline)
          .labelsHidden()
        } header: {
          Text("Pedir de novo")
        } footer: {
          Text("Quanto tempo o Auri pode ficar em segundo plano antes de pedir o \(metodo) de novo.")
        }
      }
    }
    .navigationTitle(metodo == "código do iPhone" ? "Bloqueio" : metodo)
    .navigationBarTitleDisplayMode(.inline)
  }
}
