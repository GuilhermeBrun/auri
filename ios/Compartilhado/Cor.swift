import SwiftUI

extension Color {
  init(hex: String) {
    let limpo = hex.trimmingCharacters(in: CharacterSet(charactersIn: "#"))
    let valor = UInt64(limpo, radix: 16) ?? 0x6b7280
    self.init(
      red: Double((valor >> 16) & 0xff) / 255,
      green: Double((valor >> 8) & 0xff) / 255,
      blue: Double(valor & 0xff) / 255
    )
  }
}
