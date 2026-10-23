import Foundation
import Observation
import UserNotifications

struct Aviso: Sendable {
  let titulo: String
  let corpo: String
  let inicio: String
}

@MainActor
@Observable
final class Destino {
  private(set) var data: Date?
  private(set) var pedido = 0
  var novaSessao = false

  func abrir(_ data: Date) {
    self.data = data
    pedido += 1
  }
}

@MainActor
@Observable
final class Avisos: NSObject, UNUserNotificationCenterDelegate {
  private(set) var permitidos = false
  private(set) var negados = false
  private let destino: Destino

  var ligados: Bool {
    didSet { UserDefaults.standard.set(ligados, forKey: Self.chave) }
  }

  private static let chave = "avisos"
  private static let categoria = "agenda"

  init(destino: Destino) {
    self.destino = destino
    ligados = UserDefaults.standard.object(forKey: Self.chave) as? Bool ?? true
    super.init()
    let central = UNUserNotificationCenter.current()
    central.delegate = self
    central.setNotificationCategories([
      UNNotificationCategory(
        identifier: Self.categoria,
        actions: [],
        intentIdentifiers: [],
        hiddenPreviewsBodyPlaceholder: "Mudança na agenda"
      )
    ])
  }

  func atualizar() async {
    let ajustes = await UNUserNotificationCenter.current().notificationSettings()
    permitidos = ajustes.authorizationStatus == .authorized
    negados = ajustes.authorizationStatus == .denied
  }

  func pedirSeNecessario() async {
    await atualizar()
    guard ligados, !permitidos, !negados else { return }
    _ = try? await UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound])
    await atualizar()
  }

  func publicar(_ aviso: Aviso) {
    guard ligados, permitidos else { return }
    let conteudo = UNMutableNotificationContent()
    conteudo.title = aviso.titulo
    conteudo.body = aviso.corpo
    conteudo.sound = .default
    conteudo.categoryIdentifier = Self.categoria
    conteudo.threadIdentifier = Self.categoria
    conteudo.userInfo = ["inicio": aviso.inicio]
    let pedido = UNNotificationRequest(identifier: UUID().uuidString, content: conteudo, trigger: nil)
    UNUserNotificationCenter.current().add(pedido)
  }

  nonisolated func userNotificationCenter(
    _ center: UNUserNotificationCenter,
    willPresent notification: UNNotification
  ) async -> UNNotificationPresentationOptions {
    [.banner, .list, .sound]
  }

  nonisolated func userNotificationCenter(
    _ center: UNUserNotificationCenter,
    didReceive response: UNNotificationResponse
  ) async {
    let inicio = response.notification.request.content.userInfo["inicio"] as? String
    await MainActor.run {
      if let data = inicio.flatMap(DataLocal.data) { destino.abrir(data) }
    }
  }
}
