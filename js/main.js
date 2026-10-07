const displayMain = document.getElementById('display-main');
const displaySub = document.getElementById('display-sub');
const keyboard = document.getElementById('keyboard');

// 获取历史记录列表容器
const historyList = document.getElementById('history-list');

// 获取历史记录面板（只用来挂「清空」按钮，DOM 结构不改）
const historyPanel = document.getElementById('history-panel');

/**
 * 加法：把两个数相加。
 * @param {number} a 加数
 * @param {number} b 被加数
 * @returns {number} 两数之和
 */
function add(a, b) {
  // TODO: 整个计算器现在只会这一件事，而且还没实现——等着你的 PR
  return a + b;
}

 feature/math-mod-sqrt-task2-v2
 /**
  * 取模：求 a 除以 b 的余数
  * @param {number} a
  * @param {number} b
  * @returns {number} 余数
  */
 function mod(a, b) {
   const numA = Number(a);
   const numB = Number(b);
   if (isNaN(numA) || isNaN(numB)) return NaN;
   return numA % numB;
 }

/**
 * 平方根：求 a 的算术平方根
 * @param {number} a
 * @returns {number} 平方根
 */
function sqrt(a) {
  const num = Number(a);
  if (isNaN(num) || num < 0) return NaN;
  return Math.sqrt(num);
}

/**
 * 平方和：两个操作数各自的平方之和。
 * @param {number} a 左操作数
 * @param {number} b 右操作数
 * @returns {number} a² + b²
 */
function squareSum(a, b) {
  return a * a + b * b;
}

/**
 * 平方差：左操作数的平方减去右操作数的平方。
 * @param {number} a 左操作数
 * @param {number} b 右操作数
 * @returns {number} a² − b²
 */
function squareDiff(a, b) {
  return a * a - b * b;
}
 develop
/**
 * 常用对数 log10
 * @param {number} x 输入数字
 * @returns {number|string} 以10为底的对数，x≤0返回非法输入
 */
function log10(x) {
  if(x <= 0){
    return "非法输入";
  }
  const res = Math.log10(x);
  return Number(res.toPrecision(10));
}

/**
 * 10的x次方
 * @param {number} x 指数
 * @returns {number} 10^x计算结果
 */
function pow10(x) {
  const res = Math.pow(10, x);
  return Number(res.toPrecision(10));
}


// ---------------------------------------------------------------
// 计算状态
// ---------------------------------------------------------------
const INITIAL = '0';
const ERROR_TEXT = '错误';

let text = INITIAL;
let acc = null;
let pendingOp = null;
let waiting = false;
let memory = 0;

// 连算（连按 = 重复上次运算）：记住上一次求值的运算符与右操作数
let lastOp = null;
let lastRight = null;
let canRepeat = false;

// ---------------------------------------------------------------
// 主显示区字号自适应：位数多到装不下就逐像素缩小，缩到下限为止（#124）
// ---------------------------------------------------------------
// 基准字号直接读样式表，避免和 css/style.css 的 32px 各写一份
const DISPLAY_FONT_BASE = parseFloat(getComputedStyle(displayMain).fontSize) || 32;
const DISPLAY_FONT_MIN = 14; // 最小字号：再长也不小于它，超出部分交给横向滚动

/** 先回到基准字号；装不下就逐像素缩小，直到不再溢出或触到最小字号。 */
function fitDisplayFont() {
  displayMain.style.fontSize = '';
  if (displayMain.scrollWidth <= displayMain.clientWidth) {
    return; // 装得下，保持样式表里的基准字号
  }
  for (let size = DISPLAY_FONT_BASE - 1; size >= DISPLAY_FONT_MIN; size -= 1) {
    displayMain.style.fontSize = `${size}px`;
    if (displayMain.scrollWidth <= displayMain.clientWidth) {
      return;
    }
  }
}

function show() {
  displayMain.textContent = text;
  fitDisplayFont();
}

function showSub(line) {
  displaySub.textContent = line || '';
}

function isError() {
  return text === ERROR_TEXT;
}

function clearState() {
  acc = null;
  pendingOp = null;
  waiting = false;
}

// ---------------------------------------------------------------
// 运算符
// ---------------------------------------------------------------
const OPERATORS = {
  '+': add,
  '−': (a, b) => a - b,
  '×': (a, b) => a * b,
  '÷': (a, b) => a / b,
 'xʸ': (a, b) => Math.pow(a, b), // 新增：任意次幂 xʸ
  'mod': (a, b) => a % b, // 新增：取余 mod
 'ʸ√x': (a, b) => (a < 0 && b % 2 === 1) ? -Math.pow(-a, 1 / b) : Math.pow(a, 1 / b), // ← 新增：n 次方根，b 是根指数
  'a²+b²': squareSum, // #151 新增：平方和键
  'a²−b²': squareDiff, // #151 新增：平方差键
};  


function formatResult(n) {
  if (!Number.isFinite(n)) {
    return ERROR_TEXT;
  }
  if (Number.isInteger(n)) {
    return String(n);
  }
  return String(Number(n.toPrecision(12)));
}

function applyPending() {
  const right = Number(text);
  const result = OPERATORS[pendingOp](acc, right);
  const shown = formatResult(result);

  if (shown === ERROR_TEXT) {
    text = ERROR_TEXT;
    clearState();
    showSub('');
    show();
    return false;
  }

  acc = result;
  return true;
}

// ---------------------------------------------------------------
// 按键行为
// ---------------------------------------------------------------
function inputDigit(digit) {
  // 00 双零键：等价于连按两次 0。复用本函数的语义，
  // 天然不会产生 "00" 这种前导零，也不会破坏小数。
  if (digit === '00') {
    inputDigit('0');
    inputDigit('0');
    return;
  }
  if (isError()) {
    text = INITIAL;
  }
  canRepeat = false; // 开始新一轮数字输入，连算资格作废
  if (waiting) {
    text = digit;
    waiting = false;
  } else {
    text = text === INITIAL ? digit : text + digit;
  }
  show();
}

function inputDecimal() {
  if (isError()) {
    text = INITIAL;
  }
  canRepeat = false; // 开始新一轮数字输入，连算资格作废
  if (waiting) {
    text = `${INITIAL}.`;
    waiting = false;
  } else if (!text.includes('.')) {
    text = text === INITIAL ? `${INITIAL}.` : `${text}.`;
  }
  show();
}

function inputOperator(op) {
  if (isError()) {
    return;
  }
  canRepeat = false; // 选定新的运算符，旧的连算作废

  if (pendingOp !== null) {
    if (waiting) {
      pendingOp = op;
      showSub(`${formatResult(acc)} ${op}`);
      return;
    }
    if (!applyPending()) {
      return;
    }
    text = formatResult(acc);
    show();
  } else {
    acc = Number(text);
  }

  pendingOp = op;
  waiting = true;
  showSub(`${formatResult(acc)} ${op}`);
}

function inputEquals() {
  if (isError()) {
    return;
  }

  if (pendingOp === null) {
    // 连算：没有新的待算运算时，若上次求值可重复，
    // 就复用那次的运算符和右操作数，对当前结果再算一次
    if (!canRepeat) {
      return;
    }
    acc = Number(text);
    pendingOp = lastOp;
    text = formatResult(lastRight);
  }

  const line = `${formatResult(acc)} ${pendingOp} ${text} =`;

  if (!applyPending()) {
    canRepeat = false; // 求值失败（如除零）进入错误态，连算资格作废
    return;
  }

  // 记住本次的运算符和右操作数，供下一次按 = 连算
  lastOp = pendingOp;
  lastRight = Number(text);
  canRepeat = true;

  text = formatResult(acc);

  // line 在 applyPending 之前就算好了，左侧操作数不会被结果覆盖（原来这里把 acc 用成了结果）
  recordHistory(line, text);

  clearState();
  parenStack.length = 0; // 未闭合的括号随本次求值一并作废
  waiting = true;
  showSub(line);
  show();
}

