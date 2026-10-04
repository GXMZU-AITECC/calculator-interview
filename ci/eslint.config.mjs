/**
 * 供 `npm run lint:undef` 使用；与 static-check.mjs 内联配置一致：只开 no-undef。
 * 注意：从仓库根目录执行，或使用 package.json 里的脚本（已设置 cwd 语义）。
 */
import globals from 'globals';

/** @type {import('eslint').Linter.Config[]} */
export default [
  {
    files: ['js/main.js', '**/js/main.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'script',
      globals: {
        ...globals.browser,
      },
    },
    rules: {
      'no-undef': 'error',
    },
  },
];
