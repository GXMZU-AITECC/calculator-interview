/**
 * 格式化工具（Formatter）：把计算结果整理成适合显示的文本。
 * 对应 Python 桌面版 formatter.py。
 *
 * 待实现：见仓库 Issue 任务池。
 */
const formatter = {
  /**
   * 将计算结果格式化为显示文本（对应 Python 版 format_result）。
   *
   * TODO(feat): 浮点结果去掉多余的 0（如 6.0 显示为 6）。
   *
   * @param {number} result 计算结果
   * @returns {string} 用于显示的字符串
   */
  formatResult(result) {
  let numStr = String(result);
  const parts = numStr.split('.');
  let intPart = parts[0];
  const decPart = parts[1];

  let negative = false;
  if(intPart.startsWith('-')){
    negative = true;
    intPart = intPart.slice(1);
  }
  intPart = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  let output = negative ? '-' + intPart : intPart;
  if(decPart !== undefined){
    output += '.' + decPart;
  }
  return output;
},

};
