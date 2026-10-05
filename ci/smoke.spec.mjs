import { test, expect } from '@playwright/test';

function key(page, label) {
  return page.getByRole('button', { name: label, exact: true });
}

async function clickKey(page, label) {
  await key(page, label).click();
}

/** 收集运行期 pageerror / console.error，避免「能算出数但中途抛了 ReferenceError」漏网 */
async function withPageErrors(page, run) {
  const errors = [];
  const onPage = (e) => errors.push(e.message);
  const onConsole = (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  };
  page.on('pageerror', onPage);
  page.on('console', onConsole);
  try {
    await run();
  } finally {
    page.off('pageerror', onPage);
    page.off('console', onConsole);
  }
  expect(errors, `运行期不应有错误：${errors.join(' | ')}`).toEqual([]);
}

// 所有用例默认收集运行期错误：按键分发靠点击+断言，写法（if/switch/映射）不限
test.beforeEach(async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.__ciRuntimeErrors = errors;
});

test.afterEach(async ({ page }) => {
  const errors = page.__ciRuntimeErrors || [];
  expect(errors, `运行期不应有错误：${errors.join(' | ')}`).toEqual([]);
});

test.describe('前端骨架与样式', () => {
  test('加载无控制台报错；标题与核心区挂载', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    await page.goto('/');
    await expect(page).toHaveTitle('简易计算器');
    await expect(page.locator('main.calculator')).toBeVisible();
    await expect(page.locator('#display-main')).toBeVisible();
    await expect(page.locator('#keyboard')).toBeVisible();
    await expect(page.locator('#history-panel')).toBeVisible();
    expect(errors, `控制台不应有错误：${errors.join(' | ')}`).toEqual([]);
  });

  test('CSS 已生效：主显示区有背景色与右对齐数字', async ({ page }) => {
    await page.goto('/');
    const style = await page.locator('#display-main').evaluate((el) => {
      const s = getComputedStyle(el);
      return { bg: s.backgroundColor, align: s.textAlign, color: s.color };
    });
    expect(style.bg).not.toBe('rgba(0, 0, 0, 0)');
    expect(style.bg).not.toBe('transparent');
    expect(style.align).toBe('right');
    expect(style.color).not.toBe('');
  });

  test('主显示初始为 0，副显示为空', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#display-main')).toHaveText('0');
    await expect(page.locator('#display-sub')).toHaveText('');
  });

  test('0–9 与全部功能键都渲染', async ({ page }) => {
    await page.goto('/');
    for (const d of ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9']) {
      await expect(key(page, d)).toHaveCount(1);
    }
    for (const label of [
      '+', '−', '×', '÷', '=', '.', 'C', 'CE', '⌫', '√', 'x²', '1/x', '复制',
      'MC', 'MR', 'M+', 'M−',
      'π', '%', '±', '(', ')', 'sin', 'cos', 'tan', 'DEG', 'xʸ',
    ]) {
      await expect(key(page, label)).toHaveCount(1);
    }
  });

  test('历史列表节点挂在 DOM 上', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#history-list')).toBeAttached();
  });
});

