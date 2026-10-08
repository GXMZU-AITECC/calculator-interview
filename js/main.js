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
/**
  * 取模：求 a 除以 b 的余数
  * @param {number} a 被除数
  * @param {number} b 除数
  * @returns {number} 余数
  */
 function mod(a, b) {
   return a % b;
 }
 /**
  * 平方根：求 x 的算术平方根
  * @param {number} x 输入数字
  * @returns {number|string} 平方根；x<0 返回非法输入
  */
 function sqrt(x) {
   if (x < 0) {
     return "非法输入";
   }
   return Math.sqrt(x);
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
// 按键按功能区排列：三角、表达式、单目运算、内存、编辑、数字键盘、工具行
const LAYOUT = [
  ['sin', 'trig'], ['cos', 'trig'], ['tan', 'trig'], ['DEG', 'angleMode'],
  ['sin⁻¹', 'trig'], ['cos⁻¹', 'trig'], ['tan⁻¹', 'trig'], ['%', 'percent'],
  ['sinh', 'trig'], ['cosh', 'trig'], ['tanh', 'trig'], ['±', 'plusMinus'],
  ['(', 'lparen'], [')', 'rparen'], ['xʸ', 'operator'], ['ʸ√x', 'operator'],
  ['√', 'sqrt'], ['x²', 'square'], ['1/x', 'reciprocal'], ['π', 'pi'],
  ['MC', 'mc'], ['MR', 'mr'], ['M+', 'mplus'], ['M−', 'mminus'],
  ['⌫', 'backspace'], ['CE', 'clearEntry'], ['C', 'clear'], ['复制', 'copy'],
  ['7', 'digit'], ['8', 'digit'], ['9', 'digit'], ['÷', 'operator'],
  ['4', 'digit'], ['5', 'digit'], ['6', 'digit'], ['×', 'operator'],
  ['1', 'digit'], ['2', 'digit'], ['3', 'digit'], ['−', 'operator'],
  ['00', 'digit'], ['0', 'digit'], ['.', 'decimal'],
  ['+', 'operator'], ['四舍五入', 'sqrt'], ['a²+b²', 'operator'], ['a²−b²', 'operator'], ['mod', 'operator'],
  ['=', 'equals'],
];

// 按键样式类，按语义分组
const KEY_CLASS = {
  digit: 'key--digit',
  decimal: 'key--digit',
  operator: 'key--operator',
  equals: 'key--equals',
  clear: 'key--clear',
  clearEntry: 'key--clear',
  backspace: 'key--edit',
  copy: 'key--edit',
  sqrt: 'key--sci',
  square: 'key--sci',
  reciprocal: 'key--sci',
  percent: 'key--sci',
  plusMinus: 'key--sci',
  pi: 'key--sci',
  lparen: 'key--sci',
  rparen: 'key--sci',
  trig: 'key--sci',
  angleMode: 'key--sci',
  mc: 'key--mem',
  mr: 'key--mem',
  mplus: 'key--mem',
  mminus: 'key--mem',
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

/** 按面板顺序复制全部历史；只更新提示，不改变计算状态或历史记录。 */
async function inputCopyHistory() {
  if (history.length === 0) {
    showSub('暂无历史记录可复制');
    return;
  }

  try {
    if (!navigator.clipboard || typeof navigator.clipboard.writeText !== 'function') {
      showSub('历史记录复制失败');
      return;
    }

    const content = history.map((item) => {
      const times = historyCount(item);
      const repeated = times > 1 ? `（重复 ${times} 次）` : '';
      return `${item.line} ${item.result}${repeated}`;
    }).join('\n');
    await navigator.clipboard.writeText(content);
    showSub('历史记录已复制');
  } catch (e) {
    showSub('历史记录复制失败');
  }
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

  const copyButton = document.createElement('button');
  copyButton.type = 'button';
  copyButton.className = 'history-clear';
  copyButton.textContent = '复制全部';
  copyButton.addEventListener('click', inputCopyHistory);
  head.appendChild(copyButton);

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
// 「显示区之外要加按钮也可以」（CT1）；插在等号前收尾。
const BASE_CONVERT_KEYS = [
  ['BIN', inputBinary],
  ['OCT', inputOctal],
  ['HEX', inputHex],
];

BASE_CONVERT_KEYS.forEach(([label, handler]) => {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'key key--sci';
  button.textContent = label;
  button.addEventListener('click', handler);
  keyboard.insertBefore(button, keyboard.lastElementChild);
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
  '  left: 16px;',
  '  width: 16px;',
  '  height: 16px;',
  '  line-height: 16px;',
  '  border-radius: 5px;',
  '  background: var(--key-op-bg);',
  '  color: var(--key-op-text);',
  '  font-size: 11px;',
  '  font-weight: 600;',
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
cubeButton.className = 'key key--sci';
cubeButton.textContent = 'x³';
cubeButton.addEventListener('click', inputCube);
keyboard.insertBefore(cubeButton, keyboard.lastElementChild);

// =================================================================
// 新增：立方根键 ∛（纯追加，不改动上方任何既有代码）
//
// 对当前主屏数字开三次方。与平方根不同，负数开立方在实数范围内
// 有定义（如 ∛-8 = -2），因此不做负数报错分支，Math.cbrt 直接处理。
// 不动显示区 DOM、不改既有函数签名、不引第三方依赖。
// =================================================================

/** 立方根键：对当前显示的数开三次方，负数同样有效。 */
function inputCbrt() {
  if (isError()) {
    return;
  }
  canRepeat = false; // 一元运算改变了当前数，连算资格作废

  const value = Number(text);
  text = formatResult(Math.cbrt(value));
  show();
}

const cbrtButton = document.createElement('button');
cbrtButton.type = 'button';
cbrtButton.className = 'key key--sci';
cbrtButton.textContent = '∛';
cbrtButton.addEventListener('click', inputCbrt);
keyboard.insertBefore(cbrtButton, keyboard.lastElementChild);


const absButton = document.createElement('button');
absButton.type = 'button';
absButton.className = 'key key--sci';
absButton.textContent = '|x|';
absButton.addEventListener('click', inputAbs);
keyboard.insertBefore(absButton, keyboard.lastElementChild);
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

// 追加 Rand 键：不动 LAYOUT / KEY_CLASS / OPERATORS，也不碰既有按键的分发逻辑。
const randomButton = document.createElement('button');
randomButton.type = 'button';
randomButton.className = 'key key--sci';
randomButton.textContent = 'Rand';
randomButton.addEventListener('click', inputRandom);
keyboard.insertBefore(randomButton, keyboard.lastElementChild);
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
oddEvenBtn.className = 'key key--sci';
oddEvenBtn.textContent = '奇 / 偶';
oddEvenBtn.addEventListener('click', inputOddEven);
keyboard.insertBefore(oddEvenBtn, keyboard.lastElementChild);

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
factorialBtn.className = 'key key--sci';
factorialBtn.textContent = 'n!';
factorialBtn.addEventListener('click', inputFactorial);
keyboard.insertBefore(factorialBtn, keyboard.lastElementChild);

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

// 三个度分秒键追加在等号之前（同 BIN/OCT/HEX 的做法，
// 不动 LAYOUT / KEY_CLASS——static-check 白名单未收录新 kind）
[['°', inputDmsDegree, '度'], ['′', inputDmsMinute, '分'], ['″', inputDmsSecond, '秒']].forEach(
  ([label, handler, name]) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'key key--sci key--dms';
    button.textContent = label;
    button.title = `${name}（度分秒）`; // 悬停提示，不影响键面可访问名称
    button.addEventListener('click', handler);
    dmsButtons.push(button);
    keyboard.insertBefore(button, keyboard.lastElementChild);
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
  'key--digit': 660, // 数字、小数点
  'key--operator': 520, // 运算符
  'key--sci': 520, // 科学功能与一元运算
  'key--mem': 520, // 内存
  'key--edit': 420, // 退格、复制
  'key--equals': 780, // 等号
  'key--clear': 300, // 清除
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
  '  background: var(--key-op-bg);',
  '  color: var(--key-op-text);',
  '}',
].join('\n');
document.head.appendChild(soundButtonStyle);

// 音效开关按钮：默认关闭，点一下开启，副屏写明当前状态（与「复制」键的做法一致）
const soundButton = document.createElement('button');
soundButton.type = 'button';
soundButton.className = 'key key--sci';
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

keyboard.insertBefore(soundButton, keyboard.lastElementChild);

// =========================================================
// 新增：二阶 / 三阶行列式（det2 / det3）
//
// 用法：点 det2 → 依次输入 4 个数（逗号分隔）→ 点 ] → 点 = 得到结果
//      点 det3 → 依次输入 9 个数（逗号分隔）→ 点 ] → 点 = 得到结果
// 负数：在 [ 或 , 之后按 − ；也可先输数字再按 ± 翻转当前数字段
// 小数：直接点 .
// 采用「按 = 计算」方案，不做右括号自动计算，规避正则提前匹配的坑。
//
// 实现方式与本仓度分秒、音效功能的写法一致：纯追加。
//   · 按钮只在文件末尾 append，不往 LAYOUT 里加 kind；
//   · 用捕获阶段的 click / keydown 委托，只在录入行列式时接管按键，
//     不命中就原样放行；既有分发逻辑与既有函数签名一律不动。
// =========================================================

/** 是否正在录入一个还没闭合的行列式（det2… / det3…，且还没出现 ]）。 */
function detIsTyping() {
  return /^det[23]/.test(text) && text.indexOf(']') === -1;
}

/** 主屏当前是不是一个行列式表达式（含已闭合、待按 = 的状态）。 */
function detIsExpression() {
  return /^det[23]/.test(text);
}

/** 副屏提示：副屏相关函数不存在时静默跳过，便于跨版本复用。 */
function detSub(message) {
  if (typeof showSub === 'function') {
    showSub(message);
  }
}

/** 结果格式化：优先用本仓既有的 formatResult，保证显示口径一致。 */
function detFormat(value) {
  if (typeof formatResult === 'function') {
    return formatResult(value);
  }
  return String(Number(value.toPrecision(12)));
}

/**
 * 解析并计算行列式表达式。
 * @param {string} raw 主屏文本
 * @returns {null | { ok: true, value: number } | { ok: false, reason: string }}
 *   不是行列式表达式时返回 null（交回原来的四则运算）。
 */
function detParse(raw) {
  const s = String(raw).replace(/\s+/g, '');
  const m = s.match(/^det([23])\[([^\]]*)\]$/);
  if (!m) {
    return null;
  }

  const order = Number(m[1]);
  const need = order === 2 ? 4 : 9;
  const parts = m[2] === '' ? [] : m[2].split(',');

  if (parts.length !== need) {
    return { ok: false, reason: `det${order} 需要 ${need} 个数字，当前 ${parts.length} 个` };
  }

  const nums = [];
  for (let k = 0; k < parts.length; k += 1) {
    const item = parts[k].trim();
    // 只接受十进制整数 / 小数（可带负号），拒绝 1e3、0x10 之类的伪装
    if (!/^-?\d+(\.\d+)?$/.test(item)) {
      return { ok: false, reason: '元素必须是数字' };
    }
    nums.push(Number(item));
  }

  if (order === 2) {
    const [a, b, c, d] = nums;
    return { ok: true, value: a * d - b * c }; // det2 = ad − bc
  }

  const [a, b, c, d, e, f, g, h, i] = nums;
  return {
    ok: true,
    // 标准三阶展开：a(ei−fh) − b(di−fg) + c(dh−eg)
    value: a * (e * i - f * h) - b * (d * i - f * g) + c * (d * h - e * g),
  };
}

/** det2 / det3 键：清好状态，写入模板，只输入文字不计算。 */
function detStart(order) {
  if (typeof clearState === 'function') {
    clearState();
  }
  parenStack.length = 0;
  canRepeat = false;
  text = `det${order}[`;
  waiting = false;
  detSub(`录入 det${order}[...]：逗号分隔 ${order === 2 ? 4 : 9} 个数，末尾点 ] 再按 =`);
  show();
}

/** 逗号键：行列式元素分隔符。 */
function detComma() {
  if (!detIsTyping()) {
    return;
  }
  text += ',';
  show();
}

/** 右方括号键：只补一个 ]，不计算；真正求值交给 = 键。 */
function detClose() {
  if (!detIsTyping()) {
    return;
  }
  text += ']';
  show();
}

/** 小数点键：只判断「当前数字段」有没有小数点，支持逐段录入小数。 */
function detDot() {
  const segment = text.split(/[\[,]/).pop();
  if (segment.includes('.')) {
    return;
  }
  text += '.';
  show();
}

/** − 键：在 [ 或 , 之后当负号写入；其它位置忽略，避免污染表达式。 */
function detMinus() {
  const last = text.slice(-1);
  if (last !== '[' && last !== ',') {
    return;
  }
  text += '-';
  show();
}

/** ± 键：只翻转「当前数字段」的正负号，不动 det2[ / 逗号 结构。 */
function detPlusMinus() {
  const lastSep = Math.max(text.lastIndexOf('['), text.lastIndexOf(','));
  const segment = text.slice(lastSep + 1);
  if (segment === '' || segment === '-') {
    return; // 还没有可翻转的数字
  }
  text = text.slice(0, lastSep + 1) + (segment.startsWith('-') ? segment.slice(1) : `-${segment}`);
  show();
}

/**
 * 按 = 时先试行列式。
 * @returns {boolean} true 表示已处理（拦下既有四则运算），false 表示这不是行列式表达式
 */
function detTryEvaluate() {
  const det = detParse(text);
  if (det === null) {
    // 看起来像行列式但还没写完整：给个提示，不静默失败
    if (detIsExpression()) {
      detSub('行列式格式：det2[a,b,c,d] 或 det3[a,…,i]，末尾补 ] 再按 =');
      return true;
    }
    return false;
  }

  if (!det.ok) {
    detSub(`行列式：${det.reason}`);
    return true;
  }

  const clean = text.replace(/\s+/g, '');
  const shown = detFormat(det.value);
  if (typeof ERROR_TEXT !== 'undefined' && shown === ERROR_TEXT) {
    detSub('行列式结果无效');
    return true;
  }

  if (typeof recordHistory === 'function') {
    recordHistory(`${clean} =`, shown);
  }
  text = shown;
  if (typeof clearState === 'function') {
    clearState();
  }
  parenStack.length = 0;
  canRepeat = false;
  waiting = true;
  detSub(`${clean} =`);
  show();
  return true;
}

// ---------------------------------------------------------
// 行列式按键：追加到键盘网格末尾
// 沿用既有 .key .key--action 样式，不新增 LAYOUT kind
// （static-check 白名单未收录新 kind，会掉进最终 else 误走 =）
// ---------------------------------------------------------
const detOwnButtons = [];

[
  ['det2', () => detStart(2)],
  ['det3', () => detStart(3)],
  [',', detComma],
  [']', detClose],
].forEach(([label, handler]) => {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'key key--action';
  button.textContent = label;
  button.addEventListener('click', handler);
  detOwnButtons.push(button);
  keyboard.appendChild(button);
});

// 录入行列式期间放行的按键：数字、小数点、正负号、逗号、右方括号，
// 以及随时能清空重来的 ⌫ / C / CE。其余按键（运算符、函数键、存储器键…）
// 在这段时间里一律不响应，免得把表达式搞坏。
const detInputAllowed = new Set([
  '0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '00',
  '.', '±', '−', ',', ']', '⌫', 'C', 'CE',
]);

const detBlockedHint = '行列式录入中：只能输入数字、小数点、逗号与 ]（C / CE / ⌫ 可清空）';

// ---------------------------------------------------------
// 事件委托：录入行列式时接管几个关键按键
// capture 阶段先于既有分发逻辑执行，命中才拦截，未命中一律放行
// ---------------------------------------------------------
keyboard.addEventListener(
  'click',
  (event) => {
    const btn = event.target && event.target.closest ? event.target.closest('button') : null;
    if (!btn || detOwnButtons.indexOf(btn) !== -1) {
      return; // 不是按键，或就是行列式自己的按键（由各自 handler 处理）
    }

    const label = btn.textContent;

    if (label === '=') {
      // = 不能只看「录入中」：末尾点了 ] 之后就不算录入中了，
      // 但那时才是真正要计算的状态。不是行列式表达式时返回 false，原样放行。
      if (detTryEvaluate()) {
        event.stopPropagation();
      }
      return;
    }

    if (!detIsExpression()) {
      return; // 主屏不是行列式表达式，全部交回既有逻辑
    }

    if (detIsTyping()) {
      if (label === '.') {
        detDot();
        event.stopPropagation();
        return;
      }
      if (label === '±') {
        detPlusMinus();
        event.stopPropagation();
        return;
      }
      if (label === '−') {
        detMinus();
        event.stopPropagation();
        return;
      }
      if (detInputAllowed.has(label)) {
        return; // 数字 / 00 / 逗号 / ] / ⌫ / C / CE：照常走既有逻辑
      }
    } else if (label === '⌫' || label === 'C' || label === 'CE') {
      return; // 表达式已闭合：只允许退格与清空，等用户按 = 或重来
    }

    detSub(detBlockedHint); // 会污染表达式的键：忽略并说明原因
    event.stopPropagation();
  },
  true,
);

document.addEventListener(
  'keydown',
  (event) => {
    const key = event.key;

    // = / Enter：命中行列式表达式就拦下算行列式，否则原样放行给既有逻辑
    if (key === '=' || key === 'Enter') {
      if (detTryEvaluate()) {
        event.stopPropagation();
        event.preventDefault();
      }
      return;
    }

    if (!detIsExpression()) {
      return; // 与行列式无关，物理键盘全部走既有逻辑
    }

    if (!detIsTyping()) {
      // 表达式已闭合：只放行退格与 C，其余忽略，等用户按 = 或清空重来
      if (key === 'Backspace' || key === 'Escape' || key.toLowerCase() === 'c') {
        return;
      }
      detSub(detBlockedHint);
      event.stopPropagation();
      event.preventDefault();
      return;
    }

    let handled = true;
    if (key === ',') {
      detComma();
    } else if (key === ']') {
      detClose();
    } else if (key === '.') {
      detDot();
    } else if (key === '-') {
      detMinus();
    } else if (key === '+' || key === '*' || key === '/') {
      detSub(detBlockedHint); // 录入期间的运算符：忽略，避免污染表达式
    } else {
      handled = false; // 数字、退格、C 等照常交给既有逻辑
    }

    if (handled) {
      event.stopPropagation();
      event.preventDefault();
    }
  },
  true,
);

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

// =================================================================
// 新增：复数运算（关联 Issue #205）
//
// 需求：支持解析含虚数单位 i 的输入（如 3+4i、5i），实现复数加、减、乘、
//       除四则运算，输出标准复数格式 a + bi，并处理除零与非法表达式。
//
// 约束：本段为纯追加代码，不动上方任何既有逻辑，不改 index.html、不改
//       css/style.css。由于页面原本没有文本输入框，这里用
//       document.createElement 动态生成输入 UI（样式全部内联）。
// =================================================================

/**
 * 数字精度清理：消除浮点运算的长尾误差（如 0.1 + 0.2 = 0.30000000000000004）。
 * 同时把 -0 归一成 0，避免显示成 "-0"。
 * @param {number} n
 * @returns {number}
 */
function normalizeNumber(n) {
  if (!Number.isFinite(n)) {
    return n;
  }
  if (Object.is(n, -0)) {
    return 0;
  }
  return Number(n.toPrecision(12));
}

/**
 * 复数：由实部 real 与虚部 imag 构成，虚部省略写法的系数即 1。
 * 内部封装复数的加、减、乘、除四则运算。
 */
class Complex {
  /**
   * @param {number} [real=0] 实部
   * @param {number} [imag=0] 虚部
   */
  constructor(real = 0, imag = 0) {
    this.real = normalizeNumber(real);
    this.imag = normalizeNumber(imag);
  }

  /**
   * 复数加法：(a+bi) + (c+di) = (a+c) + (b+d)i
   * @param {Complex} o
   * @returns {Complex}
   */
  add(o) {
    return new Complex(this.real + o.real, this.imag + o.imag);
  }

  /**
   * 复数减法：(a+bi) - (c+di) = (a-c) + (b-d)i
   * @param {Complex} o
   * @returns {Complex}
   */
  sub(o) {
    return new Complex(this.real - o.real, this.imag - o.imag);
  }

  /**
   * 复数乘法：(a+bi)(c+di) = (ac-bd) + (ad+bc)i
   * @param {Complex} o
   * @returns {Complex}
   */
  mul(o) {
    return new Complex(
      this.real * o.real - this.imag * o.imag,
      this.real * o.imag + this.imag * o.real,
    );
  }

  /**
   * 复数除法：分子分母同乘分母的共轭。
   *   (a+bi)/(c+di) = [(ac+bd) + (bc-ad)i] / (c²+d²)
   * @param {Complex} o
   * @returns {Complex|null} 除数为 0（c²+d²=0）时返回 null
   */
  div(o) {
    const denom = o.real * o.real + o.imag * o.imag;
    if (denom === 0) {
      return null; // 除数为 0：0 与 0i 都是 0，无意义
    }
    return new Complex(
      (this.real * o.real + this.imag * o.imag) / denom,
      (this.imag * o.real - this.real * o.imag) / denom,
    );
  }
}

// ---------------------------------------------------------------
// 表达式解析
// ---------------------------------------------------------------
// Issue 里给的正则示例 /^([+-]?\d*\.?\d*)([+-]?\d*\.?\d*)i$/ 只适用于
// 「实部 + 虚部」一种写法：它拿 5i 去匹配会得到 real=5、imag=0（错），
// 因为第一段 \d*\.?\d* 会把 5 吃掉。因此这里按「纯实数 / 纯虚数 / 完整」
// 三种形态分别匹配，并统一要求必须有数字，避免 . 或 + 这类空壳被放过。

/** 纯实数：3、-2.5、.5、+7 */
const COMPLEX_REAL_RE = /^[+-]?(?:\d+\.?\d*|\.\d+)$/;
/** 纯虚数：3i、-i、i、+2.5i —— 系数可省略（省略即 ±1） */
const COMPLEX_IMAG_RE = /^([+-]?)(\d*\.?\d*)i$/;
/** 完整形：3+4i、-3-4i、3+i、3-i */
const COMPLEX_FULL_RE = /^([+-]?(?:\d+\.?\d*|\.\d+))([+-])(\d*\.?\d*)i$/;

/**
 * 把「虚部系数」字符串转成数字，空串按 1 处理（对应单独一个 i）。
 * @param {string} coefStr
 * @returns {number|null} 非法返回 null
 */
function imagCoefToNumber(coefStr) {
  if (coefStr === '') {
    return 1;
  }
  if (coefStr === '.') {
    return null; // ".i" 这种不完整写法
  }
  const n = Number(coefStr);
  return Number.isFinite(n) ? n : null;
}

/**
 * 解析复数表达式字符串。
 * @param {string} raw 用户输入，如 "3+4i"、"5i"、"-i"、"2.5"
 * @returns {{ok: true, value: Complex} | {ok: false, reason: string}}
 */
function parseComplex(raw) {
  // 允许用户带空格输入，如 "3 + 4i"
  const s = String(raw === null || raw === undefined ? '' : raw).replace(/\s+/g, '');
  if (s === '') {
    return { ok: false, reason: '错误：请输入复数' };
  }

  // 形态一：纯实数
  if (COMPLEX_REAL_RE.test(s)) {
    const real = Number(s);
    if (!Number.isFinite(real)) {
      return { ok: false, reason: '错误：数值超出范围' };
    }
    return { ok: true, value: new Complex(real, 0) };
  }

  // 形态二：纯虚数
  let m = COMPLEX_IMAG_RE.exec(s);
  if (m) {
    const sign = m[1] === '-' ? -1 : 1;
    const coef = imagCoefToNumber(m[2]);
    if (coef === null) {
      return { ok: false, reason: '错误：非法表达式' };
    }
    return { ok: true, value: new Complex(0, sign * coef) };
  }

  // 形态三：实部 + 虚部
  m = COMPLEX_FULL_RE.exec(s);
  if (m) {
    const real = Number(m[1]);
    const sign = m[2] === '-' ? -1 : 1;
    const coef = imagCoefToNumber(m[3]);
    if (coef === null) {
      return { ok: false, reason: '错误：非法表达式' };
    }
    if (!Number.isFinite(real)) {
      return { ok: false, reason: '错误：数值超出范围' };
    }
    return { ok: true, value: new Complex(real, sign * coef) };
  }

  // 其余一律拦截：i+++、3++4i、abc、3+4（缺 i）等
  return { ok: false, reason: '错误：非法表达式' };
}

/**
 * 把复数格式化为标准写法 a + bi。
 * 规则：虚部为 0 时只给实部；实部为 0 时只给虚部；系数 ±1 省略数字。
 * @param {Complex} c
 * @returns {string} 如 "3 + 4i"、"3 - 4i"、"4i"、"-i"、"7"、"0"
 */
function formatComplex(c) {
  const real = normalizeNumber(c.real);
  const imag = normalizeNumber(c.imag);

  // 虚部为 0 → 退化成实数
  if (imag === 0) {
    return String(real);
  }

  // 实部为 0 → 只保留虚部
  if (real === 0) {
    if (imag === 1) {
      return 'i';
    }
    if (imag === -1) {
      return '-i';
    }
    return imag + 'i';
  }

  // 实部与虚部都不为 0 → 拼接，符号用空格分隔，系数 ±1 省掉数字
  const sign = imag > 0 ? ' + ' : ' - ';
  const absImag = Math.abs(imag);
  const imagText = absImag === 1 ? '' : String(absImag);
  return real + sign + imagText + 'i';
}

/**
 * 按运算符计算两个复数。
 * @param {Complex} left
 * @param {string} op  '+' | '-' | '*' | '/'
 * @param {Complex} right
 * @returns {Complex|null} 除数为 0 时返回 null
 */
function computeComplex(left, op, right) {
  if (op === '+') {
    return left.add(right);
  }
  if (op === '-') {
    return left.sub(right);
  }
  if (op === '*') {
    return left.mul(right);
  }
  if (op === '/') {
    return left.div(right);
  }
  return null;
}

// ---------------------------------------------------------------
// 输入 UI：页面原本没有文本输入框，这里动态生成
// （Issue 要求不修改 HTML，故全部用 createElement + 内联样式）
// ---------------------------------------------------------------
const complexPanel = document.createElement('section');
complexPanel.id = 'complex-panel';
complexPanel.setAttribute('aria-label', '复数运算区');
complexPanel.style.marginTop = '16px';
complexPanel.style.padding = '12px';
complexPanel.style.borderRadius = '12px';
complexPanel.style.background = 'rgba(255,255,255,0.92)';
complexPanel.style.textAlign = 'center';

// 标题
const complexTitle = document.createElement('h3');
complexTitle.textContent = '复数运算';
complexTitle.style.margin = '0 0 8px';
complexTitle.style.fontSize = '14px';
complexTitle.style.color = '#334155';
complexPanel.appendChild(complexTitle);

/** 生成一个带标签的输入框。 */
function createComplexField(labelText, placeholder, initial) {
  const wrap = document.createElement('label');
  wrap.style.flex = '1';
  wrap.style.display = 'flex';
  wrap.style.alignItems = 'center';
  wrap.style.gap = '4px';
  wrap.style.fontSize = '13px';
  wrap.style.color = '#334155';

  const span = document.createElement('span');
  span.textContent = labelText;
  // 标签不许折行：面板窄时「复数 A」会被压成竖排的「复/数/A」，很难看
  span.style.whiteSpace = 'nowrap';
  span.style.flexShrink = '0';

  const input = document.createElement('input');
  input.type = 'text';
  input.inputMode = 'text';
  input.value = initial;
  input.placeholder = placeholder;
  input.setAttribute('aria-label', labelText);
  input.style.width = '100%';
  input.style.minWidth = '0';
  input.style.padding = '4px 6px';
  input.style.border = '1px solid #9aa4bd';
  input.style.borderRadius = '6px';
  input.style.fontSize = '13px';
  input.style.background = '#fff';
  input.style.color = '#020202';

  wrap.appendChild(span);
  wrap.appendChild(input);
  return { wrap, input };
}

// 输入行：复数A  [运算符]  复数B
const complexForm = document.createElement('div');
complexForm.style.display = 'flex';
complexForm.style.gap = '8px';
complexForm.style.alignItems = 'center';
complexForm.style.marginBottom = '8px';

const fieldA = createComplexField('复数 A', '如 3+4i', '3+4i');
complexForm.appendChild(fieldA.wrap);

const complexOp = document.createElement('select');
complexOp.setAttribute('aria-label', '运算符');
[['+', '＋ 加'], ['-', '－ 减'], ['*', '× 乘'], ['/', '÷ 除']].forEach(([val, label]) => {
  const opt = document.createElement('option');
  opt.value = val;
  opt.textContent = label;
  complexOp.appendChild(opt);
});
complexOp.style.padding = '4px 6px';
complexOp.style.border = '1px solid #9aa4bd';
complexOp.style.borderRadius = '6px';
complexOp.style.fontSize = '13px';
complexOp.style.background = '#fff';
complexOp.style.color = '#020202';
complexForm.appendChild(complexOp);

const fieldB = createComplexField('复数 B', '如 5i', '5i');
complexForm.appendChild(fieldB.wrap);

complexPanel.appendChild(complexForm);

// 操作按钮行
const complexActions = document.createElement('div');
complexActions.style.display = 'flex';
complexActions.style.gap = '8px';
complexActions.style.marginBottom = '8px';

const complexCalcBtn = document.createElement('button');
complexCalcBtn.type = 'button';
complexCalcBtn.className = 'complex-action-btn';
complexCalcBtn.style.background = '#2f6fed';
complexCalcBtn.style.color = '#ffffff';
complexCalcBtn.textContent = '计算';
complexCalcBtn.style.flex = '1';
complexCalcBtn.style.padding = '6px 0';
complexCalcBtn.style.border = 'none';
complexCalcBtn.style.borderRadius = '8px';
complexCalcBtn.style.cursor = 'pointer';
// .key 带的是键盘按键字号（24px），这里必须显式压回面板尺度
complexCalcBtn.style.fontSize = '14px';
complexCalcBtn.style.fontWeight = '600';

const complexClearBtn = document.createElement('button');
complexClearBtn.type = 'button';
complexClearBtn.className = 'complex-action-btn';
complexClearBtn.style.background = '#e2e8f0';
complexClearBtn.style.color = '#334155';
// 注意：文案不能叫「清空」——历史记录面板已有一个「清空」按钮，
// ci/smoke.spec.mjs 用 getByRole('button', { name: '清空' }) 全局选择历史那个，
// 重名会让 Playwright strict mode 报「resolved to 2 elements」而挂掉 CI。
complexClearBtn.textContent = '重置';
complexClearBtn.style.flex = '1';
complexClearBtn.style.padding = '6px 0';
complexClearBtn.style.border = 'none';
complexClearBtn.style.borderRadius = '8px';
complexClearBtn.style.cursor = 'pointer';
complexClearBtn.style.fontSize = '14px';
complexClearBtn.style.fontWeight = '600';

complexActions.appendChild(complexCalcBtn);
complexActions.appendChild(complexClearBtn);
complexPanel.appendChild(complexActions);

// 结果行
const complexResult = document.createElement('div');
complexResult.setAttribute('aria-label', '复数运算结果');
complexResult.style.minHeight = '24px';
complexResult.style.fontSize = '14px';
complexResult.style.fontWeight = '600';
complexResult.style.lineHeight = '1.5';
complexResult.style.color = '#334155';
complexResult.style.wordBreak = 'break-all';
complexPanel.appendChild(complexResult);

// 用法提示
const complexHint = document.createElement('div');
complexHint.textContent = '支持写法：3+4i、3-4i、5i、-i、2.5（空格可省略，虚部系数 ±1 可省略）';
complexHint.style.marginTop = '4px';
complexHint.style.fontSize = '11.5px';
complexHint.style.lineHeight = '1.5';
complexHint.style.color = '#64748b';
complexHint.style.wordBreak = 'break-all';
complexPanel.appendChild(complexHint);

// 挂到 main.calculator 内、#keyboard 之外。
// 注意不能挂进 #keyboard —— 它是 4 列 grid，面板会被压成 1/4 宽。
const complexHost = document.querySelector('main.calculator');
if (complexHost) {
  complexHost.appendChild(complexPanel);
}

// ---------------------------------------------------------------
// 交互处理
// ---------------------------------------------------------------
/** 把结果行设为普通文本。 */
function setComplexResult(text) {
  complexResult.textContent = text;
  complexResult.style.color = '#334155';
}

/** 把结果行设为错误样式。 */
function setComplexError(text) {
  complexResult.textContent = text;
  complexResult.style.color = 'var(--key-danger)';
}

/** 点击「计算」：解析 → 运算 → 输出。 */
function handleComplexCompute() {
  const parsedA = parseComplex(fieldA.input.value);
  if (!parsedA.ok) {
    setComplexError('复数 A ' + parsedA.reason);
    return;
  }
  const parsedB = parseComplex(fieldB.input.value);
  if (!parsedB.ok) {
    setComplexError('复数 B ' + parsedB.reason);
    return;
  }

  const op = complexOp.value;
  const result = computeComplex(parsedA.value, op, parsedB.value);
  if (result === null) {
    setComplexError('错误：除数不能为 0');
    return;
  }

  const opText = { '+': '+', '-': '−', '*': '×', '/': '÷' }[op];
  setComplexResult(
    formatComplex(parsedA.value) + ' ' + opText + ' ' + formatComplex(parsedB.value) +
      ' = ' + formatComplex(result),
  );
}

/** 点击「清空」：清掉输入与结果（保留默认示例便于继续试）。 */
function handleComplexClear() {
  fieldA.input.value = '';
  fieldB.input.value = '';
  complexResult.textContent = '';
  complexResult.style.color = '#334155';
}

complexCalcBtn.addEventListener('click', handleComplexCompute);
complexClearBtn.addEventListener('click', handleComplexClear);

// 初始先算一次，让面板一打开就有结果可看
handleComplexCompute();

// 供外部/测试调用
if (typeof window !== 'undefined') {
  window.Complex = Complex;
  window.parseComplex = parseComplex;
  window.formatComplex = formatComplex;
  window.computeComplex = computeComplex;
}

// ---------------------------------------------------------------
// 阻止输入框里的按键泄漏到计算器
// 原文件的物理键盘监听挂在 document 上（约 774 行）且不判断事件目标，
// 在输入框里打字会被它当成计算器输入。这里在捕获阶段拦下。
// ---------------------------------------------------------------
document.addEventListener(
  'keydown',
  (e) => {
    const target = e.target;
    if (!target || (target.tagName !== 'INPUT' && target.tagName !== 'SELECT')) {
      return;
    }
    if (!complexPanel.contains(target)) {
      return; // 只管本面板，其它输入框不干预
    }
    e.stopImmediatePropagation(); // 同节点同阶段需用 stopImmediatePropagation
    if (e.key === 'Enter') {
      e.preventDefault();
      handleComplexCompute();
    }
  },
  true,
);
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

// 按键：追加到等号之前（CT1：显示区之外可加按钮），
// 不往 LAYOUT / KEY_CLASS 里加新 kind，避免动到既有按键分发逻辑
const PERMUTATION_KEYS = [
  ['nPr', 'nPr', '排列数 A(n,k) = n!/(n−k)!'],
  ['nCr', 'nCr', '组合数 C(n,k) = n!/(k!(n−k)!)'],
];

PERMUTATION_KEYS.forEach(([label, op, hint]) => {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'key key--sci';
  button.textContent = label;
  button.title = hint;
  button.addEventListener('click', () => inputOperator(op));
  keyboard.insertBefore(button, keyboard.lastElementChild);
});

// =================================================================
// 新增：分数输入与分数 ⇄ 小数切换（纯追加，不改动上方任何既有代码）
//
// 两个键：
//   a/b   分数键：第一次按下取当前数为分子，输入分母后再按一次合成分数
//   F⇄D   切换键：在当前结果的小数形式与分数形式之间来回切换
//
// ----------------------------------------------------------------
// 关键设计：数值读取的统一防护（复审第 1、2 条意见的修法）
//
// 主屏以分数形式显示时 text === "3/4"，直接 Number(text) 会得到 NaN。
// 既有代码里有 20+ 处 Number(text)，分散在 inputOperator / inputEquals /
// inputSqrt / inputPercent 等一堆函数里，它们全都假设 text 是纯数字。
//
// 第一版只靠「捕获阶段的事件监听」在按键前还原，这有个致命弱点：
// 正确性依赖「事件一定先命中这个监听」。一旦事件被 stopPropagation 拦下、
// 或某条路径是代码内部直接调用而非用户点击，防护就漏了，立刻 NaN。
//
// 现在改成两层，正确性不再依赖事件：
//   第 1 层（兜底，必须）：读取前置。
//     把所有会读 Number(text) 的既有函数入口统一包一层（见文件末尾
//     installFractionGuards），进函数前先自愈。无论从哪条路径进来都拦得住。
//   第 2 层（提前量，可选）：事件前置。
//     保留捕获阶段监听，只是让还原发生得更早、UI 更即时。
//     即使把这段监听整段删掉，第 1 层依然保证不出 NaN。
//
// 另外提供 readDisplayValue() 作为统一读取入口：新增代码要读主屏数值时
// 一律走它，它会还原分数并把 NaN / Infinity 收敛成 null。
// 全程纯追加：不动显示区 DOM、不改既有函数签名、不引第三方依赖。
// ----------------------------------------------------------------

/** 最近一次产生或识别出来的分数，形如 { n: 3, d: 4 }。 */
let fracValue = null;
/** 主屏当前是否正以分数形式显示。 */
let showingFraction = false;
/** 分数输入进度：0 = 未开始，1 = 已取分子、等待分母。 */
let fracStage = 0;
/** fracStage === 1 时暂存的分子。 */
let fracNum = null;

/** 手动输入分数时允许的最大分母。 */
const FRAC_MAX_DEN = 1e6;
/**
 * 「小数自动转分数」时允许的最大分母，比上面小得多。
 * 否则 π 会被转成 103993/33102 这种虽然精确但没法看的分数，
 * 判为「无法精确表示」反而更符合预期。
 */
const FRAC_AUTO_MAX_DEN = 1e4;
/** 判定「等于」的容差：1e-9 足以挡掉 0.1 + 0.2 那类浮点长尾。 */
const FRAC_TOL = 1e-9;

/** 辗转相除求最大公约数（约分用）。分母不会为 0，返回 1 兜底。 */
function gcdInt(a, b) {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y) {
    const t = x % y;
    x = y;
    y = t;
  }
  return x || 1;
}

/** 把 { n, d } 写成「3/4」；分母为 1 时只写整数；负号统一放在分子。 */
function formatFraction(frac) {
  if (!frac) {
    return '';
  }
  if (frac.d === 1) {
    return String(frac.n);
  }
  return `${frac.n}/${frac.d}`;
}

/**
 * 小数 → 分数：连分数展开，取第一个落在容差内的渐近分数。
 * 转不出来（无理数或分母过大）返回 null，由调用方给出提示。
 * @param {number} value 待转换的小数
 * @param {number} maxDen 允许的最大分母，默认 FRAC_AUTO_MAX_DEN
 * @returns {{n: number, d: number}|null} 最简分数，无法精确表示时返回 null
 */
function toFraction(value, maxDen = FRAC_AUTO_MAX_DEN) {
  if (!Number.isFinite(value)) {
    return null;
  }
  if (value === 0) {
    return { n: 0, d: 1 };
  }
  const sign = value < 0 ? -1 : 1;
  const x = Math.abs(value);

  let p0 = 0;
  let q0 = 1;
  let p1 = 1;
  let q1 = 0;
  let b = x;

  for (let i = 0; i < 64; i += 1) {
    const a = Math.floor(b);
    const p = a * p1 + p0;
    const q = a * q1 + q0;
    if (q !== 0 && q <= maxDen && Math.abs(x - p / q) <= FRAC_TOL) {
      const g = gcdInt(p, q);
      return { n: sign * (p / g), d: q / g };
    }
    p0 = p1;
    q0 = q1;
    p1 = p;
    q1 = q;
    if (q1 > maxDen) {
      return null;
    }
    const rest = b - a;
    if (rest < 1e-12) {
      break;
    }
    b = 1 / rest;
  }
  return null;
}

/**
 * 一个数的小数位数（用于把小数分子/分母放大成整数）。
 * 科学计数法（1e-7 会写成 "1e-7"）不参与缩放，返回 0 交给后续兜底。
 * @param {number} v
 * @returns {number}
 */
function decimalsOf(v) {
  const s = String(v);
  if (!s.includes('.') || s.includes('e') || s.includes('E')) {
    return 0;
  }
  const tail = s.split('.')[1] || '';
  return /^\d+$/.test(tail) ? tail.length : 0;
}

/** 缩放时允许的最大小数位数，超出就按「无法表示」处理，避免溢出成天文数字。 */
const FRAC_MAX_SCALE = 12;

/**
 * 由分子分母合成一个约分后的分数。
 * 分子或分母是小数时（如 3 / 0.4），先把两边同时放大成整数再约分，
 * 否则 3 / 0.4 会算出 27021597764222976/3602879701896397 这种浮点垃圾。
 * @param {number} n 分子
 * @param {number} d 分母
 * @returns {{n: number, d: number}|null} 分母为 0 或非法时返回 null
 */
function makeFraction(n, d) {
  if (!Number.isFinite(n) || !Number.isFinite(d) || d === 0) {
    return null;
  }

  // 小数 → 整数：两边同乘 10^k（如 3 / 0.4 → 30 / 4 → 15 / 2）
  const k = Math.min(Math.max(decimalsOf(n), decimalsOf(d)), FRAC_MAX_SCALE);
  if (k > 0) {
    const factor = 10 ** k;
    n = Math.round(n * factor);
    d = Math.round(d * factor);
  }
  if (!Number.isInteger(n) || !Number.isInteger(d) || d === 0) {
    return null;
  }

  if (Math.abs(d) > FRAC_MAX_DEN) {
    return null; // 分母大到没意义，按非法输入处理
  }
  if (d < 0) {
    n = -n;
    d = -d; // 负号统一挪到分子，避免出现 3/-4
  }
  const g = gcdInt(n, d);
  return { n: n / g, d: d / g };
}

/**
 * 把主屏从分数形式还原成小数。
 * 幂等：非分数态直接返回，可以在任何入口反复调用而不产生副作用。
 * 所有会读 Number(text) 的地方都应在读取前调用它（见 installFractionGuards）。
 * 注意：这里不动 fracStage —— 正在等分母时按数字是正常输入，不能清进度。
 */
function restoreFractionDisplay() {
  if (!showingFraction || !fracValue) {
    return;
  }
  showingFraction = false;
  // 主屏若已被键盘区之外的逻辑改写（如历史回填先把结果塞了进来），
  // 说明这个分数已经过期：只丢掉分数状态，绝不能把人家刚填的值覆盖掉。
  if (text === formatFraction(fracValue)) {
    text = formatResult(fracValue.n / fracValue.d);
    show();
  }
}

/**
 * 统一数值读取入口（复审意见 1）。
 * 既有代码里的 Number(text) 散落各处且假设 text 一定是纯数字，
 * 这里统一收敛成两步：先确保分数已还原，再把 NaN / Infinity 挡掉。
 * 新增代码要读主屏数值时请一律走这里，不要再直接 Number(text)。
 * @returns {number|null} 合法数字；主屏不是数字时返回 null
 */
function readDisplayValue() {
  restoreFractionDisplay();
  const value = Number(text);
  return Number.isFinite(value) ? value : null;
}

/** 放弃尚未完成的分数输入进度（按了数字/小数点以外的键时调用）。 */
function cancelFractionInput() {
  fracStage = 0;
  fracNum = null;
}

/**
 * 正在等分母时，按这些键属于「还在输分母」，不能取消分数输入：
 * 数字、小数点、负号（输 -4 做分母）、正负号、退格（输错重改）。
 * 其余键（运算符、等号、清除、功能键）一律视为放弃输入。
 * @param {string} label 键面文字；物理键盘传 e.key
 * @returns {boolean}
 */
function isFractionInputKey(label) {
  return (
    /^[0-9.]$/.test(label)
    || label === '00' // 双零键同样是「在输分母」
    || label === '-' // 物理键盘的负号：输 -4 做分母（复审意见 3）
    || label === '±'
    || label === '⌫'
    || label === 'Backspace'
  );
}

/**
 * 等分母时切换分母的正负号。
 *
 * 这里必须拦下既有的取负 / 减号逻辑，不能交给它们处理：
 *   - 交给 inputOperator('−')：'-' 会被当成二元运算符，直接启动一次减法，
 *     分子被塞进 acc，分数输入进度作废 —— 物理键盘永远输不出负分母。
 *   - 交给 inputPlusMinus()：它读的是「当前主屏的值」，而此刻主屏还是分子，
 *     取负改的是分子；随后按数字时 waiting 又把主屏整个替换掉，负号照样丢。
 * 所以负号由分数模块自己接管：先落到主屏，后面的数字接着往它后面拼。
 */
function toggleDenominatorSign() {
  if (waiting) {
    // 分母还没开始输：负号先占住主屏，后面的数字接着往它后面拼
    text = '-';
    waiting = false;
  } else if (isDenominatorUnfinished()) {
    // 只输了负号就又按一次：撤掉，回到「还没输分母」的状态
    text = INITIAL;
    waiting = true;
  } else if (text.startsWith('-')) {
    text = text.slice(1); // 分母已经输进来了：负变正
  } else {
    text = `-${text}`; // 正变负
  }
  showSub(`${formatResult(fracNum)} / ?`);
  show();
}

/** 分母是否只输了负号、数字还没进来（'-' 或空）。 */
function isDenominatorUnfinished() {
  return text === '' || text === '-' || text === '-.';
}

/** 修饰键本身不算输入，敲到它既不该中断分母输入，也没必要还原。 */
const FRAC_MODIFIER_KEYS = new Set([
  'Shift',
  'Control',
  'Alt',
  'Meta',
  'AltGraph',
  'CapsLock',
  'Tab',
  'OS',
]);

/** a/b 键：第一次按下取分子，第二次按下合成分数。 */
function inputFraction() {
  if (isError()) {
    return;
  }
  canRepeat = false; // 一元运算改变了当前数，旧的连算资格作废
  restoreFractionDisplay(); // 主屏若正显示分数，先还原成小数再当分子用

  if (fracStage === 1) {
    // 第二次按下：分母还没真的输进来就当取消。
    // waiting 仍是 true = 一个数字都没按；只按了 '-' = 负号还没跟上数字。
    // 这两种情况都算「放弃」，不能当成 0 去算、更不能报错误。
    if (waiting || isDenominatorUnfinished()) {
      cancelFractionInput();
      // 只按了负号、数字还没进来时主屏是个半成品 '-'，
      // 清掉它再退出，免得下一位数字被拼成 '-5' 这种莫名其妙的值。
      if (isDenominatorUnfinished()) {
        text = INITIAL;
        waiting = true;
        show();
      }
      showSub('分数输入已取消');
      return;
    }
    const den = readDisplayValue();
    if (den === null) {
      cancelFractionInput();
      showSub('分数输入已取消');
      return;
    }
    const frac = makeFraction(fracNum, den);
    fracStage = 0;
    fracNum = null;
    if (!frac) {
      text = ERROR_TEXT; // 分母为 0
      clearState();
      showSub('');
      show();
      return;
    }
    fracValue = frac;
    showingFraction = true;
    text = formatFraction(frac);
    waiting = true; // 这是一个完整结果，下一个数字另起一轮
    showSub(`= ${formatResult(frac.n / frac.d)}`);
    show();
    return;
  }

  const n = readDisplayValue();
  if (n === null) {
    showSub('分子无效，分数输入未开始');
    return;
  }
  fracNum = n;
  fracStage = 1;
  waiting = true; // 下一个数字另起一轮，作为分母
  showSub(`${formatResult(n)} / ?`);
  show();
}

/** F⇄D 键：在当前结果的小数形式与分数形式之间切换。 */
function toggleFractionDisplay() {
  if (isError()) {
    return;
  }
  if (fracStage === 1) {
    return; // 正在等分母，不接受切换
  }

  if (showingFraction && fracValue) {
    showingFraction = false;
    text = formatResult(fracValue.n / fracValue.d);
    showSub(`= ${formatFraction(fracValue)}`); // 分数形式挪到副屏备查
    show();
    return;
  }

  const value = readDisplayValue();
  if (value === null) {
    return;
  }
  const frac = toFraction(value);
  if (!frac) {
    showSub('无法精确表示为分数');
    return;
  }
  fracValue = frac;
  showingFraction = true;
  text = formatFraction(frac);
  showSub(`= ${formatResult(value)}`); // 小数形式挪到副屏备查
  show();
}

// ---------------------------------------------------------------
// 在键盘末尾追加两个键：沿用现有 .key .key--action 样式，
// 不动 LAYOUT / KEY_CLASS / OPERATORS，也不碰既有按键的分发逻辑。
// ---------------------------------------------------------------
const fractionButton = document.createElement('button');
fractionButton.type = 'button';
fractionButton.className = 'key key--action';
fractionButton.textContent = 'a/b';
fractionButton.addEventListener('click', inputFraction);
keyboard.appendChild(fractionButton);

const fracToggleButton = document.createElement('button');
fracToggleButton.type = 'button';
fracToggleButton.className = 'key key--action';
fracToggleButton.textContent = 'F⇄D';
fracToggleButton.addEventListener('click', toggleFractionDisplay);
keyboard.appendChild(fracToggleButton);

// 捕获阶段监听：只是「提前量」，让还原发生在按键逻辑之前、UI 更即时。
// 正确性不再依赖它 —— 下面每个函数的入口守卫（installFractionGuards）会兜底，
// 即使这段监听完全不执行，也不会出现 Number("3/4") → NaN。
keyboard.addEventListener('click', (e) => {
  if (e.target === fractionButton || e.target === fracToggleButton) {
    return; // 这两个键自己处理分数状态，跳过还原
  }
  const label = (e.target.textContent || '').trim();
  // 等分母时按 ±：这是分母的负号，交给分数模块自己接管，
  // 不能让既有的取负逻辑把分子给改了（捕获阶段拦下目标元素的监听器）。
  if (fracStage === 1 && label === '±') {
    e.stopPropagation();
    e.preventDefault();
    toggleDenominatorSign();
    return;
  }
  restoreFractionDisplay();
  if (!isFractionInputKey(label)) {
    cancelFractionInput(); // 只有按数字/小数点才继续等分母，其余键放弃分数输入
  }
}, true);

// 物理键盘同理。额外处理：等分母时按 '-' 是负分母的负号，
// 必须拦在上游把它当成二元减号之前（上游的 keydown 在冒泡阶段，这里在捕获阶段）。
document.addEventListener('keydown', (e) => {
  const k = e.key || '';
  if (FRAC_MODIFIER_KEYS.has(k)) {
    return; // 单敲 Shift / Ctrl 这类不算输入，别把分母输入打断
  }
  if (fracStage === 1 && (k === '-' || k === '_')) {
    e.stopPropagation();
    e.preventDefault();
    toggleDenominatorSign();
    return;
  }
  restoreFractionDisplay();
  if (!isFractionInputKey(k)) {
    cancelFractionInput();
  }
}, true);

// 键盘区之外的点击（历史回填、主题切换等）同样先还原分数：
// 捕获阶段早于目标元素自身的监听器，所以还原之后再交给原逻辑改写主屏，
// 不会出现「分数把刚回填的历史值顶掉」这类问题。
document.addEventListener('click', (e) => {
  if (keyboard && keyboard.contains(e.target)) {
    return; // 键盘区由上面的监听统一处理，这里不重复
  }
  restoreFractionDisplay();
  cancelFractionInput();
}, true);

// ---------------------------------------------------------------
// 数值读取守卫（复审意见 2 的核心修法）
//
// 下面这些是既有代码里所有函数体内出现过 Number(text) 的函数。
// 给它们统一套一层前置：进函数前先 restoreFractionDisplay()。
// 不改签名、不动函数体、不删任何一行，只是在外部包一层。
//
// 效果：还原动作从「事件发生前」下沉到「读取发生的那一刻」。
// 于是无论从哪条路径进来 —— 鼠标点击、物理键盘、代码内部直接调用、
// 或者某条链路上的 stopPropagation 把事件监听绕过去了 —— 读取前
// 主屏都一定是合法数字，不会再有 Number("3/4") → NaN。
// 上面那几条事件监听因此降级为「提前量」，不再是正确性的唯一依靠。
//
// 维护约定：新增代码要读主屏数值请优先用 readDisplayValue()；
// 若沿用 Number(text)，记得把函数名加进 FRAC_GUARDED_FN_NAMES。
// ---------------------------------------------------------------

/**
 * 需要在读取 Number(text) 之前自动还原分数的既有函数名。
 * 这些函数都会把主屏当纯数字读，等价于「分数必须已经还原」。
 * inputPlusMinus 不在此列：它在等分母时另有语义，单独包装（见下）。
 */
const FRAC_GUARDED_FN_NAMES = [
  'applyPending',
  'inputOperator',
  'inputEquals',
  'inputSqrt',
  'inputRound',
  'inputPercent',
  'inputSquare',
  'inputReciprocal',
  'inputAbs',
  'inputTrig',
  'inputArcTrig',
  'inputMemoryAdd',
  'inputMemorySubtract',
  'inputHyperbolic',
  'inputCube',
  'inputOddEven',
  'inputFactorial',
  'dmsTake',
  'dmsAbandon',
  'inputDmsSecond',
  // 注意 dmsAfter 不在此列：它被「每次点任何键都会跑」的旁路监听调用
  // （见 main.js 里度分秒模块的 keyboard click / document keydown 监听）。
  // 给它套守卫的话，a/b 刚把分数显示出来就会被它无条件还原成小数。
  // 它只在「按了 = 且本次算式用过度分秒」时才读 Number(text)，
  // 那种情况事件层已经先还原过了，不套守卫也不会读到 NaN。
];

/** 已装好守卫的函数，避免重复包装。 */
const FRAC_GUARDED_FNS = new Set();

/**
 * 给一个既有函数套上「进来先还原分数」的前置逻辑。
 *
 * 这里只做还原，不顺带作废旧的输入进度：仓库里存在「每次点任何键都会被调用」
 * 的旁路监听（如度分秒模块的 dmsAfter），在守卫里 cancel 会把正在进行的
 * 分母输入误取消掉。取消属于交互语义，仍由上面的事件监听负责。
 * @param {Function} fn 原函数
 * @returns {Function} 包装后的函数
 */
function withFractionGuard(fn) {
  return function fractionGuarded(...args) {
    restoreFractionDisplay();
    return fn.apply(this, args);
  };
}

/**
 * 安装守卫：把列表里的函数替换成带前置防护的版本。
 * 名字对不上（函数被重命名或移除）就跳过 —— 守卫是保险，不能反过来把主体搞崩。
 */
function installFractionGuards() {
  const global = typeof window === 'undefined' ? null : window;
  if (!global) {
    return;
  }

  FRAC_GUARDED_FN_NAMES.forEach((name) => {
    if (FRAC_GUARDED_FNS.has(name)) {
      return;
    }
    const fn = global[name];
    if (typeof fn !== 'function') {
      return;
    }
    global[name] = withFractionGuard(fn);
    FRAC_GUARDED_FNS.add(name);
  });

  // 减号：等分母时它是「负分母的负号」，不是二元减法。
  // 放在函数入口而不是事件层，这样即便按键事件被拦下或顺序颠倒也照样生效。
  const baseOperator = global.inputOperator;
  if (typeof baseOperator === 'function') {
    const guarded = withFractionGuard(baseOperator);
    global.inputOperator = function fractionAwareInputOperator(op) {
      if (fracStage === 1 && (op === '−' || op === '-')) {
        toggleDenominatorSign();
        return;
      }
      return guarded.call(this, op);
    };
    FRAC_GUARDED_FNS.add('inputOperator');
  }

  // ±：等分母时它切的是分母的正负，不是给当前主屏值取负
  // （此刻主屏还是分子，取负后马上会被随后输入的数字整个替换掉，负号必丢）。
  const basePlusMinus = global.inputPlusMinus;
  if (typeof basePlusMinus === 'function') {
    const guarded = withFractionGuard(basePlusMinus);
    global.inputPlusMinus = function fractionAwareInputPlusMinus() {
      if (fracStage === 1) {
        toggleDenominatorSign();
        return;
      }
      return guarded.apply(this, arguments);
    };
    FRAC_GUARDED_FNS.add('inputPlusMinus');
  }
}

installFractionGuards();

// =========================================================
// 新增：主题皮肤切换（深空 / 浅色 / 薄荷 / 暖阳）
//
// 入口两个，作用都是「轮播到下一套皮肤」：
//   · 键盘区「皮肤」按钮；
//   · 物理键盘 T 键（Shift+T 同样有效）。
// 选择写进 localStorage，下次打开还是同一套；读不出或写不进
// （无痕模式、禁用存储）就退回默认皮肤，绝不影响计算结果。
//
// 配色本身全部写在 css/style.css 的 [data-theme="…"] 里，
// 这里只负责给 <html> 挂 data-theme ＋ 记忆选择，因此：
//   · 不动显示区 DOM 结构、不改既有函数签名（CT1）；
//   · 不装包、不引 CDN、不加构建工具（CT0）；
//   · 纯追加，未改动上方任何既有代码。
// =========================================================

/** 可选皮肤；id 对应 css/style.css 里的 [data-theme="id"]。 */
const THEMES = [
  { id: 'dark', name: '深空' },
  { id: 'light', name: '浅色' },
  { id: 'mint', name: '薄荷' },
  { id: 'amber', name: '暖阳' },
];

const THEME_STORAGE_KEY = 'calculator-theme';
const THEME_ROOT = document.documentElement;
const THEME_DEFAULT = THEMES[0];

/**
 * 按 id 取皮肤；id 不在清单里（存的是旧皮肤名、被人手改过）返回 null。
 * @param {string|null} id 皮肤 id
 * @returns {{id: string, name: string}|null} 命中的皮肤，或未命中
 */
function themeFind(id) {
  return THEMES.find((theme) => theme.id === id) || null;
}

/** 读出上次用的皮肤；读不到返回 null。 */
function themeRestore() {
  try {
    return themeFind(localStorage.getItem(THEME_STORAGE_KEY));
  } catch (err) {
    // localStorage 不可用（无痕模式 / 禁用存储）：退回默认皮肤
    return null;
  }
}

/** 记住当前皮肤；写不进去也不影响本次会话继续切换。 */
function themeRemember(id) {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, id);
  } catch (err) {
    // 存不下就算了，皮肤切换本身照样生效
  }
}

let themeCurrent = THEME_DEFAULT;

/**
 * 应用一套皮肤。
 * @param {{id: string, name: string}} theme 目标皮肤
 * @param {boolean} announce 是否在副屏提示；启动时为 false，保证「副屏初始为空」
 */
function themeApply(theme, announce) {
  themeCurrent = theme;
  THEME_ROOT.setAttribute('data-theme', theme.id);
  themeRemember(theme.id);
  if (announce) {
    showSub(`皮肤：${theme.name}（按 T 继续切换）`);
  }
}

/** 轮播到下一套皮肤。 */
function themeNext() {
  const index = THEMES.indexOf(themeCurrent);
  themeApply(THEMES[(index + 1) % THEMES.length], true);
}

// 皮肤键：追加在等号之前（同 nPr / nCr 的做法，不动 LAYOUT / KEY_CLASS）
const themeButton = document.createElement('button');
themeButton.type = 'button';
themeButton.className = 'key key--theme';
themeButton.textContent = '皮肤';
themeButton.title = '主题皮肤切换（快捷键 T）';
themeButton.addEventListener('click', themeNext);
keyboard.insertBefore(themeButton, keyboard.lastElementChild);

// 物理键盘 T 键：与上方已有的 keydown 监听并存，只接这一个键；
// 带 Ctrl / Cmd / Alt 的组合（浏览器自身快捷键）与长按重复一律放行
document.addEventListener('keydown', (event) => {
  if (event.ctrlKey || event.metaKey || event.altKey || event.repeat) {
    return;
  }
  if (event.key === 't' || event.key === 'T') {
    themeNext();
    event.preventDefault();
  }
});

// 启动：恢复上次的选择；没有记录就用默认皮肤，且不在副屏留字
themeApply(themeRestore() || THEME_DEFAULT, false);

/** MS：用当前数值覆盖内存，保留正在输入的算式。 */
function inputMemoryStore() {
  if (isError()) {
    return;
  }
  const value = readDisplayValue();
  if (!Number.isFinite(value)) {
    return;
  }
  memory = value;
  waiting = true;
  updateMemoryIndicator();
}

const memoryStoreButton = document.createElement('button');
memoryStoreButton.type = 'button';
memoryStoreButton.className = 'key key--mem';
memoryStoreButton.textContent = 'MS';
memoryStoreButton.title = '内存存储：用当前数值覆盖内存';
memoryStoreButton.addEventListener('click', inputMemoryStore);

// 五个内存键共用一行，保留数字键盘的原有行列位置。
const memoryButtons = Array.from(keyboard.querySelectorAll('.key--mem'));
if (memoryButtons.length >= 2) {
  const memoryRow = document.createElement('div');
  memoryRow.className = 'keyboard__memory';
  memoryRow.setAttribute('role', 'group');
  memoryRow.setAttribute('aria-label', '内存键');
  keyboard.insertBefore(memoryRow, memoryButtons[0]);
  memoryButtons.forEach((button) => memoryRow.appendChild(button));
  memoryRow.insertBefore(memoryStoreButton, memoryButtons[1]);
}


// =========================================
// 新增：汇率换算（关联提案：增加计算器汇率运算功能）
//
// 做什么：内置一张固定汇率表（以人民币 CNY 为基准），把主屏当前数值
// 在「人民币 ⇄ 外币」之间来回换算，换算结果写回主屏、副屏留一行算式。
//
// 怎么用（全按键交互，不弹窗）：
//   1. 输入金额（如 100），或者用已有算式算出金额；
//   2. 按「汇率」键在币种清单里轮播选一个，副屏显示「CNY → USD  1 CNY = 0.14 USD」；
//   3. 按「⇄」在两个方向间切换：
//        人民币 → 外币：主屏金额 × 汇率
//        外币 → 人民币：主屏金额 ÷ 汇率
//      两个方向各自记住自己的结果，可反复互切。
//
// 设计约束（对齐本仓 CT0 / CT1）：
//   · 只写原生 JS，不装包、不引 CDN、不加构建工具、逻辑不拆出 js/main.js（CT0）；
//   · 只新增代码：不动显示区 DOM 结构、不改任何既有函数签名、不删既有代码（CT1）；
//   · 汇率是内置常量表，不联网抓取，离线也能用、结果可复现。
// 本段为纯叠加新增，未改动上方任何既有代码。
// =========================================

// ---------------------------------------------------------------
// 内置汇率表：以 1 人民币（CNY）兑换多少外币为单位。
// 只需维护「1 CNY = ? 外币」这一个方向，反向换算在代码里取倒数，
// 避免正反两份数字对不上。数字为示例静态值，不联网、不随行情变化。
// ---------------------------------------------------------------
const CURRENCY_RATES = [
  { code: 'CNY', name: '人民币', symbol: '¥', rate: 1 },
  { code: 'USD', name: '美元', symbol: '$', rate: 0.14 },
  { code: 'EUR', name: '欧元', symbol: '€', rate: 0.13 },
  { code: 'JPY', name: '日元', symbol: '¥', rate: 21.5 },
  { code: 'GBP', name: '英镑', symbol: '£', rate: 0.11 },
  { code: 'HKD', name: '港币', symbol: 'HK$', rate: 1.09 },
  { code: 'KRW', name: '韩元', symbol: '₩', rate: 190 },
  { code: 'AUD', name: '澳元', symbol: 'A$', rate: 0.21 },
];

/**
 * 「汇率」键轮播可选的外币清单：从人民币以外的币种里取。
 * 换算方向始终是「人民币 ⇄ 某一个外币」，所以人民币本身不参与轮播。
 */
const CURRENCY_FOREIGN = CURRENCY_RATES.filter((item) => item.code !== 'CNY');

/** 当前选中的外币；默认美元。 */
let currencyCurrent = CURRENCY_FOREIGN[0];

/**
 * 当前换算方向：true = 人民币 → 外币，false = 外币 → 人民币。
 * 默认正向，按键上的「CNY→USD / USD→CNY」会跟着方向翻转。
 */
let currencyForward = true;

/**
 * 两个方向各自记住最近一次换算的结果（主屏文本）。
 * 记两份是为了让 ⇄ 能来回互切：正向的结果切过去是反向的输入，反之亦然。
 * 值停在原始金额文本上，算完即存，与既有「一元运算键」的一次性语义一致。
 */
const currencyMemo = { forward: null, backward: null };

/**
 * 按代码取币种；取不到返回 null（清单被人手改坏时的保险）。
 * @param {string} code 币种代码，如 'USD'
 * @returns {{code: string, name: string, symbol: string, rate: number}|null}
 */
function currencyFind(code) {
  return CURRENCY_RATES.find((item) => item.code === code) || null;
}

/**
 * 副屏提示文案：把当前币种与方向写成一行「CNY → USD  1 CNY = 0.14 USD」。
 * @returns {string}
 */
function currencyHint() {
  const from = currencyForward ? currencyFind('CNY') : currencyCurrent;
  const to = currencyForward ? currencyCurrent : currencyFind('CNY');
  return `${from.code} → ${to.code}  1 CNY = ${formatResult(currencyCurrent.rate)} ${currencyCurrent.code}`;
}

/**
 * 一次换算：人民币 → 外币用乘法，外币 → 人民币用除法。
 * @param {number} value 主屏当前金额
 * @param {boolean} forward true = 人民币 → 外币
 * @returns {number} 换算后的数值（交由 formatResult 统一收敛显示）
 */
function currencyConvert(value, forward) {
  return forward ? value * currencyCurrent.rate : value / currencyCurrent.rate;
}

/**
 * 副屏完整算式：如「100 CNY = 14 USD  (1 CNY = 0.14 USD)」。
 * @param {number} value 换算前的金额
 * @param {number} converted 换算后的金额
 * @returns {string}
 */
function currencyLine(value, converted) {
  const from = currencyForward ? 'CNY' : currencyCurrent.code;
  const to = currencyForward ? currencyCurrent.code : 'CNY';
  return `${formatResult(value)} ${from} = ${formatResult(converted)} ${to}  (1 CNY = ${formatResult(currencyCurrent.rate)} ${currencyCurrent.code})`;
}

/**
 * 「汇率」键：在可选外币之间轮播切换。
 * 纯状态切换：只改选中币种与副屏提示，不动主屏数值、不改变计算状态机，
 * 因此可以随时按、按多少次都不会破坏正在输入的算式。
 */
function inputCurrencyCycle() {
  const index = CURRENCY_FOREIGN.indexOf(currencyCurrent);
  currencyCurrent = CURRENCY_FOREIGN[(index + 1) % CURRENCY_FOREIGN.length];
  // 换了币种，上一组方向记忆就过期了，清掉免得 ⇄ 切出别的币种的结果
  currencyMemo.forward = null;
  currencyMemo.backward = null;
  showSub(currencyHint());
  refreshCurrencyButton();
}

/**
 * ⇄ 键：按「当前方向」换算主屏数值，然后把方向翻到另一边。
 *
 * 语义等价于一个双向换算器：按键上写的方向（如 CNY→USD）就是这一下要执行的换算；
 * 换完方向自动翻面（键面随之变成 USD→CNY），下次按下就换回来。
 * 于是「输入 100 → 按一下得 14 → 再按一下得 100」就是最自然的来回切换。
 */
function inputCurrencySwap() {
  if (isError()) {
    return; // 错误态：先按数字/C 恢复，不做换算
  }

  // 主屏当前必须是一个可读的数字（分数显示会先被还原成小数）
  const value = readDisplayValue();
  if (value === null) {
    showSub('当前不是可换算的数值');
    return;
  }

  // 先按「当前方向」算一次（键面怎么写就怎么算）
  const converted = currencyConvert(value, currencyForward);

  if (!Number.isFinite(converted)) {
    text = ERROR_TEXT;
    clearState();
    currencyMemo.forward = null;
    currencyMemo.backward = null;
    showSub('汇率换算结果无效');
    show();
    return;
  }

  // 记下这次换算的两端，供历史回填与再次切换时对齐
  currencyMemo[currencyForward ? 'forward' : 'backward'] = formatResult(converted);
  currencyMemo[currencyForward ? 'backward' : 'forward'] = formatResult(value);

  const shown = formatResult(converted);
  canRepeat = false; // 一元换算改变了当前数，连算资格作废
  text = shown;
  waiting = true; // 换算结果是一个完整结果，可被后续运算符继续使用
  recordHistory(currencyLine(value, converted), shown);
  showSub(currencyLine(value, converted));
  show();

  // 换完立刻翻面：键面与下次按下的方向都跟着变
  currencyForward = !currencyForward;
  refreshCurrencyButton();
}

// ---------------------------------------------------------------
// 按键：沿用既有 .key .key--sci 样式，追加到键盘网格末尾（等号之前），
// 与 BIN/OCT/HEX、nPr/nCr、皮肤、MS 等既有新增键同一做法：
// 不动 LAYOUT / KEY_CLASS / 既有按键分发逻辑（CT1：显示区之外可加按钮）。
// ---------------------------------------------------------------
const currencyCycleButton = document.createElement('button');
currencyCycleButton.type = 'button';
currencyCycleButton.className = 'key key--sci key--currency';
currencyCycleButton.textContent = '汇率';
currencyCycleButton.title = '切换换算币种（人民币 ⇄ 外币）';
currencyCycleButton.addEventListener('click', inputCurrencyCycle);

const currencySwapButton = document.createElement('button');
currencySwapButton.type = 'button';
currencySwapButton.className = 'key key--sci key--currency';
currencySwapButton.textContent = 'CNY→USD';
currencySwapButton.title = '切换换算方向并换算当前数值';
currencySwapButton.addEventListener('click', inputCurrencySwap);

/** 按键文字跟随当前币种与方向：正向写「CNY→外币」，反向写「外币→CNY」。 */
function refreshCurrencyButton() {
  currencySwapButton.textContent = currencyForward ? 'CNY→' + currencyCurrent.code : currencyCurrent.code + '→CNY';
}

keyboard.insertBefore(currencyCycleButton, keyboard.lastElementChild);
keyboard.insertBefore(currencySwapButton, keyboard.lastElementChild);

// 新按键的补充样式：.key--currency 只微调字号，配色沿用 key--sci。
// 用注入 <style> 的方式，避免改动 css/style.css（本 PR 只改 js/main.js）。
const currencyStyle = document.createElement('style');
currencyStyle.textContent = [
  '.key--currency {',
  '  font-size: 13px;',
  '  white-space: nowrap;',
  '}',
].join('\n');
document.head.appendChild(currencyStyle);

refreshCurrencyButton();
showSub('');

// =========================================
// 新增：科学计数法显示（自动 / 强制 两种模式，SCI 键切换）—— 纯叠加，既有逻辑零改动
// -----------------------------------------------------------------
// 思路：前面的函数都只通过 formatResult() 取显示文本，所以在这里把 formatResult
//       包一层：数值超出常规范围（|n| ≥ 1e21 或 |n| < 1e-6）时改写成科学计数法
//       形式（如 3.33333333333e-7），否则原样返回，保持既有观感不变。
// 兼容：不改任何既有函数签名、不动显示区 DOM；SCI 键插入在等号之前，同皮肤键做法。
// 依赖：formatResult / show / showSub / isError / text / keyboard
// =========================================

/** 科学计数法显示的阈值：达到或超过这个量级就用科学计数法 */
const SCI_BIG = 1e21;
/** 科学计数法显示的下限：绝对值非零且小于它就用科学计数法 */
const SCI_SMALL = 1e-6;
/** 科学计数法保留的有效数字位数：与既有 formatResult 的 12 位口径保持一致 */
const SCI_SIGNIFICANT = 12;

/** 当前是否为「强制科学计数法」；false 表示自动模式（默认） */
let sciForce = false;

/**
 * 把一个数改写成科学计数法字符串。
 * 先按既有 formatResult 的口径收到 12 位有效数字（保持一致，不引入新的精度标准），
 * 再转成 e 形式；这样既不会像写死位数那样把 9.99999999998e+23 截断进位成 1e+24，
 * 也不会甩出 3.3333333333333335e-7 这种过长的尾数。
 * @param {number} n 目标数值（调用方保证有限）
 * @returns {string} 如 1.23456789e+21、3.33333333333e-7
 */
function toScientific(n) {
  return Number(n.toPrecision(SCI_SIGNIFICANT)).toExponential();
}

/**
 * 判断一个数值是否应当以科学计数法显示。
 * 0 永远走普通写法；错误态由上游 formatResult 处理，这里只管有限数。
 * @param {number} n 待判断的数值
 * @returns {boolean}
 */
function needScientific(n) {
  if (!Number.isFinite(n) || n === 0) {
    return false;
  }
  if (sciForce) {
    return true;
  }
  const abs = Math.abs(n);
  return abs >= SCI_BIG || abs < SCI_SMALL;
}

// 包一层 formatResult：保留原实现，只在需要科学计数法时改写返回值。
// 用 const 记录原函数，既有调用点（OPERATORS、applyPending、各一元运算…）
// 全部自动走到这里，无需逐个改。
const formatResultPlain = formatResult;
formatResult = function formatResultSci(n) {
  if (needScientific(n)) {
    return toScientific(n);
  }
  return formatResultPlain(n);
};

/** SCI 键：在「自动」与「强制」之间切换，并在副屏提示当前模式。 */
function inputScienceToggle() {
  sciForce = !sciForce;
  const mode = sciForce ? '强制' : '自动';
  // 错误态只提示模式，不改动主屏，避免把「错误」洗成别的字
  if (isError()) {
    showSub(`科学计数法：${mode}`);
    return;
  }
  // 主屏是普通数字时，按新模式重画一次，切换立刻可见
  const value = Number(text);
  if (Number.isFinite(value)) {
    text = formatResult(value);
    show();
  }
  showSub(`科学计数法：${mode}`);
}

// SCI 键：追加在等号之前（同皮肤键、nPr / nCr 的做法，不动 LAYOUT / KEY_CLASS）
const sciButton = document.createElement('button');
sciButton.type = 'button';
sciButton.className = 'key key--sci-toggle';
sciButton.textContent = 'SCI';
sciButton.title = '科学计数法显示：自动 / 强制';
sciButton.addEventListener('click', inputScienceToggle);
keyboard.insertBefore(sciButton, keyboard.lastElementChild);
