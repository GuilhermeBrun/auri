declare const Bare: {
  IPC: {
    on(event: 'data', listener: (data: Buffer) => void): void
    write(data: Buffer): boolean
  }
  argv: string[]
  on(event: 'uncaughtException', listener: (error: Error) => void): void
  on(event: 'unhandledRejection', listener: (reason: unknown) => void): void
}