function inputBackspace() {
  if (isError()) {
    return;
  }
  // π 整体删除：当前显示的就是 π 的值时，一次退格全删
  if (text === PI_TEXT) {
    text = INITIAL;
    waiting = false;
    show();
    return;
  }
  if (waiting) {
    return;
  }

  text = text.slice(0, -1) || INITIAL;
  show();
}

function inputClearEntry() {
  text = INITIAL;
  waiting = false;
  canRepeat = false; // CE 开始新的输入，连算资格作废

  if (pendingOp === null) {
    acc = null;
    showSub('');
  } else {
    showSub(`${formatResult(acc)} ${pendingOp}`);
  }

  show();
}

function inputSqrt() {
  if (isError()) {
    return;
  }
  canRepeat = false; // 一元运算改变了当前数，连算资格作废

  const value = Number(text);
  if (value < 0) {
    text = ERROR_TEXT;
    clearState();
    showSub('');
    show();
    return;
  }

  text = formatResult(Math.sqrt(value));
  show();
}

/** 四舍五入键：把当前显示的数取整。 */
function inputRound() {
  if (isError()) {
    return;
  }
  canRepeat = false; // 一元运算改变了当前数，连算资格作废

  const value = Number(text);
  const result = Math.sign(value) * Math.round(Math.abs(value));
  text = formatResult(result);

  if (text === ERROR_TEXT) {
    clearState();
    showSub('');
  }

  show();
}

/** 百分号键：加减时按左操作数的百分之几计算，乘除时直接转成小数。 */
function inputPercent() {
  if (isError()) {
    return;
  }
  canRepeat = false; // 一元运算改变了当前数，连算资格作废

  const value = Number(text);
  const isPercentOfLeft = pendingOp === '+' || pendingOp === '−';
  let result;

  if (acc !== null && isPercentOfLeft) {
    result = acc * value / 100;
  } else {
    result = value / 100;
  }

  text = formatResult(result);

  if (text === ERROR_TEXT) {
    clearState();
    showSub('');
  }

  show();
}

/** 平方键：对当前显示的数求平方。 */
function inputSquare() {
  if (isError()) {
    return;
  }
  canRepeat = false; // 一元运算改变了当前数，连算资格作废

  const value = Number(text);
  const result = formatResult(value * value);

  if (result === ERROR_TEXT) {
    text = ERROR_TEXT;
    clearState();
    showSub('');
    show();
    return;
  }

  text = result;
  show();
}

/** 倒数键：对当前显示的数求倒数。 */
function inputReciprocal() {
  if (isError()) {
    return;
  }
  canRepeat = false; // 一元运算改变了当前数，连算资格作废

  const value = Number(text);
  text = formatResult(1 / value);

  if (text === ERROR_TEXT) {
    clearState();
    showSub('');
  }

  show();
}

/** 绝对值键：对当前显示的数求绝对值。 */
function inputAbs() {
  if (isError()) {
    return;
  }
  canRepeat = false; // 一元运算改变了当前数，连算资格作废
  const value = Number(text);
  text = formatResult(Math.abs(value));

  if (text === ERROR_TEXT) {
    clearState();
    showSub('');
  }

  show();
}

/** π 键：输入圆周率的近似值（用浮点近似，不做高精度符号显示）。 */
const PI_TEXT = formatResult(Math.PI);

function inputPi() {
  if (isError()) {
    text = INITIAL;
  }
  text = PI_TEXT;
  waiting = true;
  show();
}

// ---------------------------------------------------------------
// 三角函数与角度模式（DEG/RAD）
// ---------------------------------------------------------------
let useDegrees = true; // 默认角度制 DEG

/** DEG/RAD 切换键：翻转角度模式；无 pending 运算时在副屏提示当前模式。 */
function toggleAngleMode() {
  useDegrees = !useDegrees;
  if (pendingOp === null) {
    showSub(useDegrees ? '角度制 DEG' : '弧度制 RAD');
  }
}

/**
 * 三角函数键：对当前显示值求 sin/cos/tan，行为与 √ 等一元运算键一致。
 * @param {string} name 函数名：'sin' | 'cos' | 'tan'
 */
function inputTrig(name) {
  if (isError()) {
    return;
  }
  canRepeat = false; // 一元运算改变了当前数，连算资格作废

  const value = Number(text);
  if (!Number.isFinite(value)) {
    return;
  }

  // DEG 模式先把角度换算成弧度；RAD 模式直接用输入值
  const angle = useDegrees ? (value * Math.PI) / 180 : value;

  // tan 在 90°（π/2）等无定义处：余弦接近 0，按「错误」处理，不显示 Infinity。
  // 阈值取 1e-10：显示值只有 12 位有效数字，离 π/2 这么近的输入就视为 π/2
  if (name === 'tan' && Math.abs(Math.cos(angle)) < 1e-10) {
    text = ERROR_TEXT;
    clearState();
    showSub('');
    show();
    return;
  }

  let result = Math[name](angle);

  // 浮点残差清理：结果绝对值过小时归零（如 sin 180° ≈ 1.2e-16 应显示 0）
  if (Math.abs(result) < 1e-12) {
    result = 0;
  }

  text = formatResult(result);

  if (text === ERROR_TEXT) {
    clearState();
    showSub('');
  }

  show();
}

// ---------------------------------------------------------------
// 反三角函数 asin / acos / atan（与已有 DEG/RAD 模式联动）
// ---------------------------------------------------------------
// 反三角键与正向三角键同属「一元三角运算」这一类动作，所以 LAYOUT 里复用已有的
// 'trig' 类型，由键面文字区分正/反，不新增类型
const ARC_TRIG_NAMES = {
  'sin⁻¹': 'asin',
  'cos⁻¹': 'acos',
  'tan⁻¹': 'atan',
};

/**
 * 反三角函数键：对当前显示值求反正弦/反余弦/反正切，行为与 sin/cos/tan 一致。
 * @param {string} label 键面文字：'sin⁻¹' | 'cos⁻¹' | 'tan⁻¹'
 */
function inputArcTrig(label) {
  if (isError()) {
    return;
  }
  canRepeat = false; // 一元运算改变了当前数，连算资格作废

  const name = ARC_TRIG_NAMES[label];
  const value = Number(text);
  if (!name || !Number.isFinite(value)) {
    return;
  }

  // asin / acos 的定义域是 [-1, 1]：输入的是比值，与角度模式无关，超出即非法输入
  if (name !== 'atan' && (value < -1 || value > 1)) {
    text = ERROR_TEXT;
    clearState();
    showSub('');
    show();
    return;
  }

  // 反三角算出来的是弧度；DEG 模式下再换算成角度显示
  let result = Math[name](value);
  if (useDegrees) {
    result = (result * 180) / Math.PI;
  }

  // 浮点残差清理：结果绝对值过小时归零，避免 -0 或 1.2e-16 这类残差
  if (Math.abs(result) < 1e-12) {
    result = 0;
  }

  text = formatResult(result);

  if (text === ERROR_TEXT) {
    clearState();
    showSub('');
  }

  show();
}

// ---------------------------------------------------------------
// 括号：用栈暂存外层上下文，按下 ) 时把括号内的算式求值
// ---------------------------------------------------------------

// 每层存 { acc, pendingOp }，即按下 ( 那一刻的外层运算上下文
const parenStack = [];

/** 左括号键：开一个子表达式，把外层上下文压栈，当前算式从零开始。 */
function inputLParen() {
  if (isError()) {
    return;
  }
  // 只有在「正等着一个操作数」的位置才允许开括号：刚按下运算符、刚求值完（waiting），
  // 或空白起点（C 之后）。其余位置一律忽略——刚打完一个数字再按 (（如 1 + 2 后的那个 (）
  // 或刚闭合一个括号，都还没有运算符衔接，开了就会出现 5( 这种缺运算符的式子
  const expectingOperand = waiting || (pendingOp === null && text === INITIAL);
  if (!expectingOperand) {
    return;
  }

  parenStack.push({ acc, pendingOp });
  acc = null;
  pendingOp = null;
  text = INITIAL;
  waiting = false;
  canRepeat = false; // 换到子表达式，连算资格作废
  show();
}

