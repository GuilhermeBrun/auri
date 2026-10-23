import { RotateCcw } from 'lucide-react'
import { useEffect, useState } from 'react'
import {
  ATALHOS,
  ATALHOS_FIXOS,
  GRUPOS_DE_ATALHO,
  mesmaTecla,
  padraoDoAtalho,
  problemaDoAtalho,
  type Atalho,
  type GrupoDeAtalho,
  type ProblemaDoAtalho,
  type Tecla
} from '@shared/atalhos'
import { Page } from '@renderer/components/Layout'
import { Button } from '@renderer/components/ui/button'
import { Kbd } from '@renderer/components/ui/kbd'
import { ErrorText, PageSection, SettingRow, SettingsGroup } from '@renderer/components/ui/section'
import {
  partesDaTecla,
  PLATAFORMA,
  restaurarAtalhos,
  salvarAtalho,
  teclaDoEvento,
  textoDaTecla,
  useTeclas,
  useTrocas
} from '@renderer/lib/atalhos'
import { isMac } from '@renderer/lib/platform'
import { SETTINGS_CRUMB } from '@renderer/lib/settings'
import { cn } from '@renderer/lib/utils'

const DESCRICOES: Partial<Record<GrupoDeAtalho, string>> = {
  ir: 'Abrem a tela mesmo quando ela está oculta na barra lateral; o WhatsApp oculto fica parado.',
  agenda: 'Valem na tela da Agenda, fora dos campos de texto.',
  pacientes: 'Novo paciente vale na lista; as abas, na tela do paciente.'
}

const SO_MODIFICADOR = ['Shift', 'Control', 'Alt', 'Meta', 'CapsLock', 'Fn', 'OS']

function mensagem(problema: ProblemaDoAtalho, tecla: Tecla): string {
  const texto = textoDaTecla(tecla)
  if (problema.tipo === 'reservada') return `${texto} é do sistema. Escolha outro.`
  if (problema.tipo === 'sozinha') {
    return `Use ${texto} junto com ${isMac ? '⌘, ⌃ ou ⌥' : 'Ctrl ou Alt'}.`
  }
  return `${texto} já é o atalho de “${problema.nome}”.`
}

function Teclas({ partes }: { partes: readonly string[] }): React.JSX.Element {
  return (
    <span className="flex items-center gap-1">
      {partes.map((parte, i) => (
        <Kbd key={i} className="min-w-6 bg-fill-hover text-ink">
          {parte}
        </Kbd>
      ))}
    </span>
  )
}

function AtalhoRow({ atalho }: { atalho: Atalho }): React.JSX.Element {
  const teclas = useTeclas()
  const tecla = teclas[atalho.id]
  const padrao = padraoDoAtalho(atalho.id, PLATAFORMA)
  const [gravando, setGravando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const diferente = tecla === null ? padrao !== null : !mesmaTecla(tecla, padrao)

  useEffect(() => {
    if (!gravando) return
    function onKeyDown(e: KeyboardEvent): void {
      e.preventDefault()
      e.stopPropagation()
      if (SO_MODIFICADOR.includes(e.key)) return
      const nova = teclaDoEvento(e)
      const sozinha = !nova.ctrl && !nova.alt && !nova.meta && !nova.shift
      if (sozinha && nova.code === 'Escape') {
        setErro(null)
        setGravando(false)
        return
      }
      if (sozinha && (nova.code === 'Backspace' || nova.code === 'Delete')) {
        salvarAtalho(atalho.id, padrao === null ? undefined : null)
        setErro(null)
        setGravando(false)
        return
      }
      const problema = problemaDoAtalho(atalho.id, nova, PLATAFORMA, teclas)
      if (problema) {
        setErro(mensagem(problema, nova))
        return
      }
      salvarAtalho(atalho.id, mesmaTecla(nova, padrao) ? undefined : nova)
      setErro(null)
      setGravando(false)
    }
    window.addEventListener('keydown', onKeyDown, { capture: true })
    return () => window.removeEventListener('keydown', onKeyDown, { capture: true })
  }, [gravando, atalho.id, padrao, teclas])

  const texto = textoDaTecla(tecla)
  return (
    <>
      <SettingRow title={atalho.nome}>
        {diferente && (
          <Button
            variant="ghost"
            size="icon-sm"
            className="animate-fade-in"
            aria-label={`Voltar ${atalho.nome} ao padrão`}
            title={`Voltar ao padrão (${textoDaTecla(padrao) ?? 'sem atalho'})`}
            onClick={() => {
              salvarAtalho(atalho.id, undefined)
              setErro(null)
            }}
          >
            <RotateCcw />
          </Button>
        )}
        <button
          type="button"
          aria-label={
            gravando
              ? `Pressione o novo atalho para ${atalho.nome}`
              : `Trocar o atalho de ${atalho.nome}: ${texto ?? 'sem atalho'}`
          }
          aria-live="polite"
          onClick={() => {
            setErro(null)
            setGravando((atual) => !atual)
          }}
          onBlur={() => {
            setGravando(false)
            setErro(null)
          }}
          className={cn(
            'flex h-8 items-center rounded-control px-2 text-xs transition-colors focus-visible:outline-2 focus-visible:outline-accent',
            gravando ? 'bg-fill-hover text-ink' : 'text-ink-faint hover:bg-fill'
          )}
        >
          {gravando ? (
            <span className="animate-fade-in">Pressione as teclas…</span>
          ) : tecla ? (
            <Teclas partes={partesDaTecla(tecla)} />
          ) : (
            'Sem atalho'
          )}
        </button>
      </SettingRow>
      {erro && <ErrorText className="justify-end">{erro}</ErrorText>}
    </>
  )
}

export function AtalhosPage(): React.JSX.Element {
  const trocas = useTrocas()
  return (
    <Page
      trail={[SETTINGS_CRUMB, { label: 'Atalhos' }]}
      actions={
        Object.keys(trocas).length > 0 && (
          <Button
            variant="ghost"
            size="icon"
            className="animate-fade-in"
            aria-label="Voltar todos os atalhos ao padrão"
            title="Voltar todos os atalhos ao padrão"
            onClick={restaurarAtalhos}
          >
            <RotateCcw />
          </Button>
        )
      }
    >
      <div className="mx-auto max-w-[720px] px-8 pt-8 pb-16">
        <p className="mb-10 text-[13px] text-ink-soft">
          Clique num atalho e pressione as teclas novas. Esc cancela, {isMac ? '⌫' : 'Backspace'}{' '}
          deixa sem atalho.
        </p>
        <div className="flex flex-col gap-14">
          {GRUPOS_DE_ATALHO.map((grupo) => (
            <PageSection
              key={grupo.id}
              id={`atalhos-${grupo.id}`}
              title={grupo.titulo}
              description={DESCRICOES[grupo.id]}
            >
              <SettingsGroup rows>
                {ATALHOS.filter((a) => a.grupo === grupo.id).map((a) => (
                  <AtalhoRow key={a.id} atalho={a} />
                ))}
              </SettingsGroup>
            </PageSection>
          ))}
          <PageSection
            id="atalhos-fixos"
            title="Fixos"
            description="Seguem o padrão do sistema e não mudam."
          >
            <SettingsGroup rows>
              {ATALHOS_FIXOS.map((fixo) => (
                <SettingRow key={fixo.nome} title={fixo.nome}>
                  <span className="px-2">
                    <Teclas partes={fixo[PLATAFORMA]} />
                  </span>
                </SettingRow>
              ))}
            </SettingsGroup>
          </PageSection>
        </div>
      </div>
    </Page>
  )
}