test.describe('四则运算', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('加法：1 + 2 = 得到 3（且无运行期报错）', async ({ page }) => {
    await withPageErrors(page, async () => {
      await clickKey(page, '1');
      await clickKey(page, '+');
      await clickKey(page, '2');
      await clickKey(page, '=');
      await expect(page.locator('#display-main')).toHaveText('3');
    });
  });

  test('减法：9 − 4 = 得到 5', async ({ page }) => {
    await clickKey(page, '9');
    await clickKey(page, '−');
    await clickKey(page, '4');
    await clickKey(page, '=');
    await expect(page.locator('#display-main')).toHaveText('5');
  });

  test('乘法：3 × 4 = 得到 12', async ({ page }) => {
    await clickKey(page, '3');
    await clickKey(page, '×');
    await clickKey(page, '4');
    await clickKey(page, '=');
    await expect(page.locator('#display-main')).toHaveText('12');
  });

  test('除法：8 ÷ 2 = 得到 4', async ({ page }) => {
    await clickKey(page, '8');
    await clickKey(page, '÷');
    await clickKey(page, '2');
    await clickKey(page, '=');
    await expect(page.locator('#display-main')).toHaveText('4');
  });

  test('多位数：12 + 34 = 得到 46', async ({ page }) => {
    await clickKey(page, '1');
    await clickKey(page, '2');
    await clickKey(page, '+');
    await clickKey(page, '3');
    await clickKey(page, '4');
    await clickKey(page, '=');
    await expect(page.locator('#display-main')).toHaveText('46');
  });

  test('连续运算：1 + 2 + 3 = 得到 6', async ({ page }) => {
    await clickKey(page, '1');
    await clickKey(page, '+');
    await clickKey(page, '2');
    await clickKey(page, '+');
    await clickKey(page, '3');
    await clickKey(page, '=');
    await expect(page.locator('#display-main')).toHaveText('6');
  });

  test('连乘：2 × 3 × 4 = 得到 24', async ({ page }) => {
    await clickKey(page, '2');
    await clickKey(page, '×');
    await clickKey(page, '3');
    await clickKey(page, '×');
    await clickKey(page, '4');
    await clickKey(page, '=');
    await expect(page.locator('#display-main')).toHaveText('24');
  });

  test('运算符改符：5 + 改 × 2 = 得到 10', async ({ page }) => {
    await clickKey(page, '5');
    await clickKey(page, '+');
    await clickKey(page, '×');
    await expect(page.locator('#display-sub')).toContainText('×');
    await clickKey(page, '2');
    await clickKey(page, '=');
    await expect(page.locator('#display-main')).toHaveText('10');
  });

  test('等号后继续算：1 + 2 = 再 + 3 = 得到 6', async ({ page }) => {
    await clickKey(page, '1');
    await clickKey(page, '+');
    await clickKey(page, '2');
    await clickKey(page, '=');
    await expect(page.locator('#display-main')).toHaveText('3');
    await clickKey(page, '+');
    await clickKey(page, '3');
    await clickKey(page, '=');
    await expect(page.locator('#display-main')).toHaveText('6');
  });

  test('连按 =：1 + 2 = = 得到 5（重复上次运算）', async ({ page }) => {
    await withPageErrors(page, async () => {
      await clickKey(page, '1');
      await clickKey(page, '+');
      await clickKey(page, '2');
      await clickKey(page, '=');
      await expect(page.locator('#display-main')).toHaveText('3');
      await clickKey(page, '=');
      await expect(page.locator('#display-main')).toHaveText('5');
    });
  });

  test('按运算符后副显示出现算式提示', async ({ page }) => {
    await clickKey(page, '5');
    await clickKey(page, '+');
    await expect(page.locator('#display-sub')).toContainText('+');
    await expect(page.locator('#display-sub')).toContainText('5');
  });
});

test.describe('小数与开方', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('小数点：0.5 + 0.5 = 得到 1', async ({ page }) => {
    await clickKey(page, '.');
    await clickKey(page, '5');
    await clickKey(page, '+');
    await clickKey(page, '.');
    await clickKey(page, '5');
    await clickKey(page, '=');
    await expect(page.locator('#display-main')).toHaveText('1');
  });

  test('重复小数点不额外插入：1 . . 2 显示 1.2', async ({ page }) => {
    await clickKey(page, '1');
    await clickKey(page, '.');
    await clickKey(page, '.');
    await clickKey(page, '2');
    await expect(page.locator('#display-main')).toHaveText('1.2');
  });

  test('开方：√9 得到 3', async ({ page }) => {
    await clickKey(page, '9');
    await clickKey(page, '√');
    await expect(page.locator('#display-main')).toHaveText('3');
  });

  test('开方：√16 得到 4', async ({ page }) => {
    await clickKey(page, '1');
    await clickKey(page, '6');
    await clickKey(page, '√');
    await expect(page.locator('#display-main')).toHaveText('4');
  });
});

test.describe('清除与退格', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('⌫：输入 12 后退一格变成 1', async ({ page }) => {
    await clickKey(page, '1');
    await clickKey(page, '2');
    await clickKey(page, '⌫');
    await expect(page.locator('#display-main')).toHaveText('1');
  });

  test('⌫：删到空时回到 0', async ({ page }) => {
    await clickKey(page, '7');
    await clickKey(page, '⌫');
    await expect(page.locator('#display-main')).toHaveText('0');
  });

  test('CE：只清当前输入，保留待运算', async ({ page }) => {
    await clickKey(page, '8');
    await clickKey(page, '+');
    await clickKey(page, '3');
    await clickKey(page, 'CE');
    await expect(page.locator('#display-main')).toHaveText('0');
    await expect(page.locator('#display-sub')).toContainText('+');
    await clickKey(page, '5');
    await clickKey(page, '=');
    await expect(page.locator('#display-main')).toHaveText('13');
  });

  test('C：清空主显示、副显示与运算状态', async ({ page }) => {
    await clickKey(page, '7');
    await clickKey(page, '+');
    await clickKey(page, '1');
    await clickKey(page, 'C');
    await expect(page.locator('#display-main')).toHaveText('0');
    await expect(page.locator('#display-sub')).toHaveText('');
  });
});