/** 右括号键：先把括号内的算式算完，再把结果并回外层上下文。 */
function inputRParen() {
  if (isError() || parenStack.length === 0) {
    return; // 没有未闭合的 ( ，忽略点击
  }

  // 括号内还有没算完的运算（如 2 + 3），先算掉
  if (pendingOp !== null && !waiting) {
    if (!applyPending()) {
      parenStack.length = 0; // 求值出错（如除零），整串括号一并作废
      return;
    }
    text = formatResult(acc);
  }

  const value = text;
  const outer = parenStack.pop();

  // 括号结果并回外层：外层有运算符就等按 = 时合并，没有它就是整个式子
  acc = outer.acc;
  pendingOp = outer.pendingOp;
  text = value;
  // 外层没有运算符 → 这个括号就是整个式子，结果等同于按完 = ，下一个数字另起一轮；
  // 外层还有运算符 → 括号结果是一个待合并的操作数，与刚打完一个数同构
  waiting = outer.pendingOp === null;
  canRepeat = false;
  show();
}

/** ± 键：切换当前显示数字的正负；0（含 0.0）保持不变。 */
function inputPlusMinus() {
  if (isError()) {
    return;
  }
  canRepeat = false; // 一元运算改变了当前数，连算资格作废

  const value = Number(text);
  if (value === 0) {
    return; // 验收标准 2：0.0 点击 ± 依旧为 0.0
  }

  if (text.startsWith('-')) {
    text = text.slice(1); // 负数变回正数
  } else {
    text = `-${text}`; // 正数变为负数
  }
  show();
}

/** C 键：全部清零。 */
function inputClear() {
  text = INITIAL;
  clearState();
  parenStack.length = 0; // 未闭合的括号一并清零
  lastOp = null; // 连算记忆一并清除
  lastRight = null;
  canRepeat = false;
  showSub('');
  show();
}

function inputCopy() {
  if (!navigator.clipboard || typeof navigator.clipboard.writeText !== 'function') {
    showSub('复制失败');
    return;
  }

  navigator.clipboard.writeText(text)
    .then(() => showSub('已复制'))
    .catch(() => showSub('复制失败'));
}
/** 内存加：把当前显示的数加到内存里。 */
function inputMemoryAdd() {
  if (isError()) {
    return;
  }
  const value = Number(text);
  if (!Number.isFinite(value)) {
    return;
  }
  memory = memory + value;
  waiting = true;
   updateMemoryIndicator();
}

/** 内存减：把当前显示的数从内存里减掉。 */
function inputMemorySubtract() {
  if (isError()) {
    return;
  }
  const value = Number(text);
  if (!Number.isFinite(value)) {
    return;
  }
  memory = memory - value;
  waiting = true;
   updateMemoryIndicator();
}

/** 内存读：把内存里的数取出来显示到主屏。 */
function inputMemoryRecall() {
  if (isError()) {
    return;
  }
  text = formatResult(memory);
  waiting = true;
  show();
}

/** 内存清：把内存归零。 */
function inputMemoryClear() {
  memory = 0;
  updateMemoryIndicator();
}

// ---------------------------------------------------------------
// 键盘渲染
// ---------------------------------------------------------------
const LAYOUT = [
  ['7', 'digit'], ['8', 'digit'], ['9', 'digit'], ['C', 'clear'],
  ['4', 'digit'], ['5', 'digit'], ['6', 'digit'], ['÷', 'operator'],
  ['1', 'digit'], ['2', 'digit'], ['3', 'digit'], ['×', 'operator'],
  ['0', 'digit'], ['−', 'operator'], ['+', 'operator'], ['=', 'equals'],
  ['.', 'decimal'], ['00', 'digit'], ['⌫', 'backspace'], ['CE', 'clearEntry'], ['√', 'sqrt'], ['四舍五入', 'sqrt'],
  ['x²', 'square'],
  ['1/x', 'reciprocal'],
  ['π', 'pi'],
  ['(', 'lparen'], [')', 'rparen'], // #43 新增：末行整行放左右括号
  ['复制', 'copy'],
  ['MC', 'mc'], ['MR', 'mr'], ['M+', 'mplus'], ['M−', 'mminus'],
  ['%', 'percent'], // #33 新增：百分号键
  ['sin', 'trig'], ['cos', 'trig'], ['tan', 'trig'], // 三角函数键
  ['sin⁻¹', 'trig'], ['cos⁻¹', 'trig'], ['tan⁻¹', 'trig'], // 反三角函数键（复用 trig 类型）
  ['sinh', 'trig'], ['cosh', 'trig'], ['tanh', 'trig'], // #143 新增：双曲函数键
  ['DEG', 'angleMode'], // 角度/弧度切换键：键面文字随当前模式变化
  ['xʸ', 'operator'], // 新增：任意次幂键
  ['mod', 'operator'], // 新增：取余键
  ['±', 'plusMinus'], // #102 新增：正负切换键
  ['ʸ√x', 'operator'], // ← 新增：n 次方根键
  ['a²+b²', 'operator'], // #151 新增：平方和键（标签沿用本仓 x² / xʸ / ʸ√x 的记号风格，4 列网格里中文标签会换行）
  ['a²−b²', 'operator'], // #151 新增：平方差键
];

const KEY_CLASS = {
  digit: 'key--normal',
  operator: 'key--action',
  clear: 'key--danger',
  equals: 'key--success',
  decimal: 'key--normal',
  backspace: 'key--backspace',
  clearEntry: 'key--danger',
  sqrt: 'key--action',
  square: 'key--action',
  percent: 'key--action',
  plusMinus: 'key--action',
  reciprocal: 'key--action',
  pi: 'key--action',
  lparen: 'key--action', // #43 新增
  rparen: 'key--action',
  copy: 'key--action',
  mc: 'key--action',
  mr: 'key--action',
  mplus: 'key--action',
  mminus: 'key--action',
  trig: 'key--action', // 三角函数键
  angleMode: 'key--action', // 角度/弧度切换键
};

LAYOUT.forEach(([label, kind]) => {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = `key ${KEY_CLASS[kind]}`;
  if (label === '四舍五入') {
    button.classList.add('key--round');
  }
  button.textContent = label;
  button.addEventListener('click', () => {
    if (kind === 'trig' && HYPERBOLIC_FNS.has(label)) { // #143 新增：双曲函数键转交独立处理
      inputHyperbolic(label);
      return;
    }

    if (kind === 'digit') {
      inputDigit(label);
    } else if (kind === 'operator') {
      inputOperator(label);
    } else if (kind === 'decimal') {
      inputDecimal();
    } else if (kind === 'clear') {
      inputClear();
    } else if (kind === 'backspace') {
      inputBackspace();
    } else if (kind === 'clearEntry') {
      inputClearEntry();
    } else if (kind === 'sqrt') {
      if (label === '四舍五入') {
        inputRound();
      } else {
        inputSqrt();
      }
    } else if (kind === 'square') {
      inputSquare();
    } else if (kind === 'reciprocal') {
      inputReciprocal();
    } else if (kind === 'percent') {
      inputPercent();
    } else if (kind === 'pi') {
      inputPi();
    } else if (kind === 'plusMinus') {
      inputPlusMinus();
    } else if (kind === 'copy') {
      inputCopy();
    } else if (kind === 'mc') {
      inputMemoryClear();
    } else if (kind === 'mr') {
      inputMemoryRecall();
    } else if (kind === 'mplus') {
      inputMemoryAdd();
    } else if (kind === 'mminus') {
      inputMemorySubtract();
    } else if (kind === 'trig') {
      if (ARC_TRIG_NAMES[label]) {
        inputArcTrig(label); // 反三角键：sin⁻¹ / cos⁻¹ / tan⁻¹
      } else {
        inputTrig(label);
      }
    } else if (kind === 'angleMode') {
      toggleAngleMode();
      button.textContent = useDegrees ? 'DEG' : 'RAD';
    } else if (kind === 'lparen') {
      inputLParen();
    } else if (kind === 'rparen') {
      inputRParen();
    } else {
      inputEquals();
    }
  });
  keyboard.appendChild(button);
});

