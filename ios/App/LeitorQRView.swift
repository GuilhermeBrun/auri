import AVFoundation
import SwiftUI
import VisionKit

struct LeitorQRView: View {
  let conexao: Conexao

  @Environment(\.dismiss) private var dismiss
  @Environment(\.openURL) private var openURL
  @State private var acesso = AVCaptureDevice.authorizationStatus(for: .video)
  @State private var etapa = Etapa.lendo
  @State private var lidos = 0

  private enum Etapa: Equatable {
    case lendo
    case conectando
    case erro(String)
  }

  var body: some View {
    NavigationStack {
      conteudo
        .navigationTitle("Conectar")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
          ToolbarItem(placement: .topBarLeading) {
            Button(role: .close) {
              dismiss()
            }
          }
        }
    }
    .sensoryFeedback(.success, trigger: lidos)
    .task {
      if let qr = Self.qrDeTeste {
        ler(qr)
      } else if acesso == .notDetermined {
        acesso = await AVCaptureDevice.requestAccess(for: .video) ? .authorized : .denied
      }
    }
  }

  @ViewBuilder
  private var conteudo: some View {
    if Self.qrDeTeste != nil {
      situacao
    } else if acesso == .denied || acesso == .restricted {
      ContentUnavailableView {
        Label("Sem acesso à câmera", systemImage: "camera")
      } description: {
        Text("Para ler o QR code do computador, permita que o Auri use a câmera.")
      } actions: {
        Button("Abrir Ajustes") {
          if let ajustes = URL(string: UIApplication.openSettingsURLString) { openURL(ajustes) }
        }
      }
    } else if acesso == .authorized && !DataScannerViewController.isSupported {
      ContentUnavailableView(
        "Câmera indisponível",
        systemImage: "camera",
        description: Text("Este aparelho não consegue ler QR codes.")
      )
    } else if acesso == .authorized {
      LeitorDeCodigo(ativo: etapa == .lendo, aoLer: ler)
        .ignoresSafeArea()
        .overlay(alignment: .bottom) { situacao.padding(.bottom, 24) }
    } else {
      ProgressView()
    }
  }

  @ViewBuilder
  private var situacao: some View {
    Group {
      switch etapa {
      case .lendo:
        VStack(spacing: 4) {
          Text("Aponte a câmera para o QR code do computador.")
          Text("No computador: Configurações › Armazenamento › Conexão › Conectar celular.")
            .font(.footnote)
            .foregroundStyle(.secondary)
        }
      case .conectando:
        HStack(spacing: 12) {
          ProgressView()
          Text("Conectando ao computador…")
        }
      case .erro(let mensagem):
        VStack(spacing: 12) {
          Text(mensagem)
          Button("Ler de novo") { etapa = .lendo }
            .buttonStyle(.glass)
        }
      }
    }
    .font(.callout)
    .multilineTextAlignment(.center)
    .padding(16)
    .background(.regularMaterial, in: .rect(cornerRadius: 20))
    .padding(.horizontal, 24)
  }

  private func ler(_ qr: String) {
    guard etapa == .lendo else { return }
    lidos += 1
    etapa = .conectando
    Task {
      do {
        try await conexao.parear(qr: qr)
        dismiss()
      } catch {
        etapa = .erro(error.localizedDescription)
      }
    }
  }

  private static var qrDeTeste: String? {
    #if DEBUG
      ProcessInfo.processInfo.environment["AURI_QR"]
    #else
      nil
    #endif
  }
}

private struct LeitorDeCodigo: UIViewControllerRepresentable {
  let ativo: Bool
  let aoLer: (String) -> Void

  func makeUIViewController(context: Context) -> DataScannerViewController {
    let leitor = DataScannerViewController(
      recognizedDataTypes: [.barcode(symbologies: [.qr])],
      qualityLevel: .balanced,
      recognizesMultipleItems: false,
      isHighFrameRateTrackingEnabled: false,
      isHighlightingEnabled: true
    )
    leitor.delegate = context.coordinator
    return leitor
  }

  func updateUIViewController(_ leitor: DataScannerViewController, context: Context) {
    context.coordinator.aoLer = aoLer
    if ativo && !leitor.isScanning {
      try? leitor.startScanning()
    } else if !ativo && leitor.isScanning {
      leitor.stopScanning()
    }
  }

  func makeCoordinator() -> Coordenador {
    Coordenador(aoLer: aoLer)
  }

  final class Coordenador: NSObject, DataScannerViewControllerDelegate {
    var aoLer: (String) -> Void

    init(aoLer: @escaping (String) -> Void) {
      self.aoLer = aoLer
    }

    func dataScanner(
      _ dataScanner: DataScannerViewController, didAdd addedItems: [RecognizedItem],
      allItems: [RecognizedItem]
    ) {
      for item in addedItems {
        if case .barcode(let codigo) = item, let texto = codigo.payloadStringValue {
          aoLer(texto)
          return
        }
      }
    }
  }
}
