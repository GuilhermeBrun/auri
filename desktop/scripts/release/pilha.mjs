import { SourceMap } from 'node:module'

const FRAME = /app\.asar[\\/](out[\\/][^:()\s]+\.js):(\d+):(\d+)/

export function symbolicate(stack, readMap) {
  const maps = new Map()
  const load = (file) => {
    if (!maps.has(file)) {
      const text = readMap(`${file}.map`)
      maps.set(file, text ? new SourceMap(JSON.parse(text)) : null)
    }
    return maps.get(file)
  }
  return stack
    .split('\n')
    .map((line) => {
      const match = FRAME.exec(line)
      if (!match) return line
      const entry = load(match[1].replaceAll('\\', '/'))?.findEntry(
        Number(match[2]) - 1,
        Number(match[3]) - 1
      )
      if (!entry?.originalSource) return line
      const where = `${entry.originalSource}:${entry.originalLine + 1}:${entry.originalColumn + 1}`
      const name = entry.name ?? /at (\S+) \(/.exec(line)?.[1]
      return name ? `at ${name} (${where})` : `at ${where}`
    })
    .join('\n')
}
