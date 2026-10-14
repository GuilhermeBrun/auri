import { requireCondition, validateCiExecution } from './checks.mjs'

export function validateDelivery(report, bom, sha, platform, bomHash) {
  requireCondition(
    report.success === true && report.sha === sha && report.platform === platform,
    'Entrega ausente ou de outro SHA/plataforma'
  )
  if (process.env.GITHUB_RUN_ID)
    validateCiExecution(report, process.env.GITHUB_RUN_ID, process.env.GITHUB_RUN_ATTEMPT)
  requireCondition(
    /^[0-9a-f]{64}$/.test(report.sbomSha256) && report.sbomSha256 === bomHash,
    'SBOM difere do manifesto de entrega'
  )
  requireCondition(
    bom.bomFormat === 'CycloneDX' &&
      bom.specVersion === '1.6' &&
      bom.metadata?.component?.version === report.version,
    'SBOM inválido ou de outra versão'
  )
  requireCondition(
    /^[0-9a-f]{64}$/.test(report.asarSha256) && report.asarSha256 === report.testedAsarSha256,
    'SBOM precisa corresponder ao ASAR realmente testado'
  )
  requireCondition(
    bom.metadata.properties.some(
      (property) => property.name === 'auri:commit' && property.value === sha
    ),
    'SBOM de outro commit'
  )
  requireCondition(
    bom.components?.length > 0 &&
      new Set(bom.components.map((component) => component['bom-ref'])).size ===
        bom.components.length,
    'SBOM vazio ou duplicado'
  )
  for (const name of ['electron', 'chromium', 'node', 'v8', 'better-sqlite3', 'react', 'react-dom'])
    requireCondition(
      bom.components.some((component) => component.name === name && component.version),
      `SBOM omitiu componente obrigatório: ${name}`
    )
  for (const name of [
    'vite-plus',
    'electron-builder',
    'fast-check',
    'jsdom',
    '@testing-library/react'
  ])
    requireCondition(
      !bom.components.some((component) => component.name === name),
      `Ferramenta de desenvolvimento distribuída: ${name}`
    )
  requireCondition(
    report.native?.length > 0 && report.native.every((file) => /^[0-9a-f]{64}$/.test(file.sha256)),
    'SBOM omitiu binários nativos'
  )
  if (report.installer)
    requireCondition(/^[0-9a-f]{64}$/.test(report.installer.sha256), 'Instalador sem hash')
  return { components: bom.components.length, asarSha256: report.asarSha256 }
}
