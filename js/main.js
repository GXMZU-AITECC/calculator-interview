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
  ['.', 'decimal'], ['00', 'digit'], ['⌫', 'backspace'], ['CE', 'clearEntry'], ['√', 'sqrt'],
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
      inputSqrt();
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

/** 求值成功后记一条并刷新面板。 */
function recordHistory(line, result) {
  history.unshift({ line, result });
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
    li.textContent = `${item.line} ${item.result}`;
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
