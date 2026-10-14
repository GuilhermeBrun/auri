import { resolve } from 'node:path'
import { existsSync, readFileSync } from 'node:fs'
import { defineConfig } from 'vite-plus'
import type { UserConfig as ElectronConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import type { Plugin } from 'vite'

// Registra os pacotes que realmente entraram nos chunks distribuídos do renderer.
const inventory: Plugin = {
  name: 'auri-bundle-inventory',
  generateBundle(_options, bundle) {
    const packages = new Map<string, { name: string; version: string }>()
    for (const chunk of Object.values(bundle)) {
      if (chunk.type !== 'chunk') continue
      for (const moduleId of Object.keys(chunk.modules)) {
        const id = moduleId.replaceAll('\\', '/').split('?')[0]
        const marker = '/node_modules/'
        const start = id.lastIndexOf(marker)
        if (start < 0) continue
        const parts = id.slice(start + marker.length).split('/')
        const name = parts.slice(0, parts[0].startsWith('@') ? 2 : 1).join('/')
        const file = `${id.slice(0, start + marker.length)}${name}/package.json`
        if (!existsSync(file)) continue
        const value = JSON.parse(readFileSync(file, 'utf8')) as { name: string; version: string }
        packages.set(`${value.name}@${value.version}`, { name: value.name, version: value.version })
      }
    }
    this.emitFile({
      type: 'asset',
      fileName: 'component-inventory.json',
      source: JSON.stringify([...packages.values()].sort((a, b) => a.name.localeCompare(b.name)))
    })
  }
}

// O adaptador electron.vite.config.ts repassa estes três alvos ao electron-vite.
const electron: ElectronConfig = {
  main: {},
  preload: {},
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src'),
        '@shared': resolve('src/shared')
      }
    },
    plugins: [react(), tailwindcss(), inventory],
    build: { minify: true }
  }
}

const quality = process.env.AURI_QUALITY === '1'
const generated = ['**/node_modules/**', '**/out/**', '**/dist/**', '.quality/**', '.vite-plus/**']

export default defineConfig({
  ...electron,
  resolve: {
    alias: {
      '@renderer': resolve('src/renderer/src'),
      '@shared': resolve('src/shared')
    }
  },
  fmt: {
    singleQuote: true,
    semi: false,
    printWidth: 100,
    trailingComma: 'none',
    sortImports: false,
    sortPackageJson: false,
    ignorePatterns: [...generated, 'research_notes/**', 'reports/**', 'LICENSE.md']
  },
  lint: {
    plugins: ['typescript', 'react', 'unicorn', 'oxc'],
    categories: { correctness: 'error' },
    ignorePatterns: [...generated, 'research_notes/**', 'reports/**'],
    options: { typeAware: true, typeCheck: true, maxWarnings: 0 },
    rules: {
      'react/rules-of-hooks': 'error',
      'react/exhaustive-deps': 'error',
      'react/only-export-components': ['error', { allowConstantExport: true }],
      'typescript/no-unused-vars': ['error', { argsIgnorePattern: '^_', ignoreRestSiblings: true }],
      'typescript/no-explicit-any': 'error'
    }
  },
  test: {
    include: ['src/**/*.test.{ts,tsx}'],
    environment: 'node',
    passWithNoTests: false,
    retry: 0,
    coverage: {
      provider: 'v8',
      enabled: quality,
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.test.{ts,tsx}', 'src/**/*.d.ts'],
      reportsDirectory: '.quality/coverage',
      reporter: ['text-summary', 'json', 'json-summary', 'lcov', 'html']
    },
    ...(quality
      ? {
          reporters: ['default', 'json', 'junit'],
          outputFile: {
            json: '.quality/tests.json',
            junit: '.quality/junit.xml'
          }
        }
      : {})
  }
})
