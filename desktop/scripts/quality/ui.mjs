import { _electron as electron, expect } from '@playwright/test'
import { spawnSync } from 'node:child_process'
import AxeBuilder from '@axe-core/playwright'
import electronPath from 'electron'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { PNG } from 'pngjs'
import pixelmatch from 'pixelmatch'
import { execution, writeJson } from './evidence.mjs'

const output = resolve('.quality/ui')
const directory = mkdtempSync(join(tmpdir(), 'auri-ui-quality-'))
const startedAt = Date.now()
const checks = []
const errors = []
const referenceMode = process.env.AURI_UPDATE_VISUAL === '1'
let application
let page
mkdirSync(output, { recursive: true })

async function check(name, fn) {
  try {
    await fn()
    checks.push({ name, status: 'passed' })
    console.log(`✓ ${name}`)
  } catch (error) {
    checks.push({ name, status: 'failed', detail: error.message })
    throw error
  }
}

async function launch() {
  const env = { ...process.env, TZ: 'America/Cuiaba' }
  delete env.ELECTRON_RUN_AS_NODE
  application = await electron.launch({
    executablePath: electronPath,
    args: ['.', `--user-data-dir=${directory}`, '--force-device-scale-factor=1'],
    env,
    timeout: 30_000,
    colorScheme: null
  })
  page = await application.firstWindow()
  await page.emulateMedia({ colorScheme: null })
  expect(realpathSync(await application.evaluate(({ app }) => app.getPath('userData')))).toBe(
    realpathSync(directory)
  )
  await application.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()[0].setContentSize(1024, 640)
  )
  await expect
    .poll(() => page.evaluate(() => ({ width: innerWidth, height: innerHeight })))
    .toEqual({ width: 1024, height: 640 })
  page.on('pageerror', (error) => errors.push(error.message))
  await page.clock.setFixedTime(new Date('2026-10-14T12:00:00Z'))
  await page.reload()
  await page.evaluate(() => document.fonts.ready)
  await expect(page.locator('main')).toBeVisible()
  await page.addStyleTag({
    content:
      '*, *::before, *::after { animation: none !important; transition: none !important; caret-color: transparent !important; }'
  })
}

async function accessibility(name) {
  await expect(page.locator('iframe')).toHaveCount(0)
  const result = await new AxeBuilder({ page })
    .setLegacyMode()
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze()
  writeJson(join(output, `axe-${name}.json`), result)
  expect(
    result.violations.map(({ id, nodes }) => ({ id, targets: nodes.map((n) => n.target) }))
  ).toEqual([])
}

async function visual(name, locator = page.locator('main')) {
  const actual = join(output, `${name}.png`)
  await locator.screenshot({ path: actual, animations: 'disabled' })
  if (referenceMode) {
    const reference = join(output, 'reference', process.platform, `${name}.png`)
    mkdirSync(resolve(reference, '..'), { recursive: true })
    writeFileSync(reference, readFileSync(actual))
    return
  }
  const baseline = join('docs/qualidade/visual', process.platform, `${name}.png`)
  expect(existsSync(baseline), `Referência visual ausente: ${baseline}`).toBe(true)
  const expected = PNG.sync.read(readFileSync(baseline))
  const current = PNG.sync.read(readFileSync(actual))
  expect({ width: current.width, height: current.height }).toEqual({
    width: expected.width,
    height: expected.height
  })
  const difference = new PNG({ width: current.width, height: current.height })
  const pixels = pixelmatch(
    expected.data,
    current.data,
    difference.data,
    current.width,
    current.height,
    { threshold: 0.15 }
  )
  writeFileSync(join(output, `${name}-diff.png`), PNG.sync.write(difference))
  const ratio = pixels / (current.width * current.height)
  writeJson(join(output, `${name}-diff.json`), { name, pixels, ratio })
  expect(ratio, `${name}: ${(ratio * 100).toFixed(3)}% dos pixels mudaram`).toBeLessThanOrEqual(
    0.001
  )
}

