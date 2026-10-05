#!/usr/bin/env node
/**
 * 静态前端检查：HTML 骨架、CSS、main.js 语法、ESLint no-undef、无 CDN，
 * 以及若干「能跑但易藏坑」的维护向约束（LAYOUT/KEY_CLASS/OPERATORS/危险 API）。
 * 按键分发是否正确交给 Playwright 点击冒烟（含运行期报错收集），此处不强制 if/switch 写法。
 * 成功 exit 0，失败 exit 1。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const failures = [];

/** LAYOUT 允许的 kind；未知 kind 在现分发里会掉进最终 else → 误走 = */
const KNOWN_KINDS = new Set([
  'digit',
  'operator',
  'equals',
  'decimal',
  'clear',
  'backspace',
  'clearEntry',
  'sqrt',
  'square',
  'percent',
  'plusMinus',
  'reciprocal',
  'pi',
  'lparen',
  'rparen',
  'copy',
  'mc',
  'mr',
  'mplus',
  'mminus',
  'trig',
  'angleMode',
]);

function ok(msg) {
  console.log(`✅ ${msg}`);
}
function bad(msg) {
  console.log(`❌ ${msg}`);
  failures.push(msg);
}

/** 从 main.js 抽出 LAYOUT / KEY_CLASS / OPERATORS，做维护向一致性检查（不强制分发写法）。 */
function checkMaintainability(js) {
  const layoutMatch = js.match(/const LAYOUT\s*=\s*\[([\s\S]*?)\];/);
  if (!layoutMatch) {
    bad('未找到 const LAYOUT = [...]，无法做键位一致性检查');
    return;
  }
  const pairs = [...layoutMatch[1].matchAll(/\[\s*'((?:\\'|[^'])*)'\s*,\s*'((?:\\'|[^'])*)'\s*\]/g)].map(
    (m) => [m[1], m[2]],
  );
  if (pairs.length === 0) {
    bad('LAYOUT 解析结果为空');
    return;
  }
  ok(`LAYOUT 解析到 ${pairs.length} 个键位`);

  const labels = pairs.map(([label]) => label);
  const dup = labels.filter((l, i) => labels.indexOf(l) !== i);
  if (dup.length) bad(`LAYOUT 标签重复：${[...new Set(dup)].join(', ')}`);
  else ok('LAYOUT 标签无重复');

  const kinds = [...new Set(pairs.map(([, kind]) => kind))];
  const unknown = kinds.filter((k) => !KNOWN_KINDS.has(k));
  if (unknown.length) {
    bad(
      `LAYOUT 出现未知 kind（会掉进最终 else 误走 =）：${unknown.join(', ')}；已知：${[...KNOWN_KINDS].join(', ')}`,
    );
  } else {
    ok('LAYOUT kind 均在已知白名单内');
  }

  const keyClassMatch = js.match(/const KEY_CLASS\s*=\s*\{([\s\S]*?)\};/);
  if (!keyClassMatch) {
    bad('未找到 const KEY_CLASS = {...}');
  } else {
    const keyClassBody = keyClassMatch[1];
    // 缺条目时 className 变成 `key undefined`，页面能跑但样式/语义都漂
    const missingAll = kinds.filter((k) => !new RegExp(`\\b${k}\\s*:`).test(keyClassBody));
    if (missingAll.length) bad(`KEY_CLASS 未覆盖 LAYOUT kind：${missingAll.join(', ')}`);
    else ok('KEY_CLASS 覆盖全部 LAYOUT kind');
  }

  const opsMatch = js.match(/const OPERATORS\s*=\s*\{([\s\S]*?)\};/);
  if (!opsMatch) {
    bad('未找到 const OPERATORS = {...}');
  } else {
    const opLabels = pairs.filter(([, kind]) => kind === 'operator').map(([label]) => label);
    const missingOps = opLabels.filter((label) => !opsMatch[1].includes(`'${label}'`));
    if (missingOps.length) bad(`OPERATORS 缺少 operator 键面实现：${missingOps.join(', ')}`);
    else ok(`OPERATORS 覆盖全部 operator 键（${opLabels.join(', ') || '无'}）`);
  }

  if (/\beval\s*\(|new\s+Function\s*\(/.test(js)) {
    bad('js/main.js 出现 eval / new Function（隐藏执行风险，训练场禁止）');
  } else {
    ok('js/main.js 无 eval / new Function');
  }

  // 空 catch：catch (_) {} / catch (e) { } —— 吞错会让「能跑但坏了」更难发现
  if (/catch\s*\([^)]*\)\s*\{\s*\}/.test(js)) {
    bad('js/main.js 存在空 catch（吞错藏病）');
  } else {
    ok('js/main.js 无空 catch');
  }
}

const htmlPath = path.join(root, 'index.html');
const cssPath = path.join(root, 'css', 'style.css');
const jsPath = path.join(root, 'js', 'main.js');

if (!fs.existsSync(htmlPath)) bad('缺少 index.html');
else {
  const html = fs.readFileSync(htmlPath, 'utf8');
  for (const id of ['display-main', 'display-sub', 'keyboard', 'history-panel', 'history-list']) {
    if (html.includes(`id="${id}"`)) ok(`HTML 含 #${id}`);
    else bad(`HTML 缺少 #${id}`);
  }
  if (/href=["']css\/style\.css["']/.test(html)) ok('HTML 引用 css/style.css');
  else bad('HTML 未引用 css/style.css');
  if (/src=["']js\/main\.js["']/.test(html)) ok('HTML 引用 js/main.js');
  else bad('HTML 未引用 js/main.js');
  if (/<script[^>]+src=["']https?:\/\//i.test(html)) bad('HTML 引入了外部 script CDN');
  else ok('HTML 无外部 script CDN');
}

if (!fs.existsSync(cssPath)) bad('缺少 css/style.css');
else {
  const css = fs.readFileSync(cssPath, 'utf8');
  if (css.trim().length < 20) bad('css/style.css 内容过短');
  else ok(`css/style.css 存在（${css.length} 字节）`);
  for (const sel of ['.display__main', '.keyboard', '.history-panel']) {
    if (css.includes(sel)) ok(`CSS 含 ${sel}`);
    else bad(`CSS 缺少 ${sel}`);
  }
}

async function runEslintNoUndef() {
  let ESLint;
  let globals;
  try {
    ({ ESLint } = await import(pathToFileURL(path.join(__dirname, 'node_modules/eslint/lib/api.js')).href));
    globals = (await import(pathToFileURL(path.join(__dirname, 'node_modules/globals/index.js')).href)).default;
  } catch (e) {
    bad(`缺少 ci/ ESLint 依赖（请在 ci/ 执行 npm ci）：${e.message}`);
    return;
  }

  const eslint = new ESLint({
    cwd: root,
    // 不读取仓库其它配置；只开 no-undef，不加风格规则
    overrideConfigFile: true,
    overrideConfig: [
      {
        files: ['js/main.js'],
        languageOptions: {
          ecmaVersion: 2022,
          sourceType: 'script',
          globals: globals.browser,
        },
        rules: {
          'no-undef': 'error',
        },
      },
    ],
  });

  const results = await eslint.lintFiles(['js/main.js']);
  const result = results[0];
  if (!result || result.errorCount === 0) {
    ok('js/main.js ESLint no-undef 通过');
    return;
  }
  const lines = result.messages
    .filter((m) => m.severity === 2)
    .slice(0, 20)
    .map((m) => `  L${m.line}:${m.column} ${m.message}${m.ruleId ? ` (${m.ruleId})` : ''}`);
  bad(`js/main.js ESLint no-undef 失败（${result.errorCount}）：\n${lines.join('\n')}`);
}

async function main() {
  if (!fs.existsSync(jsPath)) {
    bad('缺少 js/main.js');
  } else {
    const js = fs.readFileSync(jsPath, 'utf8');
    const syn = spawnSync(process.execPath, ['--check', jsPath], { encoding: 'utf8' });
    if (syn.status === 0) ok('js/main.js 语法通过（node --check）');
    else bad(`js/main.js 语法失败：${(syn.stderr || syn.stdout || '').trim()}`);

    if (/\bimport\s+|require\s*\(|from\s+['"][^'"]+['"]/.test(js)) {
      bad('js/main.js 出现 import/require（训练场要求原生单文件）');
    } else {
      ok('js/main.js 无 import/require');
    }
    if (/https?:\/\/cdn\.|unpkg\.com|jsdelivr\.net/i.test(js)) {
      bad('js/main.js 疑似引用 CDN');
    } else {
      ok('js/main.js 无 CDN 痕迹');
    }

    checkMaintainability(js);
    await runEslintNoUndef();
  }

  if (failures.length) {
    console.error(`\n静态检查失败 ${failures.length} 项`);
    process.exit(1);
  }
  console.log('\n静态检查全部通过');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
