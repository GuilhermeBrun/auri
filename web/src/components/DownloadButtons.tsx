import { useRef, useState, useSyncExternalStore } from 'react'
import { megabytes, SYSTEMS, type Installer, type Os } from '../releases'
import { Download } from './icons'
import { moveThumb, noSubscription, useBrowserLayoutEffect } from '../lib/dom'

/** Sistema de quem visita: Windows ou Mac no computador; nada no celular ou num sistema desconhecido. */
function detectSystem(): Os | null {
  const ua = navigator.userAgent
  const mobile =
    /Android|iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)
  const data = (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData
  const platform = data?.platform || navigator.platform || ua
  if (mobile) return null
  return /mac/i.test(platform) ? 'mac' : /win/i.test(platform) ? 'win' : null
}

/**
 * Bloco de download. Sem script (HTML pré-renderizado) aparecem os dois botões, Windows primeiro.
 * No navegador fica só o do sistema de quem visita, com um link para o outro; no celular ou num
 * sistema desconhecido, um seletor Windows/Mac e um botão só.
 */
export function DownloadButtons({ options }: { options: Installer[] }) {
  // `undefined` na pré-renderização e na hidratação: os dois botões, como no HTML sem script
  const system = useSyncExternalStore(noSubscription, detectSystem, () => undefined)
  const [picked, setPicked] = useState<Os | null>(null)
  const switcher = useRef<HTMLDivElement>(null)
  const [first, second] = options
  const detected = system && options.some((option) => option.os === system) ? system : null
  const layout =
    !second || system === undefined
      ? null
      : detected
        ? { kind: 'system' as const, os: detected }
        : { kind: 'switch' as const, os: picked ?? first.os }

  // O bloco do seletor desliza até o sistema escolhido; na primeira vez, e quando a fonte chega,
  // sem animação.
  const animate = useRef(false)
  const switchOs = layout?.kind === 'switch' ? layout.os : null
  useBrowserLayoutEffect(() => {
    if (!switchOs) return
    const group = switcher.current
    const place = (smooth: boolean) =>
      moveThumb(group, group?.querySelector('[aria-pressed="true"]'), smooth)
    place(animate.current)
    animate.current = true
    void document.fonts?.ready.then(() => place(false))
  }, [switchOs])

  const shown = layout?.os
  const other = layout?.kind === 'system' ? options.find((option) => option.os !== shown) : null
  return (
    <div className="download" data-download="">
      {second && (
        <div
          ref={switcher}
          className="os-switch"
          data-os-switch=""
          hidden={layout?.kind !== 'switch'}
        >
          <i className="thumb" aria-hidden="true" />
          {options.map((option) => (
            <button
              key={option.os}
              type="button"
              data-pick={option.os}
              aria-pressed={(shown ?? first.os) === option.os}
              onClick={() => setPicked(option.os)}
            >
              {SYSTEMS[option.os].label}
            </button>
          ))}
        </div>
      )}
      <div className="choices" data-choices="">
        {options.map((option, index) => {
          const primary = shown ? option.os === shown : index === 0
          const meta = [SYSTEMS[option.os].requires, option.size && megabytes(option.size)]
            .filter(Boolean)
            .join(' · ')
          return (
            <div
              key={option.os}
              className="choice"
              data-os={option.os}
              hidden={shown !== undefined && option.os !== shown}
            >
              <a
                className={`btn ${primary ? 'btn-primary' : 'btn-secondary'}`}
                href={option.url}
                download
              >
                <Download />
                <span>{`Baixar para ${SYSTEMS[option.os].label}`}</span>
              </a>
              <span className="meta">{meta}</span>
            </div>
          )
        })}
      </div>
      {second && (
        <p className="other meta" data-other="" hidden={!other}>
          {other && (
            <>
              {'Também para '}
              <a href={other.url} download>
                {SYSTEMS[other.os].label}
              </a>
            </>
          )}
        </p>
      )}
    </div>
  )
}
