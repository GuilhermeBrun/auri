import type { ReactNode } from 'react'

function Svg({ children }: { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  )
}

export function Download() {
  return (
    <Svg>
      <>
        <path d="M12 15V3" />
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <path d="m7 10 5 5 5-5" />
      </>
    </Svg>
  )
}
export function ArrowUp() {
  return (
    <Svg>
      <>
        <path d="m5 12 7-7 7 7" />
        <path d="M12 19V5" />
      </>
    </Svg>
  )
}
export function Monitor() {
  return (
    <Svg>
      <>
        <rect width="20" height="14" x="2" y="3" rx="2" />
        <path d="M8 21h8" />
        <path d="M12 17v4" />
      </>
    </Svg>
  )
}
export function Sun() {
  return (
    <Svg>
      <>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2" />
        <path d="M12 20v2" />
        <path d="m4.93 4.93 1.41 1.41" />
        <path d="m17.66 17.66 1.41 1.41" />
        <path d="M2 12h2" />
        <path d="M20 12h2" />
        <path d="m6.34 17.66-1.41 1.41" />
        <path d="m19.07 4.93-1.41 1.41" />
      </>
    </Svg>
  )
}
export function Moon() {
  return (
    <Svg>
      <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
    </Svg>
  )
}
export function Pointer() {
  return (
    <Svg>
      <>
        <path d="M14 4.1 12 6" />
        <path d="m5.1 8-2.9-.8" />
        <path d="m6 12-1.9 2" />
        <path d="M7.2 2.2 8 5.1" />
        <path d="M9.037 9.69a.498.498 0 0 1 .653-.653l11 4.5a.5.5 0 0 1-.074.949l-4.349 1.041a1 1 0 0 0-.74.739l-1.04 4.35a.5.5 0 0 1-.95.074z" />
      </>
    </Svg>
  )
}
export function CalendarDays() {
  return (
    <Svg>
      <>
        <path d="M8 2v4" />
        <path d="M16 2v4" />
        <rect width="18" height="18" x="3" y="4" rx="2" />
        <path d="M3 10h18" />
        <path d="M8 14h.01" />
        <path d="M12 14h.01" />
        <path d="M16 14h.01" />
        <path d="M8 18h.01" />
        <path d="M12 18h.01" />
        <path d="M16 18h.01" />
      </>
    </Svg>
  )
}
export function Users() {
  return (
    <Svg>
      <>
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </>
    </Svg>
  )
}
export function Wallet() {
  return (
    <Svg>
      <>
        <path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1" />
        <path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4" />
      </>
    </Svg>
  )
}
export function Building() {
  return (
    <Svg>
      <>
        <path d="M10 12h4" />
        <path d="M10 8h4" />
        <path d="M14 21v-3a2 2 0 0 0-4 0v3" />
        <path d="M6 10H4a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-2" />
        <path d="M6 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16" />
      </>
    </Svg>
  )
}
export function CalendarCheck() {
  return (
    <Svg>
      <>
        <path d="M8 2v3" />
        <path d="M16 2v3" />
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <path d="M3 9h18" />
        <path d="m9 15 2 2 4-4" />
      </>
    </Svg>
  )
}
export function Hourglass() {
  return (
    <Svg>
      <>
        <path d="M5 22h14" />
        <path d="M5 2h14" />
        <path d="M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22" />
        <path d="M7 2v4.172a2 2 0 0 0 .586 1.414L12 12l4.414-4.414A2 2 0 0 0 17 6.172V2" />
      </>
    </Svg>
  )
}
export function PenLine() {
  return (
    <Svg>
      <>
        <path d="M13 21h8" />
        <path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z" />
      </>
    </Svg>
  )
}
export function Clock() {
  return (
    <Svg>
      <>
        <circle cx="12" cy="12" r="10" />
        <path d="M12 6v6l4 2" />
      </>
    </Svg>
  )
}
export function SlidersHorizontal() {
  return (
    <Svg>
      <>
        <path d="M10 5H3" />
        <path d="M12 19H3" />
        <path d="M14 3v4" />
        <path d="M16 17v4" />
        <path d="M21 12h-9" />
        <path d="M21 19h-5" />
        <path d="M21 5h-7" />
        <path d="M8 10v4" />
        <path d="M8 12H3" />
      </>
    </Svg>
  )
}
export function SunMoon() {
  return (
    <Svg>
      <>
        <path d="M12 2v2" />
        <path d="M14.837 16.385a6 6 0 1 1-7.223-7.222c.624-.147.97.66.715 1.248a4 4 0 0 0 5.26 5.259c.589-.255 1.396.09 1.248.715" />
        <path d="M16 12a4 4 0 0 0-4-4" />
        <path d="m19 5-1.256 1.256" />
        <path d="M20 12h2" />
      </>
    </Svg>
  )
}
export function Database() {
  return (
    <Svg>
      <>
        <ellipse cx="12" cy="5" rx="9" ry="3" />
        <path d="M3 5V19A9 3 0 0 0 21 19V5" />
        <path d="M3 12A9 3 0 0 0 21 12" />
      </>
    </Svg>
  )
}
export function ArrowLeft() {
  return (
    <Svg>
      <>
        <path d="m12 19-7-7 7-7" />
        <path d="M19 12H5" />
      </>
    </Svg>
  )
}
export function Send() {
  return (
    <Svg>
      <>
        <path d="M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z" />
        <path d="m21.854 2.147-10.94 10.939" />
      </>
    </Svg>
  )
}
export function FilePen() {
  return (
    <Svg>
      <>
        <path d="M14.364 13.634a2 2 0 0 0-.506.854l-.837 2.87a.5.5 0 0 0 .62.62l2.87-.837a2 2 0 0 0 .854-.506l4.013-4.009a1 1 0 0 0-3.004-3.004z" />
        <path d="M14.487 7.858A1 1 0 0 1 14 7V2" />
        <path d="M20 19.645V20a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l2.516 2.516" />
        <path d="M8 18h1" />
      </>
    </Svg>
  )
}
export function Laptop() {
  return (
    <Svg>
      <>
        <path d="M18 5a2 2 0 0 1 2 2v8.526a2 2 0 0 0 .212.897l1.068 2.127a1 1 0 0 1-.9 1.45H3.62a1 1 0 0 1-.9-1.45l1.068-2.127A2 2 0 0 0 4 15.526V7a2 2 0 0 1 2-2z" />
        <path d="M20.054 15.987H3.946" />
      </>
    </Svg>
  )
}
export function HardDrive() {
  return (
    <Svg>
      <>
        <path d="M10 16h.01" />
        <path d="M2.212 11.577a2 2 0 0 0-.212.896V18a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-5.527a2 2 0 0 0-.212-.896L18.55 5.11A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
        <path d="M21.946 12.013H2.054" />
        <path d="M6 16h.01" />
      </>
    </Svg>
  )
}
export function AuriSymbol() {
  return (
    <svg viewBox="-2 -2 122 116" fill="currentColor" aria-hidden="true">
      <path d="M10 51C3 52 0 46 1 37C5 16 29 0 52 0C84 0 105 19 106 47L106 66C106 76 109 80 113 84C123 96 116 110 102 110C90 110 82 103 74 92L63 77C56 67 49 67 41 73C31 80 27 89 31 96C35 103 44 106 48 109C34 114 15 111 7 101C-1 92-2 77 5 66C13 55 27 49 39 49C58 49 68 58 78 70C82 75 85 80 88 77C90 75 89 70 89 64L88 53C87 40 82 32 73 30C61 25 52 31 40 39L20 49C16 51 12 52 10 51Z" />
    </svg>
  )
}
export function Settings() {
  return (
    <Svg>
      <>
        <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
        <circle cx="12" cy="12" r="3" />
      </>
    </Svg>
  )
}
export function PanelLeftClose() {
  return (
    <Svg>
      <>
        <rect width="18" height="18" x="3" y="3" rx="2" />
        <path d="M9 3v18" />
        <path d="m16 15-3-3 3-3" />
      </>
    </Svg>
  )
}
export function ChevronLeft() {
  return (
    <Svg>
      <path d="m15 18-6-6 6-6" />
    </Svg>
  )
}
export function ChevronDown() {
  return (
    <Svg>
      <path d="m6 9 6 6 6-6" />
    </Svg>
  )
}
export function ChevronRight() {
  return (
    <Svg>
      <path d="m9 18 6-6-6-6" />
    </Svg>
  )
}
export function Plus() {
  return (
    <Svg>
      <>
        <path d="M5 12h14" />
        <path d="M12 5v14" />
      </>
    </Svg>
  )
}
export function Search() {
  return (
    <Svg>
      <>
        <circle cx="11" cy="11" r="8" />
        <path d="m21 21-4.3-4.3" />
      </>
    </Svg>
  )
}
export function Archive() {
  return (
    <Svg>
      <>
        <rect width="20" height="5" x="2" y="3" rx="1" />
        <path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8" />
        <path d="M10 12h4" />
      </>
    </Svg>
  )
}
export function Check() {
  return (
    <Svg>
      <path d="M20 6 9 17l-5-5" />
    </Svg>
  )
}
export function Trash() {
  return (
    <Svg>
      <>
        <path d="M3 6h18" />
        <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
        <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
      </>
    </Svg>
  )
}
export function X() {
  return (
    <Svg>
      <>
        <path d="M18 6 6 18" />
        <path d="m6 6 12 12" />
      </>
    </Svg>
  )
}