test.describe('错误态', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('除零：1 ÷ 0 = 显示「错误」', async ({ page }) => {
    await clickKey(page, '1');
    await clickKey(page, '÷');
    await clickKey(page, '0');
    await clickKey(page, '=');
    await expect(page.locator('#display-main')).toHaveText('错误');
  });

  test('负开方：对 -1 开方显示「错误」', async ({ page }) => {
    await clickKey(page, '0');
    await clickKey(page, '−');
    await clickKey(page, '1');
    await clickKey(page, '=');
    await expect(page.locator('#display-main')).toHaveText('-1');
    await clickKey(page, '√');
    await expect(page.locator('#display-main')).toHaveText('错误');
  });

  test('错误后按数字可重新开始输入', async ({ page }) => {
    await clickKey(page, '1');
    await clickKey(page, '÷');
    await clickKey(page, '0');
    await clickKey(page, '=');
    await expect(page.locator('#display-main')).toHaveText('错误');
    await clickKey(page, '5');
    await expect(page.locator('#display-main')).toHaveText('5');
  });
});

test.describe('平方 / 倒数 / 内存键', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('平方：5 → x² 得到 25', async ({ page }) => {
    await withPageErrors(page, async () => {
      await clickKey(page, '5');
      await clickKey(page, 'x²');
      await expect(page.locator('#display-main')).toHaveText('25');
    });
  });

  test('倒数：4 → 1/x 得到 0.25', async ({ page }) => {
    await withPageErrors(page, async () => {
      await clickKey(page, '4');
      await clickKey(page, '1/x');
      await expect(page.locator('#display-main')).toHaveText('0.25');
    });
  });

  test('内存：M+ / MR / M− / MC', async ({ page }) => {
    await withPageErrors(page, async () => {
      await clickKey(page, '1');
      await clickKey(page, '0');
      await clickKey(page, 'M+');
      await clickKey(page, 'C');
      await clickKey(page, 'MR');
      await expect(page.locator('#display-main')).toHaveText('10');
      await clickKey(page, '3');
      await clickKey(page, 'M−');
      await clickKey(page, 'C');
      await clickKey(page, 'MR');
      await expect(page.locator('#display-main')).toHaveText('7');
      await clickKey(page, 'MC');
      await clickKey(page, 'C');
      await clickKey(page, 'MR');
      await expect(page.locator('#display-main')).toHaveText('0');
    });
  });
});

test.describe('历史与复制', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('等号后历史列表新增一条', async ({ page }) => {
    await clickKey(page, '2');
    await clickKey(page, '+');
    await clickKey(page, '3');
    await clickKey(page, '=');
    await expect(page.locator('#history-list li.history-item')).toHaveCount(1);
    await expect(page.locator('#history-list li.history-item').first()).toContainText('=');
    await expect(page.locator('#history-list li.history-item').first()).toContainText('5');
  });

  test('连续两次等号累计两条历史', async ({ page }) => {
    await clickKey(page, '1');
    await clickKey(page, '+');
    await clickKey(page, '1');
    await clickKey(page, '=');
    await clickKey(page, '2');
    await clickKey(page, '+');
    await clickKey(page, '2');
    await clickKey(page, '=');
    await expect(page.locator('#history-list li.history-item')).toHaveCount(2);
  });

  test('历史回填：点击条目把结果填回主屏', async ({ page }) => {
    await withPageErrors(page, async () => {
      await clickKey(page, '2');
      await clickKey(page, '+');
      await clickKey(page, '3');
      await clickKey(page, '=');
      await expect(page.locator('#display-main')).toHaveText('5');
      await clickKey(page, 'C');
      await expect(page.locator('#display-main')).toHaveText('0');
      await page.locator('#history-list li.history-item').first().click();
      await expect(page.locator('#display-main')).toHaveText('5');
    });
  });

  test('历史清空：清空后无历史条目', async ({ page }) => {
    await withPageErrors(page, async () => {
      await clickKey(page, '1');
      await clickKey(page, '+');
      await clickKey(page, '1');
      await clickKey(page, '=');
      await expect(page.locator('#history-list li.history-item')).toHaveCount(1);
      await page.getByRole('button', { name: '清空', exact: true }).click();
      await expect(page.locator('#history-list li.history-item')).toHaveCount(0);
      await expect(page.locator('#history-list li.history-empty')).toHaveCount(1);
    });
  });

  test('复制：点击后副显示提示已复制，剪贴板为当前值', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await clickKey(page, '4');
    await clickKey(page, '2');
    await clickKey(page, '复制');
    await expect(page.locator('#display-sub')).toHaveText('已复制');
    const text = await page.evaluate(() => navigator.clipboard.readText());
    expect(text).toBe('42');
  });
});

