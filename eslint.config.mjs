// Lint com informação de tipos: além do `any` explícito, barra valores `any`
// que chegam de bibliotecas (ex.: JSON.parse, res.json()) e se espalham pelo código.
import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  // contract-check/ só tem tipos e é verificado pelo `npm run check:contracts`.
  { ignores: ['dist/', 'node_modules/', 'contract-check/', 'eslint.config.mjs'] },
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  {
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname }
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unsafe-argument': 'error',
      '@typescript-eslint/no-unsafe-assignment': 'error',
      '@typescript-eslint/no-unsafe-call': 'error',
      '@typescript-eslint/no-unsafe-member-access': 'error',
      '@typescript-eslint/no-unsafe-return': 'error',
      '@typescript-eslint/explicit-function-return-type': ['error', { allowExpressions: true }],
      // Parâmetros exigidos pela assinatura (ex.: `_next` do handler de erro do Express).
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-confusing-void-expression': ['error', { ignoreArrowShorthand: true }],
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }]
    }
  }
);
