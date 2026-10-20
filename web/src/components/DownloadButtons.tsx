import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import {
  longDate,
  megabytes,
  SYSTEMS,
  type DownloadInfo,
  type Installer,
  type Os
} from '../releases'
import { Check, ChevronDown, Download } from './icons'
import { moveThumb, noSubscription, useBrowserLayoutEffect } from '../lib/dom'

function detectSystem(): Os | null {
  const ua = navigator.userAgent
  const mobile =
    /Android|iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)
  const data = (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData
  const platform = data?.platform || navigator.platform || ua
  if (mobile) return null
  return /mac/i.test(platform) ? 'mac' : /win/i.test(platform) ? 'win' : null
}

type Channel = 'stable' | 'alpha'

function VersionMenu({
  info,
  channel,
  onPick,
  onClose
}: {
  info: DownloadInfo
  channel: Channel
  onPick: (channel: Channel) => void
  onClose: () => void
}) {
  const menu = useRef<HTMLDivElement>(null)
  useEffect(() => {
    menu.current?.querySelector<HTMLElement>('[aria-checked="true"]')?.focus()
    const outside = (event: PointerEvent) => {
      if (!menu.current?.parentElement?.contains(event.target as Node)) onClose()
    }
    document.addEventListener('pointerdown', outside)
    return () => document.removeEventListener('pointerdown', outside)
  }, [onClose])
  const items: { value: Channel; title: string; text: string }[] = [
    {
      value: 'stable',
      title: 'Estável',
      text: `Versão ${info.version} · ${longDate(info.publishedAt)}`
    },
    {
      value: 'alpha',
      title: 'Alpha',
      text: `Versão de teste · ${longDate(info.alpha!.publishedAt)}`
    }
  ]
  return (
    <div ref={menu} className="version-menu" role="menu" aria-label="Versão">
      {items.map((item) => (
        <button
          key={item.value}
          type="button"
          role="menuitemradio"
          aria-checked={channel === item.value}
          onClick={() => onPick(item.value)}
        >
          <span className="version-text">
            <b>{item.title}</b>
            <span>{item.text}</span>
          </span>
          <span className="version-check" aria-hidden="true">
            {channel === item.value && <Check />}
          </span>
        </button>
      ))}
    </div>
  )
}

export function DownloadButtons({ info }: { info: DownloadInfo }) {
  const { options } = info
  const [channel, setChannel] = useState<Channel>('stable')
  const [menu, setMenu] = useState<Os | null>(null)
  const toggles = useRef(new Map<Os, HTMLButtonElement | null>())
  const preview = (os: Os) => info.alpha?.options.find((option) => option.os === os)
  const pick = (option: Installer) =>
    channel === 'alpha' ? (preview(option.os) ?? option) : option
  const closeMenu = (focus: boolean) => {
    if (focus && menu) toggles.current.get(menu)?.focus()
    setMenu(null)
  }
  const dismiss = useCallback(() => setMenu(null), [])
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
          const chosen = pick(option)
          const isPreview = chosen !== option
          const selectable = shown !== undefined && primary && preview(option.os) !== undefined
          const meta = [
            isPreview && 'Versão de teste',
            SYSTEMS[option.os].requires,
            chosen.size && megabytes(chosen.size)
          ]
            .filter(Boolean)
            .join(' · ')
          const label = `Baixar ${isPreview ? 'alpha ' : ''}para ${SYSTEMS[option.os].label}`
          const button = (
            <a
              className={`btn ${primary ? 'btn-primary' : 'btn-secondary'}`}
              href={chosen.url}
              download
            >
              <Download />
              <span>{label}</span>
            </a>
          )
          return (
            <div
              key={option.os}
              className="choice"
              data-os={option.os}
              hidden={shown !== undefined && option.os !== shown}
            >
              {selectable ? (
                <div
                  className="split-wrap"
                  onKeyDown={(event) => {
                    if (event.key === 'Escape' && menu) closeMenu(true)
                  }}
                >
                  <div className="split">
                    {button}
                    <button
                      ref={(element) => {
                        toggles.current.set(option.os, element)
                      }}
                      type="button"
                      className="btn btn-primary split-toggle"
                      aria-label="Escolher a versão"
                      aria-haspopup="menu"
                      aria-expanded={menu === option.os}
                      onClick={() => setMenu(menu === option.os ? null : option.os)}
                    >
                      <ChevronDown />
                    </button>
                  </div>
                  {menu === option.os && (
                    <VersionMenu
                      info={info}
                      channel={channel}
                      onPick={(value) => {
                        setChannel(value)
                        closeMenu(true)
                      }}
                      onClose={dismiss}
                    />
                  )}
                </div>
              ) : (
                button
              )}
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
              <a href={pick(other).url} download>
                {SYSTEMS[other.os].label}
              </a>
            </>
          )}
        </p>
      )}
    </div>
  )
}
