import Foundation
import Security

enum Chaves {
  private static let servico = "com.auri.ios.conexao"
  private static let conta = "semente"

  static func semente() throws -> String {
    if let guardada = try ler() { return guardada }
    var bytes = [UInt8](repeating: 0, count: 32)
    guard SecRandomCopyBytes(kSecRandomDefault, bytes.count, &bytes) == errSecSuccess else {
      throw ErroDasChaves.aleatorio
    }
    let nova = bytes.map { String(format: "%02x", $0) }.joined()
    try gravar(nova)
    return nova
  }

  static func apagar() {
    SecItemDelete(consulta() as CFDictionary)
  }

  private static func consulta() -> [String: Any] {
    [
      kSecClass as String: kSecClassGenericPassword,
      kSecAttrService as String: servico,
      kSecAttrAccount as String: conta
    ]
  }

  private static func ler() throws -> String? {
    var pedido = consulta()
    pedido[kSecReturnData as String] = true
    pedido[kSecMatchLimit as String] = kSecMatchLimitOne
    var resultado: AnyObject?
    let estado = SecItemCopyMatching(pedido as CFDictionary, &resultado)
    if estado == errSecItemNotFound { return nil }
    guard estado == errSecSuccess, let dados = resultado as? Data else {
      throw ErroDasChaves.chaveiro(estado)
    }
    return String(data: dados, encoding: .utf8)
  }

  private static func gravar(_ semente: String) throws {
    var item = consulta()
    item[kSecValueData as String] = Data(semente.utf8)
    item[kSecAttrAccessible as String] = kSecAttrAccessibleWhenUnlockedThisDeviceOnly
    let estado = SecItemAdd(item as CFDictionary, nil)
    guard estado == errSecSuccess else { throw ErroDasChaves.chaveiro(estado) }
  }
}

enum ErroDasChaves: Error {
  case aleatorio
  case chaveiro(OSStatus)
}
