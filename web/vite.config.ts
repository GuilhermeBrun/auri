import react from '@vitejs/plugin-react'
import { defineConfig, lazyPlugins } from 'vite-plus'

const generated = ['**/node_modules/**', '**/dist/**', '**/dist-ssr/**', '.vite-plus/**']

export default defineConfig({
  plugins: lazyPlugins(() => [react()]),
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
    include: ['src/**/*.test.{ts,tsx}', 'tests/**/*.test.ts'],
    environment: 'node',
    passWithNoTests: false,
    retry: 0
  }
})