test.describe('已合基线：π / % / ± / 括号 / 三角 / xʸ', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('π：点 π 显示圆周率近似；π + 1 = ', async ({ page }) => {
    await withPageErrors(page, async () => {
      await clickKey(page, 'π');
      const piText = String(Number(Math.PI.toPrecision(12)));
      await expect(page.locator('#display-main')).toHaveText(piText);
      await clickKey(page, '+');
      await clickKey(page, '1');
      await clickKey(page, '=');
      await expect(page.locator('#display-main')).toHaveText(
        String(Number((Math.PI + 1).toPrecision(12))),
      );
    });
  });

  test('%：200 + 10 % = 得到 220（加减按左操作数百分比）', async ({ page }) => {
    await withPageErrors(page, async () => {
      await clickKey(page, '2');
      await clickKey(page, '0');
      await clickKey(page, '0');
      await clickKey(page, '+');
      await clickKey(page, '1');
      await clickKey(page, '0');
      await clickKey(page, '%');
      await expect(page.locator('#display-main')).toHaveText('20');
      await clickKey(page, '=');
      await expect(page.locator('#display-main')).toHaveText('220');
    });
  });

  test('%：单独 50 % 得到 0.5', async ({ page }) => {
    await clickKey(page, '5');
    await clickKey(page, '0');
    await clickKey(page, '%');
    await expect(page.locator('#display-main')).toHaveText('0.5');
  });

  test('±：5 → ± → -5 → ± → 5；0 保持 0', async ({ page }) => {
    await withPageErrors(page, async () => {
      await clickKey(page, '5');
      await clickKey(page, '±');
      await expect(page.locator('#display-main')).toHaveText('-5');
      await clickKey(page, '±');
      await expect(page.locator('#display-main')).toHaveText('5');
      await clickKey(page, 'C');
      await clickKey(page, '±');
      await expect(page.locator('#display-main')).toHaveText('0');
    });
  });

  test('括号：( 1 + 2 ) × 3 = 得到 9', async ({ page }) => {
    await withPageErrors(page, async () => {
      await clickKey(page, '(');
      await clickKey(page, '1');
      await clickKey(page, '+');
      await clickKey(page, '2');
      await clickKey(page, ')');
      await clickKey(page, '×');
      await clickKey(page, '3');
      await clickKey(page, '=');
      await expect(page.locator('#display-main')).toHaveText('9');
    });
  });

  test('括号：1 + ( 2 × 3 ) = 得到 7', async ({ page }) => {
    await withPageErrors(page, async () => {
      await clickKey(page, '1');
      await clickKey(page, '+');
      await clickKey(page, '(');
      await clickKey(page, '2');
      await clickKey(page, '×');
      await clickKey(page, '3');
      await clickKey(page, ')');
      await clickKey(page, '=');
      await expect(page.locator('#display-main')).toHaveText('7');
    });
  });

  test('三角函数 DEG：sin 90 → 1；cos 0 → 1', async ({ page }) => {
    await withPageErrors(page, async () => {
      await clickKey(page, '9');
      await clickKey(page, '0');
      await clickKey(page, 'sin');
      await expect(page.locator('#display-main')).toHaveText('1');
      await clickKey(page, 'C');
      await clickKey(page, '0');
      await clickKey(page, 'cos');
      await expect(page.locator('#display-main')).toHaveText('1');
    });
  });

  test('角度模式：切 RAD 后 sin 90 不再是 1', async ({ page }) => {
    await withPageErrors(page, async () => {
      await clickKey(page, 'DEG'); // 默认 DEG → 切到 RAD，键面变 RAD
      await expect(key(page, 'RAD')).toHaveCount(1);
      await clickKey(page, '9');
      await clickKey(page, '0');
      await clickKey(page, 'sin');
      const shown = await page.locator('#display-main').innerText();
      expect(shown).not.toBe('1');
      expect(shown).not.toBe('错误');
    });
  });

  test('xʸ：2 xʸ 3 = 得到 8；9 xʸ 0.5 = 得到 3', async ({ page }) => {
    await withPageErrors(page, async () => {
      await clickKey(page, '2');
      await clickKey(page, 'xʸ');
      await clickKey(page, '3');
      await clickKey(page, '=');
      await expect(page.locator('#display-main')).toHaveText('8');
      await clickKey(page, 'C');
      await clickKey(page, '9');
      await clickKey(page, 'xʸ');
      await clickKey(page, '.');
      await clickKey(page, '5');
      await clickKey(page, '=');
      await expect(page.locator('#display-main')).toHaveText('3');
    });
  });
});