// =========================================
// 新增：物理键盘输入监听
// =========================================
document.addEventListener('keydown', (e) => {
  if (e.key >= '0' && e.key <= '9') {
    inputDigit(e.key);
  } else if (e.key === '.') {
    inputDecimal();
  } else if (e.key === '+') {
    inputOperator('+');
  } else if (e.key === '-') {
    inputOperator('−');
  } else if (e.key === '*') {
    inputOperator('×');
  } else if (e.key === '/') {
    inputOperator('÷');
  } else if (e.key === 'Enter' || e.key === '=') {
    inputEquals();
  } else if (e.key === 'Backspace') {
    inputBackspace();
  } else if (e.key === 'Escape' || e.key.toLowerCase() === 'c') {
    inputClear();
  } else {
    return;
  }
  e.preventDefault();
});

// =========================================
// 新增：历史记录增强（持久化 / 点击回填 / 清空）
// 复用已合并的 #history-list 面板，不新增面板、不改显示区
// =========================================
const HISTORY_KEY = 'calculator-history'; // localStorage 里的存储键
const HISTORY_MAX = 20; // 最多保留条数，超出丢弃最旧的

// 每条 { line: '12 + 7 =', result: '19' }，新的排最前
let history = [];

/** 只认结构完整的记录：脏数据（null / 缺字段）直接丢掉，免得渲染出 undefined。 */
function isHistoryItem(item) {
  return Boolean(item) && typeof item.line === 'string' && typeof item.result === 'string';
}
/** 取某条的重复次数；count 缺失或被写坏时兜底为 1，避免渲染出 NaN。 */
function historyCount(item) {
  return item.count > 0 ? item.count : 1;
}

/** 启动时读取历史；读不出来（无痕模式 / 数据损坏）就当没有。 */
function loadHistory() {
  try {
    const arr = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
    history = Array.isArray(arr) ? arr.filter(isHistoryItem) : [];
  } catch (e) {
    history = [];
  }
}

/** 写回 localStorage；写不进去（无痕模式）就静默跳过，不影响计算。 */
function saveHistory() {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  } catch (e) {
    // 静默降级：本次不持久化而已
  }
}

/** 求值成功后记一条并刷新面板；与上一条算式相同则折叠为计数 +1，不新增条目。 */
function recordHistory(line, result) {
  const latest = history[0];
  // 只跟「最近一条」比：连续重复才折叠。中间隔了别的算式就照常各记一条。
  if (latest && latest.line === line && latest.result === result) {
    latest.count = historyCount(latest) + 1;
  } else {
    history.unshift({ line, result, count: 1 });
  }
  if (history.length > HISTORY_MAX) {
    history.length = HISTORY_MAX;
  }
  saveHistory();
  renderHistory();
}

/** 点某条记录：把该次结果回填到主屏，作为新算式的起点。 */
function refillFromHistory(item) {
  text = item.result;
  clearState();
  canRepeat = false; // 回填的是另一条历史的结果，与之前那次连算无关
  waiting = true; // 与求值后一致：接着按数字另起一轮，按运算符则用这个结果继续算
  showSub('');
  show();
}

/** 「清空」按钮：清掉全部记录，含已持久化的。 */
function clearHistory() {
  history = [];
  saveHistory();
  renderHistory();
}

/** 把 history 刷到面板上。 */
function renderHistory() {
  if (!historyList) {
    return; // 页面没有历史面板时整个功能自动失效，不影响计算
  }

  historyList.innerHTML = '';

  if (history.length === 0) {
    const empty = document.createElement('li');
    empty.className = 'history-empty';
    empty.textContent = '暂无记录';
    historyList.appendChild(empty);
    return;
  }

  history.forEach((item) => {
    const li = document.createElement('li');
    li.className = 'history-item';

    // 算式和结果先作为条目文本（和原来一样），重复次数再挂成徽标
    li.textContent = `${item.line} ${item.result}`;

    const times = historyCount(item);
    if (times > 1) {
      const badge = document.createElement('span');
      badge.className = 'history-item__count';
      badge.textContent = `×${times}`;
      badge.title = `连续重复 ${times} 次`;
      li.appendChild(badge);
    }

    li.title = '点击把结果填回主屏';
    li.addEventListener('click', () => refillFromHistory(item));
    historyList.appendChild(li);
  });

  historyList.scrollTop = 0; // 最新的在最上面，回到顶部
}

// 「清空」按钮挂在标题右侧：标题与按钮包一层，index.html 不动
if (historyPanel && historyList) {
  const title = historyPanel.querySelector('h3');
  const head = document.createElement('div');
  head.className = 'history-panel__head';
  historyPanel.insertBefore(head, historyPanel.firstChild);
  if (title) {
    head.appendChild(title);
  }

  const clearButton = document.createElement('button');
  clearButton.type = 'button';
  clearButton.className = 'history-clear';
  clearButton.textContent = '清空';
  clearButton.addEventListener('click', clearHistory);
  head.appendChild(clearButton);
}

// 初始化
loadHistory();
renderHistory();
show();

// =========================================
// 新增：十进制 → 二进制 / 八进制 / 十六进制（关联提案 #145）
// 只做十进制向 BIN/OCT/HEX 的单向转换，不反向转回十进制。
// 输入为十进制整数；小数、负数、非数字一律按非法输入处理（副屏提示 + 主屏「错误」），
// 全程不出现 NaN、页面不崩溃。
// 本段为纯叠加新增，未改动上方任何既有代码、显示区 DOM 结构与既有函数签名。
// =========================================

/**
 * 把十进制整数的显示文本转成指定进制的字符串。
 * @param {string} input 当前主屏文本（十进制）
 * @param {number} radix 目标进制：2 / 8 / 16
 * @returns {{ ok: true, value: string } | { ok: false, reason: string }}
 *   成功返回 ok:true，value 为转换结果（十六进制 A-F 统一大写）；
 *   失败返回 ok:false，reason 为非法输入的中文原因。
 */
function convertFromDecimal(input, radix) {
  const raw = String(input).trim();

  // 空输入 / 纯符号：不是合法的十进制整数
  if (raw === '' || raw === '-' || raw === '+') {
    return { ok: false, reason: '非法输入' };
  }

  // 负数是非法输入：本题只支持非负十进制整数
  if (raw.startsWith('-')) {
    return { ok: false, reason: '不支持负数' };
  }

  // 小数是非法输入：转换只针对十进制整数
  if (raw.includes('.')) {
    return { ok: false, reason: '不支持小数' };
  }

  // 严格的十进制整数字面量校验：仅数字组成，避免 Number() 把 '1e3'、'0x10'、'Infinity' 当成合法数
  if (!/^\d+$/.test(raw)) {
    return { ok: false, reason: '非法输入' };
  }

  const value = Number(raw);
  if (!Number.isSafeInteger(value)) {
    return { ok: false, reason: '数值过大' };
  }

  let converted;
  if (radix === 16) {
    converted = value.toString(16).toUpperCase(); // 十六进制 A-F 大写
  } else {
    converted = value.toString(radix);
  }

  // 防御式兜底：任何意外都不允许把 NaN/undefined 显示出去
  if (typeof converted !== 'string' || converted === '' || converted.includes('NaN')) {
    return { ok: false, reason: '非法输入' };
  }

  return { ok: true, value: converted };
}

/**
 * 转换键的统一入口：读取当前主屏值，按目标进制转换并把结果写回主屏。
 * 兼容既有状态机：转换结果写回 text 并置 waiting，后续可直接参与四则运算。
 * @param {number} radix 目标进制：2 / 8 / 16
 * @param {string} label 副屏提示用的进制名：'BIN' | 'OCT' | 'HEX'
 */
