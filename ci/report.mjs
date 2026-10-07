#!/usr/bin/env node
/**
 * 把静态检查 + Playwright JSON 结果拼成 PR 评论正文（stdout）。
 * 环境变量：
 *   STATIC_STATUS=success|failure|skipped
 *   PLAYWRIGHT_STATUS=success|failure|skipped
 *   REPORT_JSON=path (default: test-results/report.json)
 *   RUN_URL=actions run url
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const reportPath = process.env.REPORT_JSON || path.join(__dirname, 'test-results', 'report.json');
const staticStatus = process.env.STATIC_STATUS || process.env.SYNTAX_STATUS || 'skipped';
const pwStatus = process.env.PLAYWRIGHT_STATUS || 'skipped';
const runUrl = process.env.RUN_URL || '';

const icon = (ok) => (ok === true ? '✅' : ok === false ? '❌' : '➖');
const statusOk = (s) => (s === 'success' ? true : s === 'failure' ? false : null);

/** 去掉 Playwright 等终端颜色码，避免 PR 评论备注栏乱码 */
function stripAnsi(text) {
  return String(text ?? '')
    .replace(/\u001B\[[\d;]*[A-Za-z]/g, '')
    .replace(/\u009B[\d;]*[A-Za-z]/g, '')
    .replace(/\uFFFD\[([\d;]*)[A-Za-z]/g, '')
    // ESC 丢失后残留的 [31m / [2m / [22m 等
    .replace(/\[\d{1,3}(?:;\d{1,3})*m/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** 仍故意不锁、靠人工看的点 */
const NOT_COVERED = [
  '像素级视觉回归 / 响应式布局截图对比（已锁按键 .key 背景色与主屏右对齐）',
  '超长数字精度与显示截断、科学计数法、字号自适应像素细节',
  '复制失败路径（无 clipboard API 时「复制失败」）',
  '历史条目完整文案格式与滚动交互细节（已锁回填/清空）',
  '无障碍（ARIA 完整性、键盘焦点环）',
  '纯样式（圆角/动画/滚动条外观、主题品味）',
  '音效听感 / AudioContext 浏览器差异',
  '候选人 PR 自拟、尚未合入 develop 的新功能（存在才测的键除外，如 mod / 奇偶）',
  'T/CT/占题等人审条例（CI 不替代 CODEOWNERS）',
];

function loadCases() {
  if (!fs.existsSync(reportPath)) {
    return { cases: [], error: `未找到 Playwright 报告：\`${path.relative(process.cwd(), reportPath)}\`` };
  }
  const data = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
  const cases = [];

  function walk(suite, prefix = '') {
    for (const spec of suite.specs || []) {
      const title = prefix ? `${prefix} › ${spec.title}` : spec.title;
      const results = (spec.tests || []).flatMap((t) => t.results || []);
      const last = results[results.length - 1];
      let ok = null;
      let detail = '';
      if (!last) {
        ok = spec.ok === true;
      } else if (last.status === 'passed' || last.status === 'expected') {
        ok = true;
      } else if (last.status === 'skipped') {
        ok = null;
        detail = 'skipped';
      } else {
        ok = false;
        detail = stripAnsi(last.error?.message?.split('\n')[0] || last.status);
      }
      cases.push({ title, ok, detail });
    }
    for (const child of suite.suites || []) {
      const next = prefix ? `${prefix} › ${child.title}` : child.title;
      walk(child, next);
    }
  }

  for (const suite of data.suites || []) {
    walk(suite);
  }
  return { cases, error: null };
}

const { cases, error } = loadCases();
const staticOk = statusOk(staticStatus);
const allPwOk = cases.length > 0 && cases.every((c) => c.ok === true);
const overall =
  staticOk === true && (pwStatus === 'success' || allPwOk)
    ? true
    : staticOk === false || pwStatus === 'failure' || cases.some((c) => c.ok === false)
      ? false
      : null;

const lines = [];
lines.push(overall === true ? '## ✅ Reviewer CI 报告' : overall === false ? '## ❌ Reviewer CI 报告' : '## ➖ Reviewer CI 报告');
lines.push('');
lines.push(
  '覆盖范围：**语法 + ESLint no-undef + LAYOUT/KEY_CLASS/OPERATORS（含后置注册）+ 样式类落盘 + 禁 prompt/alert/confirm + 静态前端骨架/CSS + Playwright 基线（π/%/±/括号/三角/xʸ/历史回填）+ 前端按键样式/无弹窗 + 已合键抽查（mod/奇偶若存在）+ 健壮性与运行期报错**（非像素级视觉全量）。',
);
lines.push(`触发口令：\`/ci\` · 仅 \`@GXMZU-AITECC/reviewers\` 可启动`);
if (runUrl) lines.push(`完整日志：[Actions run](${runUrl})`);
lines.push('');

lines.push('### 1. 语法与静态前端');
lines.push('');
lines.push(`| 项 | 结果 |`);
lines.push(`| --- | --- |`);
lines.push(`| HTML/CSS/\`main.js\` 语法 · ESLint no-undef · 无 CDN·import | ${icon(staticOk)} ${staticStatus} |`);
lines.push('');

lines.push('### 2. 已跑功能与前端案例（浏览器）');
lines.push('');
if (error) {
  lines.push(`> ${error}`);
  lines.push('');
  lines.push(`Playwright 步骤状态：${icon(statusOk(pwStatus))} ${pwStatus}`);
  lines.push('');
} else if (cases.length === 0) {
  lines.push('_没有解析到任何用例（可能安装或启动失败）。_');
  lines.push('');
} else {
  lines.push('| # | 案例 | 结果 | 备注 |');
  lines.push('| --- | --- | --- | --- |');
  cases.forEach((c, i) => {
    const note = c.detail
      ? stripAnsi(c.detail).replace(/\|/g, '\\|').replace(/\r?\n/g, ' ').slice(0, 120)
      : '';
    lines.push(`| ${i + 1} | ${c.title} | ${icon(c.ok)} | ${note} |`);
  });
  const passed = cases.filter((c) => c.ok === true).length;
  const failed = cases.filter((c) => c.ok === false).length;
  const skipped = cases.filter((c) => c.ok === null).length;
  lines.push('');
  lines.push(`小结：通过 **${passed}** / 失败 **${failed}** / 跳过 **${skipped}** / 共 **${cases.length}**`);
  lines.push('');
}

lines.push('### 3. 本套 CI 没做（未覆盖）');
lines.push('');
lines.push('仍靠人工看：');
lines.push('');
for (const item of NOT_COVERED) {
  lines.push(`- [ ] ${item}`);
}
lines.push('');
lines.push('_加案例：改 `ci/smoke.spec.mjs` 或 `ci/static-check.mjs`，并同步本列表。_');
lines.push('');

process.stdout.write(lines.join('\n'));
process.exit(overall === false ? 1 : 0);
