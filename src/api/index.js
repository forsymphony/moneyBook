/**
 * API 封装层
 * 直接 fetch 边缘函数，返回数据
 */

const API_BASE = import.meta.env.VITE_API_BASE || '';

/**
 * 交易记录 API
 */
export const transactionAPI = {
  // 获取某月交易记录
  async getTransactions(month) {
    const response = await fetch(`${API_BASE}/api/transactions?month=${month}`);
    if (!response.ok) throw new Error('请求失败');
    return await response.json();
  },

  // 添加交易记录
  async addTransaction(data) {
    const response = await fetch(`${API_BASE}/api/transactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: '添加失败' }));
      throw new Error(error.error || '添加失败');
    }
    return await response.json();
  },

  // 更新交易记录
  async updateTransaction(id, data, monthHint) {
    const url = `${API_BASE}/api/transactions/${id}${monthHint ? `?month=${monthHint}` : ''}`;
    const response = await fetch(url, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error('请求失败');
    return await response.json();
  },

  // 删除交易记录
  async deleteTransaction(id, monthHint) {
    const url = `${API_BASE}/api/transactions/${id}${monthHint ? `?month=${monthHint}` : ''}`;
    const response = await fetch(url, {
      method: 'DELETE'
    });
    if (!response.ok) throw new Error('请求失败');
    return await response.json();
  }
};

/**
 * 分类 API
 */
export const categoryAPI = {
  // 获取分类列表
  async getCategories() {
    const response = await fetch(`${API_BASE}/api/categories`);
    if (!response.ok) throw new Error('请求失败');
    return await response.json();
  },

  // 添加分类
  async addCategory(data) {
    const response = await fetch(`${API_BASE}/api/categories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error('请求失败');
    return await response.json();
  },

  // 删除分类
  async deleteCategory(id) {
    const response = await fetch(`${API_BASE}/api/categories/${id}`, {
      method: 'DELETE'
    });
    if (!response.ok) throw new Error('请求失败');
    return await response.json();
  }
};

/**
 * 预算 API
 */
export const budgetAPI = {
  // 获取预算设置
  async getBudgets() {
    const response = await fetch(`${API_BASE}/api/budgets`);
    if (!response.ok) throw new Error('请求失败');
    return await response.json();
  },

  // 设置预算
  async setBudgets(budgets) {
    const response = await fetch(`${API_BASE}/api/budgets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ budgets })
    });
    if (!response.ok) throw new Error('请求失败');
    return await response.json();
  }
};

/**
 * 统计 API
 */
export const statsAPI = {
  // 获取统计数据
  async getStats(month) {
    const response = await fetch(`${API_BASE}/api/stats?month=${month}`);
    if (!response.ok) throw new Error('请求失败');
    return await response.json();
  }
};

