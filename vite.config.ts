import { resolve } from 'node:path'
import { defineConfig } from 'vite-plus'
import type { UserConfig as ElectronConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

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
    plugins: [react(), tailwindcss()],
    build: { minify: true }
  }
}

const quality = process.env.AURI_QUALITY === '1'
const generated = ['**/node_modules/**', '**/out/**', '**/dist/**', '.quality/**', '.vite-plus/**']

export default defineConfig({
  ...electron,
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