async function patients() {
  return page.evaluate(() => window.api.patients.list({ incluirInativos: true }))
}
async function appointments() {
  return page.evaluate(() =>
    window.api.appointments.listRange('2026-10-14T00:00', '2026-10-15T00:00')
  )
}
async function newAppointment(time, observation) {
  await page.getByRole('button', { name: 'Novo agendamento', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Novo agendamento', exact: true })
  const patient = dialog.getByRole('combobox', { name: 'Paciente', exact: true })
  await patient.fill('joao')
  await patient.press('ArrowDown')
  await patient.press('Enter')
  await dialog.getByLabel('Data', { exact: true }).fill('14102026')
  await dialog.getByRole('combobox', { name: 'Hora', exact: true }).fill(time)
  await dialog.getByLabel('Observação', { exact: true }).fill(observation)
  return dialog
}

try {
  await launch()
  await check('UI: primeira abertura e lista vazia acessíveis', async () => {
    await page.getByRole('button', { name: 'Começar do zero', exact: true }).click()
    await page.getByRole('link', { name: 'Pacientes', exact: true }).click()
    await expect(page.getByText('Nenhum paciente cadastrado ainda', { exact: true })).toBeVisible()
    await accessibility('pacientes-vazio')
  })
  await check('UI: campos inválidos impedem cadastro', async () => {
    await page.getByRole('button', { name: 'Novo paciente', exact: true }).click()
    await page.getByRole('button', { name: 'Cadastrar paciente', exact: true }).click()
    await expect(page.getByText('Informe o nome do paciente', { exact: true })).toBeVisible()
    await page.getByLabel('Nome completo', { exact: true }).fill('João Interface Fictício')
    await page.getByLabel('Data de nascimento').fill('30022019')
    await page.getByRole('button', { name: 'Cadastrar paciente', exact: true }).click()
    await expect(page.getByText('Data inválida', { exact: true })).toBeVisible()
    expect(await patients()).toHaveLength(0)
  })
  await check('UI: cadastro, datas brasileiras e busca sem acento', async () => {
    await page.getByLabel('Data de nascimento').fill('17082019')
    await page.getByLabel('Nome da mãe', { exact: true }).fill('Maria Interface Fictícia')
    await page.getByRole('button', { name: 'Cadastrar paciente', exact: true }).click()
    await expect(
      page.getByRole('link', { name: 'João Interface Fictício', exact: true })
    ).toBeVisible()
    await page.getByRole('searchbox').fill('joao')
    await expect(
      page.getByRole('link', { name: 'João Interface Fictício', exact: true })
    ).toBeVisible()
    const [patient] = await patients()
    expect(patient.data_nascimento).toBe('2019-08-17')
    expect(patient.mae_nome).toBe('Maria Interface Fictícia')
    await expect(page.getByRole('columnheader')).toHaveText([
      'Paciente',
      'Mãe',
      'Escola',
      'Entrada'
    ])
    await expect(page.getByText('7 anos', { exact: true })).toBeVisible()
    await expect(page.getByRole('cell', { name: '14/10/2026', exact: true })).toBeVisible()
    await page.getByRole('searchbox').fill('')
    await accessibility('pacientes-lista')
  })
  await check('UI: edição salva e navegação descarta rascunho', async () => {
    await page.getByRole('link', { name: 'João Interface Fictício', exact: true }).click()
    await expect(page.getByLabel('Data de nascimento')).toHaveValue('17/08/2019')
    await page.getByRole('textbox', { name: 'Escola', exact: true }).fill('Escola Fictícia')
    await page.getByRole('button', { name: 'Salvar alterações', exact: true }).click()
    await expect(page.getByText('Escola Fictícia', { exact: true })).toBeVisible()
    await page.getByRole('link', { name: 'João Interface Fictício', exact: true }).click()
    await page.getByLabel('Nome completo', { exact: true }).fill('Rascunho não salvo')
    await page
      .getByRole('navigation', { name: 'Principal', exact: true })
      .getByRole('link', { name: 'Pacientes', exact: true })
      .click()
    expect((await patients())[0].nome).toBe('João Interface Fictício')
  })
  await check('UI: erro de gravação preserva ficha e mostra mensagem', async () => {
    await page.getByRole('link', { name: 'João Interface Fictício', exact: true }).click()
    await page.getByRole('textbox', { name: 'Escola', exact: true }).fill('Alteração recusada')
    const failWrite = (mode) => {
      const result = spawnSync(
        electronPath,
        ['scripts/quality/write-failure.mjs', join(directory, 'auri.db'), mode],
        { env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' }, stdio: 'inherit' }
      )
      expect(result.status).toBe(0)
    }
    failWrite('enable')
    try {
      await page.getByRole('button', { name: 'Salvar alterações', exact: true }).click()
      await expect(page.getByRole('alert')).toContainText('Falha de gravação de teste')
      expect((await patients())[0].escola).toBe('Escola Fictícia')
      await expect(page.getByRole('textbox', { name: 'Escola', exact: true })).toHaveValue(
        'Alteração recusada'
      )
    } finally {
      failWrite('disable')
    }
    await page
      .getByRole('navigation', { name: 'Principal', exact: true })
      .getByRole('link', { name: 'Agenda', exact: true })
      .click()
  })
  await check('UI: agenda usa teclado e exibe resumo com data e horário', async () => {
    const dialog = await newAppointment('09:00', 'Sessão A Fictícia')
    await expect(dialog).toContainText('das 09:00 às 09:30')
    await accessibility('agendamento')
    await dialog.getByRole('button', { name: 'Agendar', exact: true }).click()
    await expect(dialog).not.toBeVisible()
    expect(await appointments()).toEqual([
      expect.objectContaining({ inicio: '2026-10-14T09:00', fim: '2026-10-14T09:30' })
    ])
  })
  await check('UI: conflito é informado sem criar sessão duplicada', async () => {
    const dialog = await newAppointment('09:00', 'Não deve gravar')
    await dialog.getByRole('button', { name: 'Agendar', exact: true }).click()
    await expect(dialog.getByRole('alert')).toContainText(
      'Esse horário já está ocupado: João Interface Fictício, das 09:00 às 09:30'
    )
    expect(await appointments()).toHaveLength(1)
    await dialog.getByRole('button', { name: 'Cancelar', exact: true }).click()
  })
  await check('UI: sessão adjacente é aceita e cancelar mantém os dados', async () => {
    const dialog = await newAppointment('09:30', 'Sessão B Fictícia')
    await dialog.getByRole('button', { name: 'Agendar', exact: true }).click()
    await expect(dialog).not.toBeVisible()
    expect(await appointments()).toHaveLength(2)
    const cancel = await newAppointment('11:00', 'Rascunho não salvo')
    await cancel.getByRole('button', { name: 'Cancelar', exact: true }).click()
    expect(await appointments()).toHaveLength(2)
  })
  await check('UI: remarcação com conflito e exclusão exigem confirmação', async () => {
    await page.locator('.rbc-event').filter({ hasText: 'João' }).nth(1).click()
    const dialog = page.getByRole('dialog', { name: 'Editar agendamento', exact: true })
    await dialog.getByRole('combobox', { name: 'Hora', exact: true }).fill('09:00')
    await dialog.getByRole('combobox', { name: 'Hora', exact: true }).press('Tab')
    await dialog.getByRole('button', { name: 'Salvar alterações', exact: true }).click()
    await expect(dialog.getByRole('alert')).toContainText('Esse horário já está ocupado')
    expect((await appointments())[1].inicio).toBe('2026-10-14T09:30')
    await dialog.getByRole('button', { name: 'Excluir', exact: true }).click()
    await expect(
      dialog.getByRole('button', { name: 'Confirmar exclusão', exact: true })
    ).toBeVisible()
    expect(await appointments()).toHaveLength(2)
    await dialog.getByRole('button', { name: 'Cancelar', exact: true }).click()
    await page.locator('.rbc-event').filter({ hasText: 'João' }).nth(1).click()
    await page.getByRole('button', { name: 'Excluir', exact: true }).click()
    await page.getByRole('button', { name: 'Confirmar exclusão', exact: true }).click()
    await expect(dialog).not.toBeVisible()
    expect(await appointments()).toHaveLength(1)
  })
  await check('UI: temas claro e escuro têm referências visuais e acessibilidade', async () => {
    await page.getByRole('link', { name: 'Configurações', exact: true }).click()
    await page.getByRole('link', { name: 'Aparência', exact: true }).click()
    for (const [label, name] of [
      ['Claro', 'aparencia-claro'],
      ['Escuro', 'aparencia-escuro']
    ]) {
      await page.getByRole('radio', { name: label, exact: true }).focus()
      await page.getByRole('radio', { name: label, exact: true }).press('Space')
      await expect(page.getByRole('radio', { name: label, exact: true })).toBeChecked()
      await expect
        .poll(() => page.evaluate(() => matchMedia('(prefers-color-scheme: dark)').matches))
        .toBe(label === 'Escuro')
      while (await page.getByRole('button', { name: 'Fechar aviso', exact: true }).count()) {
        await page.getByRole('button', { name: 'Fechar aviso', exact: true }).first().click()
      }
      await expect(
        page.getByRole('region', { name: 'Notifications (F8)' }).locator('li')
      ).toHaveCount(0)
      await accessibility(name)
      await visual(name)
    }
  })
  await check('UI: reiniciar preserva paciente, sessão e tema', async () => {
    await application.close()
    await launch()
    await page.getByRole('link', { name: 'Pacientes', exact: true }).click()
    await expect(
      page.getByRole('link', { name: 'João Interface Fictício', exact: true })
    ).toBeVisible()
    expect((await patients())[0].escola).toBe('Escola Fictícia')
    expect(await appointments()).toHaveLength(1)
    await accessibility('pacientes-escuro')
    await visual('pacientes-escuro')
    await page.getByRole('link', { name: 'Configurações', exact: true }).click()
    await page.getByRole('link', { name: 'Aparência', exact: true }).click()
    await expect(page.getByRole('radio', { name: 'Escuro', exact: true })).toBeChecked()
  })
  await check('UI: execução não contém erros JavaScript', async () => expect(errors).toEqual([]))
} catch (error) {
  console.error(error)
  process.exitCode = 1
  if (page && !page.isClosed())
    await page.screenshot({ path: join(output, 'falha.png') }).catch(() => {})
} finally {
  await application?.close().catch(() => {})
  writeJson(join(output, 'results.json'), {
    ...execution(startedAt),
    success: !process.exitCode,
    mode: referenceMode ? 'reference' : 'verify',
    checks
  })
  rmSync(directory, { recursive: true, force: true })
}
