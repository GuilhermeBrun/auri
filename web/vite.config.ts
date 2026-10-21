import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig, lazyPlugins, type Connect, type Plugin } from 'vite-plus'

const pagina = (caminho: string) => fileURLToPath(new URL(caminho, import.meta.url))

const PAGINAS = ['/assinar', '/recebido', '/confirmar', '/resposta']

const semBarra: Connect.NextHandleFunction = (pedido, _resposta, seguir) => {
  const url = pedido.url ?? ''
  const caminho = url.split(/[?#]/)[0]
  if (PAGINAS.includes(caminho)) pedido.url = `${caminho}/${url.slice(caminho.length)}`
  seguir()
}

const paginasSemBarra: Plugin = {
  name: 'paginas-sem-barra',
  configureServer: (servidor) => void servidor.middlewares.use(semBarra),
  configurePreviewServer: (servidor) => void servidor.middlewares.use(semBarra)
}

const generated = ['**/node_modules/**', '**/dist/**', '**/dist-ssr/**', '.vite-plus/**']

export default defineConfig({
  plugins: lazyPlugins(() => [react(), paginasSemBarra]),
  build: {
    rolldownOptions: {
      input: {
        principal: pagina('./index.html'),
        assinar: pagina('./assinar/index.html'),
        recebido: pagina('./recebido/index.html'),
        confirmar: pagina('./confirmar/index.html'),
        resposta: pagina('./resposta/index.html')
      }
    }
  },
  fmt: {
    singleQuote: true,
    semi: false,
    printWidth: 100,
    trailingComma: 'none',
    sortImports: false,
    sortPackageJson: false,
    ignorePatterns: generated
  },
  lint: {
    plugins: ['typescript', 'react', 'unicorn', 'oxc'],
    categories: { correctness: 'error' },
    ignorePatterns: generated,
    options: { typeAware: true, typeCheck: true, maxWarnings: 0 },
    jsPlugins: [{ name: 'vite-plus', specifier: 'vite-plus/oxlint-plugin' }],
    rules: {
      'react/rules-of-hooks': 'error',
      'react/exhaustive-deps': 'error',
      'react/only-export-components': ['error', { allowConstantExport: true }],
      'typescript/no-unused-vars': ['error', { argsIgnorePattern: '^_', ignoreRestSiblings: true }],
      'typescript/no-explicit-any': 'error',
      'vite-plus/prefer-vite-plus-imports': 'error'
    }
  },
  staged: {
    '*': 'vp check --fix'
  },
  test: {
    include: ['src/**/*.test.{ts,tsx}', 'tests/**/*.test.ts', 'contrato/**/*.test.ts'],
    environment: 'node',
    passWithNoTests: false,
    fileParallelism: !process.env.TEST_DATABASE_URL,
    retry: 0
  }
})