function inputBaseConvert(radix, label) {
  const from = isError() ? '' : text;
  const result = convertFromDecimal(from, radix);

  if (!result.ok) {
    // 非法输入：主屏进「错误」态，副屏写明原因，页面不崩、不出现 NaN
    text = ERROR_TEXT;
    clearState();
    canRepeat = false;
    showSub(`十进制 → ${label}：${result.reason}`);
    show();
    return;
  }

  canRepeat = false; // 一元转换改变了当前数，连算资格作废
  text = result.value;
  showSub(`${from} (十进制) = ${result.value} (${label})`);
  show();
}

/** 十进制 → 二进制键。 */
function inputBinary() {
  inputBaseConvert(2, 'BIN');
}

/** 十进制 → 八进制键。 */
function inputOctal() {
  inputBaseConvert(8, 'OCT');
}

/** 十进制 → 十六进制键。 */
function inputHex() {
  inputBaseConvert(16, 'HEX');
}

// #145 新增：在键盘网格末尾追加 BIN / OCT / HEX 三个转换键。
// 不改动 LAYOUT / KEY_CLASS / 既有按键分发逻辑（develop 的 static-check
// 白名单未收录新 kind，且本 PR 约束只改 js/main.js），按 README 增补条例
// 「显示区之外要加按钮也可以」（CT1），沿用现有 .key .key--action 样式直接追加。
const BASE_CONVERT_KEYS = [
  ['BIN', inputBinary],
  ['OCT', inputOctal],
  ['HEX', inputHex],
];

BASE_CONVERT_KEYS.forEach(([label, handler]) => {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'key key--action';
  button.textContent = label;
  button.addEventListener('click', handler);
  keyboard.appendChild(button);
});

// =========================================
// 新增：内存状态指示器（内存有值时显示 M 标记）
// 内存有非零值时在面板左上角显示「M」，为空时隐藏；悬停查看内存值。
// 只新增代码：不动显示区 DOM、不改已有函数签名、不引依赖。
// =========================================
const memoryIndicator = document.createElement('span');
memoryIndicator.className = 'memory-indicator';
memoryIndicator.textContent = 'M';

const memoryIndicatorStyle = document.createElement('style');
memoryIndicatorStyle.textContent = [
  'main.calculator { position: relative; }',
  '.memory-indicator {',
  '  display: none;',
  '  position: absolute;',
  '  top: 1px;',
  '  left: 14px;',
  '  width: 18px;',
  '  height: 18px;',
  '  line-height: 18px;',
  '  border-radius: 5px;',
  '  background: var(--key-action);',
  '  color: #fff;',
  '  font-size: 12px;',
  '  font-weight: bold;',
  '  text-align: center;',
  '  cursor: default;',
  '}',
].join('\n');
document.head.appendChild(memoryIndicatorStyle);

function updateMemoryIndicator() {
  const hasValue = memory !== 0;
  memoryIndicator.style.display = hasValue ? 'block' : 'none';
  memoryIndicator.title = hasValue ? `内存：${formatResult(memory)}` : '内存为空';
}

const memoryIndicatorHost = document.querySelector('main.calculator');
if (memoryIndicatorHost) {
  memoryIndicatorHost.appendChild(memoryIndicator);
}

updateMemoryIndicator();

// ---------------------------------------------------------------
// #143 新增：双曲函数 sinh / cosh / tanh（纯新增代码，不改动任何既有逻辑）
// ---------------------------------------------------------------
/** 双曲函数键名集合：这三个键复用 trig 按键类型，在按键分发处先行拦截。 */
const HYPERBOLIC_FNS = new Set(['sinh', 'cosh', 'tanh']);

/**
 * 双曲函数键：对当前显示值求 sinh / cosh / tanh。
 * 主屏显示结果，副屏显示表达式（如「sinh(1) =」）。
 * 双曲函数的自变量是实数而非角度，因此与 DEG/RAD 模式无关。
 * @param {string} name 函数名：'sinh' | 'cosh' | 'tanh'
 */
function inputHyperbolic(name) {
  if (isError()) {
    return;
  }
  canRepeat = false; // 一元运算改变了当前数，连算资格作废

  const value = Number(text);
  if (!Number.isFinite(value)) {
    return;
  }

  const result = Math[name](value); // 直接用实数，不做角度换算

  // 结果超出可表示范围（如 sinh(1000) = Infinity）或非数时，
  // 统一按「错误」处理，不把 Infinity / NaN 显示到屏幕上
  if (!Number.isFinite(result)) {
    text = ERROR_TEXT;
    clearState();
    showSub('');
    show();
    return;
  }

  showSub(`${name}(${formatResult(value)}) =`);
  text = formatResult(result); // 复用统一的 12 位有效数字收敛，避免浮点长尾
  waiting = true; // 求值后按数字键，从新数字开始输入
  show();
}

// 立方按钮：计算当前数字的三次方
function inputCube() {
  if (isError()) {
    return;
  }
  canRepeat = false;

  const value = Number(text);
  text = formatResult(value * value * value);

  if (isError()) {
    clearState();
    parenStack.length = 0;
    showSub('');
  }
  show();
}

const cubeButton = document.createElement('button');
cubeButton.type = 'button';
cubeButton.className = 'key key--action';
cubeButton.textContent = 'x³';
cubeButton.addEventListener('click', inputCube);
keyboard.appendChild(cubeButton);

const absButton = document.createElement('button');
absButton.type = 'button';
absButton.className = 'key key--action';
absButton.textContent = '|x|';
absButton.addEventListener('click', inputAbs);
keyboard.appendChild(absButton);
// =================================================================
// 新增：随机数键 Rand（纯追加，不改动上方任何既有代码）
//
// 按下后生成一个落在 [0, 1) 区间的随机数写进主显示区，
// 之后它可以像普通数字一样继续参与四则运算。
// 不动显示区 DOM、不改既有函数签名、不引第三方依赖。
// =================================================================

// 先放大成整数再缩小回去，这么做有两个好处：
// 1) 结果最多 12 位小数，不会出现浮点长尾（比如 0.30000000000000004）；
// 2) 上界被锁死在 0.999999999999，杜绝了「舍入后显示成 1」的极端情况。
const RAND_SCALE = 1e12;

/** 取一个 [0, 1) 区间内的随机数，最多 12 位小数。 */
function randomUnit() {
  return Math.floor(Math.random() * RAND_SCALE) / RAND_SCALE;
}

/** Rand 键：把随机数写入主显示区，行为与 π 键保持一致。 */
function inputRandom() {
  if (isError()) {
    text = INITIAL; // 从错误态恢复时先回到初始显示，避免把「错误」这个值传下去
  }

  canRepeat = false; // 随机数是一次一元运算的结果，旧的连算资格作废
  text = formatResult(randomUnit());
  waiting = true; // 与 π 键一致：随机数是一个完整结果，下一个数字另起一轮
  show();
}

// 在键盘末尾追加 Rand 键：沿用现有 .key .key--action 样式，
// 不动 LAYOUT / KEY_CLASS / OPERATORS，也不碰既有按键的分发逻辑。
const randomButton = document.createElement('button');
randomButton.type = 'button';
randomButton.className = 'key key--action';
randomButton.textContent = 'Rand';
randomButton.addEventListener('click', inputRandom);
keyboard.appendChild(randomButton);
/**
 * 奇/偶 判断按键
 * 读取主屏当前数字，判断奇数/偶数
 */
function inputOddEven(){
  if (isError()) {
    return;
  }
  canRepeat = false;

  const num = Number(text);
  // 判断是否为整数
  if (!Number.isInteger(num)) {
    text = "仅支持整数";
    waiting = true; // 下一次数字输入覆盖主屏，避免「仅支持整数5」
    showSub('');
    show();
    return;
  }

  if (num % 2 === 0) {
    text = '偶数';
  } else {
    text = '奇数';
  }
  waiting = true; // 下一次数字输入覆盖主屏，避免「奇数5」
  showSub('');
  show();
}

