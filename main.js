const displayMain = document.getElementById('display-main');
const displaySub = document.getElementById('display-sub');
const keyboard = document.getElementById('keyboard');

/**
 * 加法：把两个数相加。
 * @param {number} a 加数
 * @param {number} b 被加数
 * @returns {number} 两数之和
 */
function add(a, b) {
  return a + b;
}
/* ==========================================================================
 * 网页计算器 · 括号优先级（单文件版）
 * --------------------------------------------------------------------------
 * 一个文件同时满足两种用法：
 *
 *   ① 浏览器：<script src="calculator.single.js"></script>
 *      · 自动接管页面交互（点击、键盘输入、提示条）
 *      · 页面需存在 #expression / #result / #keys / #hint 这几个节点
 *      · 控制台可直接调用：Calculator.calc('(1+2)*3')
 *
 *   ② Node 自测：node calculator.single.js
 *      · 自动跑 23 条用例并输出通过数，失败时退出码为 1
 *
 * 功能：新增括号按键，支持用户自定义四则运算优先级；
 *       非法表达式给出友好提示，不抛 JS 异常。
 *       原有四则运算函数 evaluateSimple() 未做任何修改。
 * ========================================================================== */

/* ==========================================================================
 * 第一部分：原有四则运算逻辑（本次改动未触碰）
 * ========================================================================== */

/**
 * 四则运算求值：先乘除后加减，同级从左到右
 * @param {string} expr 由数字与 + - * / 组成的表达式
 * @returns {number}
 */
function evaluateSimple(expr) {
  const tokens = String(expr).replace(/\s+/g, '').match(/\d+\.?\d*|\.\d+|[+\-*/]/g);
  if (!tokens) throw new Error('表达式为空');

  const nums = [];   // 数字栈
  const ops = [];    // 运算符栈
  let expectNum = true; // 下一个 token 应为数字（允许一元正负号）

  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    // 一元正负号：出现在首位或运算符之后
    if (expectNum && (t === '-' || t === '+')) {
      const n = Number(tokens[++i]);
      nums.push(t === '-' ? -n : n);
      expectNum = false;
      continue;
    }
    if (t === '+' || t === '-' || t === '*' || t === '/') {
      ops.push(t);
      expectNum = true;
      continue;
    }
    nums.push(Number(t));
    expectNum = false;
  }

  // 第一遍：处理 * 和 /
  for (let i = 0; i < ops.length;) {
    if (ops[i] === '*' || ops[i] === '/') {
      const a = nums[i];
      const b = nums[i + 1];
      if (ops[i] === '/' && b === 0) throw new Error('除数不能为 0');
      nums.splice(i, 2, ops[i] === '*' ? a * b : a / b);
      ops.splice(i, 1);
    } else {
      i++;
    }
  }

  // 第二遍：处理 + 和 -
  let result = nums[0];
  for (let i = 0; i < ops.length; i++) {
    result = ops[i] === '+' ? result + nums[i + 1] : result - nums[i + 1];
  }
  return round10(result);
}

/** 消除浮点误差，例如 0.1 + 0.2 => 0.3 */
function round10(n) {
  return Math.round(n * 1e10) / 1e10;
}

/* ==========================================================================
 * 第二部分：新增 · 错误类型与语法校验
 * ========================================================================== */

/** 自定义错误类型：UI 层捕获后转为友好提示，避免脚本异常崩溃 */
class CalcError extends Error {
  constructor(message) {
    super(message);
    this.name = 'CalcError';
  }
}

/**
 * 表达式语法校验（括号匹配、运算符连续性、数字格式等）
 * @param {string} raw 原始表达式
 * @returns {string|null} 非法时返回中文提示，合法返回 null
 */
