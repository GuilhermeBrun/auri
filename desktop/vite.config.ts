import { execFileSync } from 'node:child_process'
import { resolve } from 'node:path'
import { defineConfig } from 'vite-plus'
import type { UserConfig as ElectronConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const alias = {
  '@renderer': resolve('src/renderer/src'),
  '@shared': resolve('src/shared')
}

const maps = { build: { sourcemap: 'hidden' as const } }

function localVersion(): string {
  try {
    const described = execFileSync('git', ['describe', '--tags', '--match', 'v*', '--abbrev=7'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore']
    }).trim()
    const [, tag, ahead, sha] = /^v(.+?)(?:-(\d+)-g([0-9a-f]+))?$/.exec(described) ?? []
    return ahead ? `${tag}+${ahead}.${sha}` : (tag ?? '')
  } catch {
    return ''
  }
}

const electron: ElectronConfig = {
  main: { ...maps, define: { __AURI_LOCAL_VERSION__: JSON.stringify(localVersion()) } },
  preload: maps,
  renderer: {
    resolve: { alias },
    plugins: [react(), tailwindcss()],
    server: { fs: { allow: [resolve('..')] } },
    build: { ...maps.build, minify: true }
  }
}

const generated = ['**/node_modules/**', '**/out/**', '**/dist/**', '.quality/**', '.vite-plus/**']

export default defineConfig({
  ...electron,
  resolve: { alias },
  fmt: {
    singleQuote: true,
    semi: false,
    printWidth: 100,
    trailingComma: 'none',
    sortImports: false,
    sortPackageJson: false,
    ignorePatterns: [...generated, 'LICENSE.md']
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
    include: ['src/**/*.test.{ts,tsx}'],
    environment: 'node',
    passWithNoTests: false,
    retry: 0
  }
})