// 渲染【奇 / 偶】按钮，追加到键盘
const oddEvenBtn = document.createElement('button');
oddEvenBtn.type = 'button';
oddEvenBtn.className = 'key key--action';
oddEvenBtn.textContent = '奇 / 偶';
oddEvenBtn.addEventListener('click', inputOddEven);
keyboard.appendChild(oddEvenBtn);

/**
 * 阶乘 n! 按钮点击处理（#194）
 * 对主屏上当前的非负整数计算阶乘；小数、负数置错误
 * 依赖：formatResult / show / isError / canRepeat
 * @input 主屏text显示的当前数值
 */
function inputFactorial() {
  // 如果计算器当前已经处于错误状态，直接返回不处理
  if (isError()) {
    return;
  }
  // 执行一元运算之后禁止继续连等重复运算
  canRepeat = false;
  const value = Number(text);

  // 阶乘只允许非负整数；负数或者小数返回错误
  if (!Number.isInteger(value) || value < 0) {
    text = formatResult(NaN);
    show();
    return;
  }

  // 循环求阶乘，0! = 1
  let res = 1;
  for (let i = 2; i <= value; i++) {
    res *= i;
  }

  // 回写主屏并且刷新显示
  text = formatResult(res);
  show();
}

// 渲染【n!】阶乘按钮，追加到屏幕键盘
const factorialBtn = document.createElement('button');
factorialBtn.type = 'button';
factorialBtn.className = 'key key--action';
factorialBtn.textContent = 'n!';
factorialBtn.addEventListener('click', inputFactorial);
keyboard.appendChild(factorialBtn);

// =========================================
// 新增：度 / 分 / 秒（° ′ ″）三个按键 —— 纯叠加，既有逻辑零改动
// -----------------------------------------------------------------
// 用法：数字 + ° 记度、+ ′ 记分、+ ″ 记秒并结束录入；漏录的分量按 0，
//       空值直接点键也不报错。点 ″ 时若已有待运算符（+ − × ÷ …），就复用
//       既有 inputEquals() 求值，结果按「度/分/秒各两位小数」显示；没有
//       待运算符，该值直接作为当前操作数继续参与既有四则运算。
// 兼容：主屏显示度分秒串期间，捕获阶段先把它还原成等值十进制再放行，
//       冒泡阶段再决定要不要把写法还回去——既有函数永远只见到纯数字。
// 依赖：formatResult / INITIAL / ERROR_TEXT / show / showSub / inputEquals
//       / keyboard / text / acc / pendingOp / waiting / canRepeat
// =========================================

/** 度分秒串的形状：如 -40.00°51.00′0.00″（三个分量各两位小数） */
const DMS_TEXT = /^(-)?(\d+(?:\.\d+)?)°(\d+(?:\.\d+)?)′(\d+(?:\.\d+)?)″$/;

/**
 * 十进制度 → 度分秒串；秒四舍五入到两位后若满 60，进位依次向分、度传递。
 * @param {number} value 十进制度数
 * @returns {string} 如 30.00°20.00′10.00″；非有限数返回「错误」
 */
function formatDms(value) {
  if (!Number.isFinite(value)) {
    return ERROR_TEXT;
  }
  const abs = Math.abs(value);
  let deg = Math.floor(abs);
  const rest = (abs - deg) * 60;
  let min = Math.floor(rest);
  let sec = Math.round((rest - min) * 6000) / 100;
  if (sec >= 60) {
    sec -= 60;
    min += 1;
  }
  if (min >= 60) {
    min -= 60;
    deg += 1;
  }
  return `${value < 0 ? '-' : ''}${deg.toFixed(2)}°${min.toFixed(2)}′${sec.toFixed(2)}″`;
}

/**
 * 度分秒串 → 十进制度。
 * @param {string} str 形如 30.00°20.00′10.00″ 的文本
 * @returns {number|null} 十进制度；不是度分秒串返回 null
 */
function parseDms(str) {
  const m = DMS_TEXT.exec(String(str));
  if (!m) {
    return null;
  }
  return (m[1] === '-' ? -1 : 1) * (Number(m[2]) + Number(m[3]) / 60 + Number(m[4]) / 3600);
}

/** 主屏此刻显示的是不是度分秒串 */
function isDmsDisplay() {
  return DMS_TEXT.test(text);
}

// ---------------------------------------------------------------
// 录入状态
// ---------------------------------------------------------------
let dmsParts = { deg: 0, min: 0, sec: 0 }; // 已录入的分量
let dmsBuilding = false;   // 是否正在录入一个度分秒操作数
let dmsNext = 'min';       // 主屏上还没标记的那个数是分还是秒
let dmsSawPreview = false; // 本次按键消费掉的是「尚未输入」的预览串

let dmsInvolved = false;   // 当前算式出现过度分秒 → 结果与算式行用度分秒写法
let dmsRestoreText = null; // 按键前主屏原本显示的度分秒串
let dmsPre = null;         // 按键前的 { acc, op, operand }，用于改写 = 的算式行

/** 副屏里左操作数的写法：算式中出现过度分秒就用度分秒串，否则用十进制 */
function dmsSide(value) {
  if (!dmsInvolved || !Number.isFinite(value)) {
    return formatResult(value);
  }
  const shown = formatDms(value);
  return shown === ERROR_TEXT ? formatResult(value) : shown;
}

/** 算式行里「右操作数」的写法：度分秒串先归一化（进位、各分量两位小数）；
 *  普通小数保持十进制，不会因为算式里出现过度分秒就被强行换算
 *  （如 10°30′0″ − 0.5 里的 0.5 就该还是 0.5） */
function dmsOperandText(value) {
  if (typeof value === 'string' && DMS_TEXT.test(value)) {
    return formatDms(parseDms(value)); // 与副屏其余部分同一套写法
  }
  const n = Number(value);
  return Number.isFinite(n) ? formatResult(n) : String(value);
}

/** 录入中途副屏的写法：按已录分量归一化后，去掉还没录的尾部分量。
 *  因为先过了一遍 formatDms，90′ 这种越界分量会正常进位（0°90′ → 1°30′），
 *  不会和主屏显示的预览打架。
 *  @param {number} value 当前已录分量折算的十进制度
 *  @param {'deg'|'min'|'sec'} level 这一轮录到哪个分量 */
function dmsStageText(value, level) {
  const full = formatDms(value);
  const m = DMS_TEXT.exec(full);
  if (!m) {
    return full;
  }
  const sign = m[1] || '';
  if (level === 'deg') {
    return `${sign}${m[2]}°`;
  }
  if (level === 'min') {
    return `${sign}${m[2]}°${m[3]}′`;
  }
  return full;
}

/** 录入期间副屏的前缀：有待运算符时保留「a + 」上下文 */
function dmsPrefix() {
  return pendingOp === null ? '' : `${dmsSide(acc)} ${pendingOp} `;
}

/** 把主屏预览成已录分量（未录的分量按 0）；下一个数字会整体替换它 */
function dmsPreview(decimal) {
  text = formatDms(decimal);
  waiting = true;
  show();
}

/** 本次要记的分量：预览串还没被新数字覆盖就按 0 记 */
function dmsTake() {
  const value = dmsSawPreview ? 0 : Number(text);
  return Number.isFinite(value) ? value : 0;
}

/** 放弃未完成的录入：已录分量（含主屏上还没标记的数）折算成十进制写回主屏 */
function dmsAbandon() {
  const extra = Number.isFinite(Number(text)) ? Number(text) : 0;
  const decimal = dmsNext === 'sec'
    ? dmsParts.deg + dmsParts.min / 60 + extra / 3600
    : dmsParts.deg + extra / 60;
  dmsBuilding = false;
  text = formatResult(decimal);
  show();
}