function validateExpression(raw) {
  const expr = String(raw).replace(/\s+/g, '');
  if (!expr) return '请输入表达式';
  if (/[^0-9+\-*/().]/.test(expr)) return '含非法字符，仅支持 0-9 + - × ÷ ( ) .';

  // 数字格式：小数点不能重复
  const numbers = expr.match(/[0-9.]+/g) || [];
  for (const n of numbers) {
    if (n.split('.').length > 2) return '数字格式错误：小数点重复';
  }

  // 逐个 token 走一遍状态机：expectNum 表示「下一个应为数字 / ( / 一元符号」
  const tokens = expr.match(/\d+\.?\d*|\.\d+|[+\-*/()]/g) || [];
  const isNum = (t) => !!t && /^(\d+\.?\d*|\.\d+)$/.test(t);

  let depth = 0;      // 未闭合的左括号数量
  let expectNum = true;
  let prev = null;    // 上一个 token

  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];

    if (t === '(') {
      if (!expectNum) return '缺少运算符：数字或 ) 后不能直接接 (';
      depth++;
      prev = t;
      continue;
    }

    if (t === ')') {
      if (expectNum) {
        return prev && /[+\-*/]/.test(prev) ? ') 前面不能是运算符' : '括号内不能为空';
      }
      depth--;
      if (depth < 0) return '括号不匹配：多了一个 )';
      expectNum = false;
      prev = t;
      continue;
    }

    if (/[+\-*/]/.test(t)) {
      // 一元正负号：只允许出现在开头，或 * / ( 之后，且必须紧跟数字
      const canUnary = prev === null || prev === '(' || prev === '*' || prev === '/';
      if (expectNum && (t === '+' || t === '-') && canUnary && isNum(tokens[i + 1])) {
        i++;                 // 该符号属于后面的数字，一并跳过
        expectNum = false;
        prev = tokens[i];
        continue;
      }
      if (expectNum) {
        if (t === '*' || t === '/') {
          return prev === '(' ? '( 后面不能是 * 或 /' : '运算符不能连续出现';
        }
        return '运算符不能连续出现';
      }
      expectNum = true;
      prev = t;
      continue;
    }

    // 数字
    if (!expectNum) return '缺少运算符：) 后不能直接接数字';
    expectNum = false;
    prev = t;
  }

  if (depth > 0) return `括号不匹配：还缺 ${depth} 个 )`;
  if (expectNum) return '表达式不能以运算符结尾';
  return null;
}

/* ==========================================================================
 * 第三部分：新增 · 括号求值层
 * ========================================================================== */

/**
 * 求值入口：先校验语法，再从最内层括号逐层求值回代，
 * 最终仍交给原有的 evaluateSimple() 处理纯四则运算，保证旧行为不变
 * @param {string} raw
 * @returns {number}
 */
function evaluate(raw) {
  const err = validateExpression(raw);
  if (err) throw new CalcError(err);

  let s = String(raw).replace(/\s+/g, '');
  let guard = 0;

  // 每次消解一层「不含括号的最内层括号」，把结果替换回字符串
  while (s.indexOf('(') !== -1) {
    if (++guard > 100) throw new CalcError('表达式嵌套过深');
    s = s.replace(/\(([^()]*)\)/g, (_, inner) => String(evaluateSimple(inner)));
  }
  return evaluateSimple(s);
}

/**
 * 对外统一入口（UI 只调这个函数，永不抛异常）
 * @param {string} expr
 * @returns {{ok: boolean, value?: number, message?: string}}
 */
function calc(expr) {
  try {
    return { ok: true, value: evaluate(expr) };
  } catch (e) {
    // 无论语法错误还是除零，都转成结构化结果，不向上抛异常
    return { ok: false, message: e.message || '表达式无法计算' };
  }
}

/* ==========================================================================
 * 第四部分：新增 · 界面交互（仅浏览器执行，Node 下自动跳过）
 * ========================================================================== */