const SYMBOL_PATH =
  'M10 51C3 52 0 46 1 37C5 16 29 0 52 0C84 0 105 19 106 47L106 66C106 76 109 80 113 84C123 96 116 110 102 110C90 110 82 103 74 92L63 77C56 67 49 67 41 73C31 80 27 89 31 96C35 103 44 106 48 109C34 114 15 111 7 101C-1 92-2 77 5 66C13 55 27 49 39 49C58 49 68 58 78 70C82 75 85 80 88 77C90 75 89 70 89 64L88 53C87 40 82 32 73 30C61 25 52 31 40 39L20 49C16 51 12 52 10 51Z'

function Letters() {
  return (
    <>
      <g transform="translate(10 33) scale(0.64)">
        <path d={SYMBOL_PATH} />
      </g>
      <g transform="translate(-118 2)">
        <path d="M218 38H231C236 38 239 41 239 46V74C239 82 243 87 251 87C260 87 264 81 264 74V46C264 41 267 38 272 38H284V75C284 94 271 103 251 103C231 103 218 94 218 75V38Z" />
        <path d="M296 38H314V46C320 39 328 36 340 37V55C324 55 315 62 315 75V94C315 99 312 101 307 101H296V38Z" />
        <path d="M358 38H366C371 38 374 41 374 46V93C374 98 371 101 366 101H358C353 101 350 98 350 93V46C350 41 353 38 358 38Z" />
        <circle cx="362" cy="22" r="11" />
      </g>
    </>
  )
}

export function Wordmark() {
  return (
    <svg
      className="wordmark"
      viewBox="0 0 268 118"
      fill="currentColor"
      role="img"
      aria-label="Auri"
    >
      <Letters />
    </svg>
  )
}

export function WindowLogo() {
  return (
    <svg className="win-logo" viewBox="0 0 268 118" fill="currentColor" aria-hidden="true">
      <Letters />
    </svg>
  )
}