/** 三个键的公共前置：错误态忽略；主屏是度分秒串就先还原成十进制 */
function dmsPrepare() {
  if (isError()) {
    return false;
  }
  // 只有在「新开一份录入」时才重记本轮算式的原始写法。度分秒串刚录到一半时
  // 主屏还是预览串，此刻不该覆盖已有的右操作数写法，否则 15°40′50″ 会被记成
  // 半截的 50，副屏算式行就拼不出度分秒样式了。
  if (!dmsBuilding) {
    dmsPre = { acc, op: pendingOp, operand: text };
  }
  canRepeat = false;      // 开始度分秒录入，连算资格作废
  dmsInvolved = true;     // 本次算式出现了度分秒操作数
  dmsSawPreview = false;
  if (isDmsDisplay()) {
    text = formatResult(parseDms(text));
    waiting = false;
    dmsSawPreview = dmsBuilding; // 录入中被还原的是预览 → 这一分量还没输入
    show();
  }
  return true;
}

/** 度键：把当前数字记为「度」，重开一份录入 */
function inputDmsDegree() {
  if (!dmsPrepare()) {
    return;
  }
  dmsBuilding = true;
  dmsNext = 'min';
  dmsParts = { deg: dmsTake(), min: 0, sec: 0 };
  showSub(`${dmsPrefix()}${dmsStageText(dmsParts.deg, 'deg')}`);
  dmsPreview(dmsParts.deg);
}

/** 分键：把当前数字记为「分」；还没记过度就先把度按 0 算 */
function inputDmsMinute() {
  if (!dmsPrepare()) {
    return;
  }
  if (!dmsBuilding) {
    dmsBuilding = true;
    dmsParts = { deg: 0, min: 0, sec: 0 };
  }
  dmsParts.min = dmsTake();
  dmsNext = 'sec';
  const partial = dmsParts.deg + dmsParts.min / 60;
  showSub(`${dmsPrefix()}${dmsStageText(partial, 'min')}`);
  dmsPreview(partial);
}

/** 秒键：把当前数字记为「秒」并结束本次录入 */
function inputDmsSecond() {
  if (!dmsPrepare()) {
    return;
  }
  if (!dmsBuilding) {
    dmsBuilding = true;
    dmsParts = { deg: 0, min: 0, sec: 0 };
  }
  dmsParts.sec = dmsTake();

  // 归一化后再上副屏：90″ 这类越界分量在此进位成 1′30″，与主屏、算式行口径一致
  const decimal = dmsParts.deg + dmsParts.min / 60 + dmsParts.sec / 3600;
  const entered = formatDms(decimal);
  dmsBuilding = false;

  if (pendingOp === null) {
    // 没有待运算：整值作为当前操作数，等运算符继续算
    showSub(entered);
    dmsPreview(decimal);
    return;
  }

  // 有待运算：走既有 = 的流程（算式行、历史记录、错误态全部沿用）
  const line = `${dmsSide(acc)} ${pendingOp} ${entered} =`; // 两侧都用归一化写法
  text = formatResult(decimal); // 右操作数先写回主屏，供 inputEquals 消费
  inputEquals();
  if (isError()) {
    return; // 如除以 0°0′0″：保持既有「错误」态
  }
  canRepeat = false; // 已由 ″ 收尾，再按一次 = 不该重复累加第二个操作数
  showSub(line);
  dmsPreview(Number(text));
}

// ---------------------------------------------------------------
// 与既有按键的兼容层：捕获阶段还原，冒泡阶段收尾
// ---------------------------------------------------------------
const DMS_EDIT_LABELS = ['.', '±', '⌫', '00']; // 编辑类键面（单个数字另行判断）
const DMS_PHYS_KEYS = ['+', '-', '*', '/', 'Enter', '=', 'Escape', 'c', 'C'];
const dmsButtons = [];

/** 按键处理前：先快照状态，主屏是度分秒串就还原（录入中也把已录分量折算进来） */
function dmsBefore(isEditKey) {
  if (isEditKey && dmsBuilding) {
    return; // 录入过程中的数字 / 小数点 / ± / 退格：直接作用于当前分量
  }
  // 只有「新的一轮按键」才重开快照；度分秒按键自身（dmsPrepare 里）已经记好了
  // 本轮的原始左值/右值写法，这里不能覆盖，否则会把 15°40′50″ 记成 15.68…
  if (!dmsBuilding) {
    dmsPre = { acc, op: pendingOp, operand: text };
  }
  if (dmsBuilding) {
    dmsAbandon();
    if (dmsPre) {
      dmsPre.operand = text; // 录入中断：用折算后的十进制，避免算式行里出现半截度分秒串
    }
  } else if (isDmsDisplay()) {
    dmsRestoreText = text;
    text = formatResult(parseDms(text));
    show();
  }
}

/** 按键既定处理跑完之后：值没动就把写法还回去，= 求值的结果转成度分秒 */
function dmsAfter(label) {
  if (label === 'C' || label === 'CE') {
    dmsInvolved = false; // 本次算式到此为止
  }
  const snapshot = dmsRestoreText;
  dmsRestoreText = null;
  if (isError() || isDmsDisplay()) {
    return; // 错误态或已经是度分秒串，无需收尾
  }

  // 值没被这次按键改动（如多按一次 = ，或按 + 只是把当前值挂成左操作数）：
  // 把度分秒写法原样还回去，避免界面在「串 ↔ 小数」之间来回跳
  const before = snapshot === null ? null : parseDms(snapshot);
  if (before !== null && text === formatResult(before)) {
    text = snapshot;
    if (pendingOp !== null) {
      showSub(`${snapshot} ${pendingOp}`);
    }
    show();
    return;
  }

  // = 求值：算式里出现过度分秒，结果也按度分秒显示（各分量两位小数），
  // 并把算式行改写成同一套写法；收尾后结束连算，再按 = 不会重复累加
  if (label === '=' && dmsInvolved && Number.isFinite(Number(text))) {
    text = formatDms(Number(text));
    if (dmsPre && dmsPre.op !== null) {
      showSub(`${dmsSide(dmsPre.acc)} ${dmsPre.op} ${dmsOperandText(dmsPre.operand)} =`);
    }
    canRepeat = false;
    show();
  }
}

// -----------------------------------------------------------------
// 历史记录保持既有行为：仍记十进制算式行。
// 改它需要从外部包装 recordHistory，属于改动既有函数的调用结果，
// 为避免触碰「不动既有函数」的边界，这里不做——主屏与副屏的口径已经统一。
// -----------------------------------------------------------------

keyboard.addEventListener('click', (event) => {
  const btn = event.target && event.target.closest ? event.target.closest('button') : null;
  if (!btn || dmsButtons.indexOf(btn) !== -1) {
    return; // 不在按钮上，或是度/分/秒键本身（由各自 handler 处理）
  }
  const label = btn.textContent;
  dmsBefore(/^\d$/.test(label) || DMS_EDIT_LABELS.indexOf(label) !== -1);
}, true);

keyboard.addEventListener('click', (event) => {
  const btn = event.target && event.target.closest ? event.target.closest('button') : null;
  if (!btn || dmsButtons.indexOf(btn) !== -1) {
    return;
  }
  dmsAfter(btn.textContent);
});

document.addEventListener('keydown', (event) => {
  const key = event.key;
  if (DMS_PHYS_KEYS.indexOf(key) === -1) {
    return; // 既有监听根本不处理的键，不多管闲事
  }
  dmsBefore(key === '.' || key === 'Backspace' || (key >= '0' && key <= '9'));
}, true);

document.addEventListener('keydown', (event) => {
  const key = event.key;
  if (DMS_PHYS_KEYS.indexOf(key) === -1) {
    return;
  }
  const physical = key === 'Enter' || key === '=' ? '=' : key === 'Escape' || key.toLowerCase() === 'c' ? 'C' : key;
  dmsAfter(physical);
});

// 三个键沿用既有 .key .key--action 样式追加（同 BIN/OCT/HEX 的做法，
// 不动 LAYOUT / KEY_CLASS——static-check 白名单未收录新 kind）
[['°', inputDmsDegree, '度'], ['′', inputDmsMinute, '分'], ['″', inputDmsSecond, '秒']].forEach(
  ([label, handler, name]) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'key key--action';
    button.textContent = label;
    button.title = `${name}（度分秒）`; // 悬停提示，不影响键面可访问名称
    button.addEventListener('click', handler);
    dmsButtons.push(button);
    keyboard.appendChild(button);
  },
);

