import js from '@eslint/js'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  { ignores: ['dist', 'node_modules', 'src/content/generated', 'src-tauri'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    // 引擎纯度围栏:确定性是联网对战的生命线。
    // 引擎内禁止墙钟、非种子随机数,以及任何对 UI/应用层/React 的依赖。
    files: ['src/engine/**/*.ts'],
    ignores: ['src/engine/**/*.test.ts'],
    rules: {
      'no-restricted-globals': [
        'error',
        { name: 'Date', message: 'Engine must be deterministic — no wall clock.' },
        { name: 'performance', message: 'Engine must be deterministic — no timers.' },
        { name: 'crypto', message: 'Engine must use the seeded RNG in rng.ts.' },
      ],
      'no-restricted-properties': [
        'error',
        { object: 'Math', property: 'random', message: 'Engine must use the seeded RNG in rng.ts.' },
      ],
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['react', 'react-*', 'zustand', '**/ui/*', '**/app/*', '**/content/*', '**/ai/*'],
              message: 'Engine must stay pure — it may only import within src/engine/.',
            },
          ],
        },
      ],
    },
  },
)