test.describe('健壮性：隐藏回归与错误恢复', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('错位 ( 被忽略：1 + 2 ( ) = 仍得 3，且无运行期报错', async ({ page }) => {
    await withPageErrors(page, async () => {
      await clickKey(page, '1');
      await clickKey(page, '+');
      await clickKey(page, '2');
      await clickKey(page, '(');
      await expect(page.locator('#display-main')).toHaveText('2');
      await clickKey(page, ')');
      await expect(page.locator('#display-main')).toHaveText('2');
      await clickKey(page, '=');
      await expect(page.locator('#display-main')).toHaveText('3');
    });
  });

  test('未闭合括号直接 = 不崩： ( 1 + 2 = 得到 3', async ({ page }) => {
    await withPageErrors(page, async () => {
      await clickKey(page, '(');
      await clickKey(page, '1');
      await clickKey(page, '+');
      await clickKey(page, '2');
      await clickKey(page, '=');
      await expect(page.locator('#display-main')).toHaveText('3');
    });
  });

  test('tan 90（DEG）→ 错误；错误后按数字可恢复', async ({ page }) => {
    await withPageErrors(page, async () => {
      await clickKey(page, '9');
      await clickKey(page, '0');
      await clickKey(page, 'tan');
      await expect(page.locator('#display-main')).toHaveText('错误');
      await clickKey(page, '7');
      await expect(page.locator('#display-main')).toHaveText('7');
    });
  });
});

test.describe('物理键盘', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('数字与 + / Enter：6+7 得到 13', async ({ page }) => {
    await page.keyboard.type('6');
    await page.keyboard.press('+');
    await page.keyboard.type('7');
    await page.keyboard.press('Enter');
    await expect(page.locator('#display-main')).toHaveText('13');
  });

  test('物理键 * /：3*4 得到 12；8/2 得到 4', async ({ page }) => {
    await page.keyboard.type('3');
    await page.keyboard.press('*');
    await page.keyboard.type('4');
    await page.keyboard.press('Enter');
    await expect(page.locator('#display-main')).toHaveText('12');
    await page.keyboard.press('Escape');
    await page.keyboard.type('8');
    await page.keyboard.press('/');
    await page.keyboard.type('2');
    await page.keyboard.press('=');
    await expect(page.locator('#display-main')).toHaveText('4');
  });

  test('物理键 -：9-4 得到 5', async ({ page }) => {
    await page.keyboard.type('9');
    await page.keyboard.press('-');
    await page.keyboard.type('4');
    await page.keyboard.press('Enter');
    await expect(page.locator('#display-main')).toHaveText('5');
  });

  test('Backspace 删一位；Escape / c 清空', async ({ page }) => {
    await page.keyboard.type('89');
    await page.keyboard.press('Backspace');
    await expect(page.locator('#display-main')).toHaveText('8');
    await page.keyboard.press('Escape');
    await expect(page.locator('#display-main')).toHaveText('0');
    await page.keyboard.type('3');
    await page.keyboard.press('+');
    await page.keyboard.press('c');
    await expect(page.locator('#display-main')).toHaveText('0');
    await expect(page.locator('#display-sub')).toHaveText('');
  });
});