// =========================================
// 新增：按键音效（纯追加，不改动上方任何既有逻辑）
// 用事件委托捕获键盘区的所有点击 + 物理键盘按下，不动 LAYOUT、不动既有按键
// 分发逻辑、不改任何已有函数。声音用浏览器原生的 AudioContext 实时合成，
// 不引依赖、不加载音频文件、不加构建工具。
// 默认关闭：只有用户主动点开「音效」键之后才发声，打开页面不会突然响。
// =========================================

// 不同类别的按键给不同音高，听感上能区分数字 / 运算 / 清除
const SOUND_TONES = {
  'key--normal': 660, // 数字、小数点
  'key--action': 520, // 运算符与一元运算
  'key--success': 780, // 等号
  'key--danger': 300, // 清除
  'key--backspace': 420, // 退格
};
const SOUND_DEFAULT_TONE = 600; // 物理键盘等无法归类时的默认音高

// 只有这些物理按键发声，避免按 F1、Tab 之类的无关键也响
const SOUND_KEYS = new Set([
  '0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '.',
  '+', '-', '*', '/', 'Enter', '=', 'Backspace', 'Escape', 'c', 'C',
]);

let audioContext = null;
let soundEnabled = false;

/**
 * 惰性创建 AudioContext：浏览器要求页面必须先有用户手势才允许出声，
 * 所以只有在真正要发声时才创建（此时必然已经发生过点击）。
 * @returns {AudioContext|null} 浏览器不支持时返回 null，静默降级
 */
function getAudioContext() {
  if (audioContext === null) {
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) {
      return null;
    }
    audioContext = new Ctor();
  }
  // 某些浏览器创建后处于 suspended，出声前恢复一次
  if (audioContext.state === 'suspended') {
    audioContext.resume();
  }
  return audioContext;
}

/**
 * 发一声短促的提示音：正弦波 + 快速淡入淡出，避免起停时的爆音。
 * @param {number} tone 频率（Hz）
 */
function playKeyTone(tone) {
  const ctx = getAudioContext();
  if (!ctx) {
    return; // 浏览器不支持音频：静默降级，不影响计算
  }

  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(tone, now);

  // 音量包络：10ms 淡入、120ms 淡出，听感是干净的一声「嘀」
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.12, now + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);

  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.14);
}

/** 按按钮的类别挑一个音高；关着的时候什么都不做。 */
function playSoundForButton(button) {
  if (!soundEnabled) {
    return;
  }
  const matched = Object.keys(SOUND_TONES).find((cls) => button.classList.contains(cls));
  playKeyTone(matched ? SOUND_TONES[matched] : SOUND_DEFAULT_TONE);
}

// 开关键的开启态只有一条高亮规则，随本段代码一起注入，不动 css/style.css
const soundButtonStyle = document.createElement('style');
soundButtonStyle.textContent = [
  '.key--sound-on {',
  '  background: #2f9e44;',
  '  color: #fff;',
  '}',
].join('\n');
document.head.appendChild(soundButtonStyle);

// 音效开关按钮：默认关闭，点一下开启，副屏写明当前状态（与「复制」键的做法一致）
const soundButton = document.createElement('button');
soundButton.type = 'button';
soundButton.className = 'key key--action';
soundButton.textContent = '音效 关';

soundButton.addEventListener('click', () => {
  soundEnabled = !soundEnabled;
  soundButton.classList.toggle('key--sound-on', soundEnabled);
  soundButton.textContent = soundEnabled ? '音效 开' : '音效 关';
  showSub(soundEnabled ? '按键音效已开启' : '按键音效已关闭');

  // 开启时立刻响一声，让用户确认真的生效了
  if (soundEnabled) {
    playKeyTone(SOUND_DEFAULT_TONE);
  }
});

keyboard.appendChild(soundButton);

// 事件委托：监听整个键盘区的 click 冒泡，所有按键（含以后新增的）自动发声。
// 这样完全不用改 LAYOUT 与上面已有的 click 处理逻辑。
keyboard.addEventListener('click', (e) => {
  const button = e.target.closest('button');
  if (!button || button === soundButton) {
    return; // 开关自己不发声（它的反馈在上面单独处理）
  }
  playSoundForButton(button);
});

// 物理键盘：与上方已有的 keydown 监听并存；长按产生的重复事件只响一次
document.addEventListener('keydown', (e) => {
  if (!soundEnabled || e.repeat || !SOUND_KEYS.has(e.key)) {
    return;
  }
  playKeyTone(SOUND_DEFAULT_TONE);
});

// =========================================
// 新增：排列组合键 nPr / nCr
// 排列数 A(n,k) = n!/(n−k)!，组合数 C(n,k) = n!/(k!(n−k)!)。
// 做成与 + − × ÷ 同构的二元运算符：输入 n → 按 nPr / nCr → 输入 k → 按 =。
// 复用既有 OPERATORS + applyPending 状态机，因此副屏表达式、C / CE、括号、
// 连按 = 这些既有行为都自动生效，不另起一套状态。
// 大阶乘一律用连乘 / 乘一项除一项的算法，不直接算 n!，避免 21! 以上溢出。
// 本段为纯叠加新增：未改动上方任何既有代码、显示区 DOM 结构与既有函数签名。
// =========================================

/** 排列组合的合法输入：n、k 均为非负整数，且 k ≤ n。 */
function isValidArity(n, k) {
  return Number.isInteger(n) && Number.isInteger(k) && n >= 0 && k >= 0 && k <= n;
}

/**
 * 排列数 A(n,k) = n × (n−1) × … × (n−k+1)。
 * 只做 k 次连乘，不做 n!/(n−k)!，因此中间值不会因大阶乘溢出。
 * @param {number} n 元素总数
 * @param {number} k 取出个数
 * @returns {number} 排列数
 */
function permutationCount(n, k) {
  let result = 1;
  for (let i = 0; i < k; i += 1) {
    result *= n - i;
  }
  return result;
}

/**
 * 组合数 C(n,k)，按「先乘一项、再除一项」逐步收敛：
 * 第 i 步 = 前一步 × (n−k+i) ÷ i，每一步的中间值都是整数，
 * 既不会溢出，也不会像先算 n! 那样丢精度。
 * @param {number} n 元素总数
 * @param {number} k 取出个数
 * @returns {number} 组合数
 */
function combinationCount(n, k) {
  let result = 1;
  for (let i = 1; i <= k; i += 1) {
    result = (result * (n - k + i)) / i;
  }
  return result;
}

/**
 * 结果收敛：只放行安全整数范围内的整数值，
 * 溢出或超过 2^53 精度上限时返回 NaN，交给既有 formatResult 显示「错误」，
 * 宁可不给结果，也不显示一串已经不准的数字。
 */
function toSafeCount(value) {
  return Number.isSafeInteger(value) ? value : NaN;
}

// 注册进既有运算符表：与 xʸ / mod / ʸ√x 同类，都是加一行即可
OPERATORS['nPr'] = (n, k) => (isValidArity(n, k) ? toSafeCount(permutationCount(n, k)) : NaN);
OPERATORS['nCr'] = (n, k) => (isValidArity(n, k) ? toSafeCount(combinationCount(n, k)) : NaN);

// 按键：沿用现有 .key .key--action 样式直接追加到键盘网格末尾（CT1：显示区之外可加按钮），
// 不往 LAYOUT / KEY_CLASS 里加新 kind，避免动到既有按键分发逻辑
const PERMUTATION_KEYS = [
  ['nPr', 'nPr', '排列数 A(n,k) = n!/(n−k)!'],
  ['nCr', 'nCr', '组合数 C(n,k) = n!/(k!(n−k)!)'],
];

PERMUTATION_KEYS.forEach(([label, op, hint]) => {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'key key--action';
  button.textContent = label;
  button.title = hint;
  button.addEventListener('click', () => inputOperator(op));
  keyboard.appendChild(button);
});
