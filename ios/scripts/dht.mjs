import createTestnet from 'hyperdht/testnet.js'

const testnet = await createTestnet(3)
console.log(`bootstrap ${testnet.bootstrap.map(({ host, port }) => `${host}:${port}`).join(',')}`)
process.on('SIGTERM', async () => {
  await testnet.destroy()
  process.exit(0)
})
