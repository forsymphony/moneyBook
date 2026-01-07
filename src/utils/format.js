/**
 * 数据格式化工具函数
 */

/**
 * 格式化金额显示（保留两位小数）
 */
export function formatAmount(amount) {
  if (amount === null || amount === undefined) return '0.00';
  return parseFloat(amount).toFixed(2);
}

/**
 * 格式化金额显示（带千分位）
 */
export function formatAmountWithComma(amount) {
  if (amount === null || amount === undefined) return '0.00';
  return parseFloat(amount).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/**
 * 格式化金额显示（简化版，大于1000显示K）
 */
export function formatAmountSimple(amount) {
  if (amount === null || amount === undefined) return '0';
  const num = parseFloat(amount);
  if (num >= 10000) {
    return (num / 10000).toFixed(1) + '万';
  } else if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K';
  }
  return num.toFixed(0);
}

/**
 * 获取金额颜色（收入绿色，支出红色）
 */
export function getAmountColor(type) {
  return type === 'income' ? '#27ae60' : '#e74c3c';
}

/**
 * 获取金额符号（收入+，支出-）
 */
export function getAmountSign(type) {
  return type === 'income' ? '+' : '-';
}

