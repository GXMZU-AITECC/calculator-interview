const displayMain = document.getElementById('display-main');
const displaySub = document.getElementById('display-sub');
const keyboard = document.getElementById('keyboard');

// 新增：获取历史记录列表容器
const historyList = document.getElementById('history-list');

/**
 * 加法：把两个数相加。
 * @param {number} a 加数
 * @param {number} b 被加数
 * @returns {number} 两数之和
 */
function add(a, b) {
  return a + b;
}

// ---------------------------------------------------------------
// 计算状态
// ---------------------------------------------------------------

const INITIAL = '0'; // 初始值
const ERROR_TEXT = '错误'; // 非法运算（如除以 0）时主屏显示的内容

let text = INITIAL; // 主屏当前显示的数字串（种子已有）
let acc = null; // 左操作数：按下运算符的那一刻冻结下来
let pendingOp = null; // 待执行的运算符，null 表示没有
let waiting = false; // 刚按过运算符或等号：下一个数字要另起一个数，不是接着拼

/** 把主屏的 text 刷到显示区。 */
function show() {
  displayMain.textContent = text;
}

/** 把算式刷到副屏。 */
function showSub(line) {
  displaySub.textContent = line || '';
}

function isError() {
  return text === ERROR_TEXT;
}

/** 清掉计算状态，但不动主屏（供出错与 C 键复用）。 */
function clearState() {
  acc = null;
  pendingOp = null;
  waiting = false;
}

// ---------------------------------------------------------------
// 运算符
// ---------------------------------------------------------------

// 顺序计算，不做优先级：2 + 3 × 4 = 先算 2+3 再乘 4，得 20
const OPERATORS = {
  '+': add,
  '−': (a, b) => a - b,
  '×': (a, b) => a * b,
  '÷': (a, b) => a / b,
};

/**
 * 把计算结果转成能显示的字符串。
 * 浮点误差用 12 位有效数字收敛：0.1 + 0.2 显示 0.3，而不是 0.30000000000000004。
 * 整数原样保留，避免大整数被削掉有效位。
 * @param {number} n 计算结果
 * @returns {string} 可直接显示的字符串
 */
function formatResult(n) {
  if (!Number.isFinite(n)) {
    return ERROR_TEXT;
  }
  if (Number.isInteger(n)) {
    return String(n);
  }
  return String(Number(n.toPrecision(12)));
}

/**
 * 执行一次 pendingOp：用主屏当前的数当右操作数。
 * 成功时把结果写回 acc；结果非法（除零、溢出）则进入错误态。
 * @returns {boolean} 是否算出了合法结果
 */
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

/** 数字键：拼接到主屏；刚按过运算符/等号则另起一个数。 */
function inputDigit(digit) {
  if (isError()) {
    text = INITIAL;
  }
  if (waiting) {
    text = digit;
    waiting = false;
  } else {
    text = text === INITIAL ? digit : text + digit;
  }
  show();
}

/** 小数点键：一个数里最多一个小数点；新起一个数时从 0. 开始。 */
function inputDecimal() {
  if (isError()) {
    text = INITIAL;
  }
  if (waiting) {
    text = `${INITIAL}.`;
    waiting = false;
  } else if (!text.includes('.')) {
    text = text === INITIAL ? `${INITIAL}.` : `${text}.`;
  }
  show();
}

/** 运算符键：冻结左操作数；已有待执行的运算时先算出中间结果。 */
function inputOperator(op) {
  if (isError()) {
    return;
  }

  if (pendingOp !== null) {
    // 连按运算符：只换运算符，不重复计算（1 + × 2 = 得 2）
    if (waiting) {
      pendingOp = op;
      showSub(`${formatResult(acc)} ${op}`);
      return;
    }
    // 已经 a op b 了，再按运算符：先算中间结果，再接着算（1 + 2 + 3 = 得 6）
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

/** 等号键：算出结果并把整条算式留在副屏。 */
function inputEquals() {
  if (isError() || pendingOp === null) {
    return;
  }

  const line = `${formatResult(acc)} ${pendingOp} ${text} =`;
  
  // 保存旧值用于历史记录
  const oldText = text;

  if (!applyPending()) {
    return;
  }

  text = formatResult(acc);
  
  // 记录历史
  if (historyList) {
    const li = document.createElement('li');
    li.textContent = `${formatResult(acc)} ${pendingOp} ${oldText} = ${text}`;
    historyList.appendChild(li);
    historyList.scrollTop = historyList.scrollHeight;
  }

  clearState();
  waiting = true; // 求值后：按数字开新一轮，按运算符接着用这个结果算
  showSub(line);
  show();
}

/** 退格键：只编辑正在输入的数字，不改动待输入状态、计算结果或错误。 */
function inputBackspace() {
  if (waiting || isError()) {
    return;
  }

  text = text.slice(0, -1) || INITIAL;
  show();
}

/** CE 键：清除当前输入，保留待执行的运算。 */
function inputClearEntry() {
  text = INITIAL;
  waiting = false;

  if (pendingOp === null) {
    acc = null;
    showSub('');
  } else {
    showSub(`${formatResult(acc)} ${pendingOp}`);
  }

  show();
}

/** 平方根键：对当前显示的数开平方；负数进入错误态。 */
function inputSqrt() {
  if (isError()) {
    return;
  }

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

/** C 键：全部清零。 */
function inputClear() {
  text = INITIAL;
  clearState();
  showSub('');
  show();
}

// ---------------------------------------------------------------
// 键盘渲染：4 列网格，末行放小数点与退格键
// ---------------------------------------------------------------

// 每项：显示文字 + 按键类别（决定配色 class）
const LAYOUT = [
  ['7', 'digit'], ['8', 'digit'], ['9', 'digit'], ['C', 'clear'],
  ['4', 'digit'], ['5', 'digit'], ['6', 'digit'], ['÷', 'operator'],
  ['1', 'digit'], ['2', 'digit'], ['3', 'digit'], ['×', 'operator'],
  ['0', 'digit'], ['−', 'operator'], ['+', 'operator'], ['=', 'equals'],
  ['.', 'decimal'], ['⌫', 'backspace'], ['CE', 'clearEntry'], ['√', 'sqrt'],
];

// 类别 → 样式类（沿用 seed 里预留好的四个配色类）
const KEY_CLASS = {
  digit: 'key--normal',
  operator: 'key--action',
  clear: 'key--danger',
  equals: 'key--success',
  decimal: 'key--normal',
  backspace: 'key--action',
  clearEntry: 'key--danger',
  sqrt: 'key--action',
};

LAYOUT.forEach(([label, kind]) => {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = `key ${KEY_CLASS[kind]}`;
  button.textContent = label;
  button.addEventListener('click', () => {
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
    inputOperator('−'); // 映射到全角减号
  } else if (e.key === '*') {
    inputOperator('×'); // 映射到乘号
  } else if (e.key === '/') {
    inputOperator('÷'); // 映射到除号
  } else if (e.key === 'Enter' || e.key === '=') {
    inputEquals();
  } else if (e.key === 'Backspace') {
    inputBackspace();
  } else if (e.key === 'Escape' || e.key.toLowerCase() === 'c') {
    inputClear();
  }
});

// 初始化
show();