if (typeof document !== 'undefined') {
  (function bindUI() {
    function init() {
      const exprEl = document.getElementById('expression');
      const resultEl = document.getElementById('result');
      const keysEl = document.getElementById('keys');
      const hintEl = document.getElementById('hint');
      if (!exprEl || !resultEl || !keysEl) return; // 页面没有这些节点就不接管

      let input = ''; // 内部一律用 ASCII：+ - * /

      /** 把内部表达式转成易读形式展示 */
      const pretty = (s) => s.replace(/\*/g, '×').replace(/\//g, '÷').replace(/-/g, '−');

      /** 显示友好提示 */
      function setHint(msg) {
        hintEl.textContent = msg;
        hintEl.classList.toggle('show', !!msg);
        if (msg) {
          const panel = document.querySelector('.calc');
          if (panel) {
            panel.classList.add('shake');
            setTimeout(() => panel.classList.remove('shake'), 400);
          }
        }
      }

      /** 渲染：表达式栏 + 结果栏 + 提示 */
      function render(hint) {
        exprEl.textContent = input ? pretty(input) : '0';
        const r = calc(input);
        resultEl.textContent = !input ? '0' : (r.ok ? String(r.value) : '');
        setHint(hint || '');
      }

      /** 处理一次按键 */
      function press(key) {
        if (key === 'clear') {
          input = '';
        } else if (key === 'back') {
          input = input.slice(0, -1);
        } else if (key === '=') {
          const r = calc(input);
          if (r.ok) {
            input = String(r.value);
          } else {
            setHint(r.message);
            return;
          }
        } else {
          input += key;
        }
        render();
      }

      // 鼠标 / 触摸点击
      keysEl.addEventListener('click', (e) => {
        const btn = e.target.closest('button[data-key]');
        if (btn) press(btn.dataset.key);
      });

      // 物理键盘：数字、小数点、四则运算符，以及直接输入的 ( )
      document.addEventListener('keydown', (e) => {
        const k = e.key;
        if (/^[0-9.+\-*/()]$/.test(k)) {
          press(k);
        } else if (k === 'Enter' || k === '=') {
          press('=');
        } else if (k === 'Backspace') {
          press('back');
        } else if (k === 'Escape' || k === 'c' || k === 'C') {
          press('clear');
        } else {
          return;
        }
        e.preventDefault();
      });

      render();
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init);
    } else {
      init();
    }
  })();
}

/* ==========================================================================
 * 第五部分：新增 · 模块导出 + 自测
 * ========================================================================== */

// 浏览器 / 其他环境：挂到全局，方便控制台调试
if (typeof window !== 'undefined') {
  window.Calculator = { calc, evaluate, evaluateSimple, validateExpression, round10 };
}

// Node 环境：导出给外部引用；若直接运行本文件则跑自测
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { calc, evaluate, evaluateSimple, validateExpression, round10 };

  if (typeof require !== 'undefined' && require.main === module) {
    (function runTests() {
      const cases = [
        // ---- 回归：不含括号的原有行为 ----
        { expr: '1+2*3', value: 7 },
        { expr: '10-4-3', value: 3 },
        { expr: '100/4/5', value: 5 },
        { expr: '0.1+0.2', value: 0.3 },
        { expr: '-3+5', value: 2 },

        // ---- 新增：括号改变优先级 ----
        { expr: '(1+2)*3', value: 9 },
        { expr: '2*(3+4)', value: 14 },
        { expr: '((2+3)*4)/5', value: 4 },
        { expr: '10-(4-7)', value: 13 },
        { expr: '(2+3)*(4-1)', value: 15 },
        { expr: '2*(-3+5)', value: 4 },

        // ---- 新增：非法表达式必须给出提示，不得崩溃 ----
        { expr: '(1+2', message: '括号不匹配：还缺 1 个 )' },
        { expr: '1+2)', message: '括号不匹配：多了一个 )' },
        { expr: '((1+2)', message: '括号不匹配：还缺 1 个 )' },
        { expr: '()', message: '括号内不能为空' },
        { expr: '3++4', message: '运算符不能连续出现' },
        { expr: '3+', message: '表达式不能以运算符结尾' },
        { expr: '(3+)*2', message: ') 前面不能是运算符' },
        { expr: '3(4+5)', message: '缺少运算符：数字或 ) 后不能直接接 (' },
        { expr: '(3+4)5', message: '缺少运算符：) 后不能直接接数字' },
        { expr: '1..2', message: '数字格式错误：小数点重复' },
        { expr: '1/0', message: '除数不能为 0' },
        { expr: '1+a', message: '含非法字符，仅支持 0-9 + - × ÷ ( ) .' },
      ];

      let pass = 0;
      cases.forEach((c) => {
        const r = calc(c.expr);
        let ok;
        if ('value' in c) ok = r.ok && Math.abs(r.value - c.value) < 1e-9;
        else ok = !r.ok && r.message === c.message;

        if (ok) pass++;
        else console.log(`FAIL  ${c.expr}  期望=${JSON.stringify(c.value ?? c.message)}  实际=${JSON.stringify(r.ok ? r.value : r.message)}`);
      });

      console.log(`${pass}/${cases.length} 通过`);
      process.exit(pass === cases.length ? 0 : 1);
    })();
  }
}
