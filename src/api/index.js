/**
 * API 封装层
 * 统一处理所有与 ESA 边缘函数的通信
 */

// API 基础地址（部署时需要修改为实际的 ESA 域名）
const API_BASE = import.meta.env.VITE_API_BASE || '';

/**
 * 通用请求函数
 */
async function request(url, options = {}) {
  try {
    const response = await fetch(`${API_BASE}${url}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      }
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: '请求失败' }));
      throw new Error(error.error || `HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('API请求失败:', error);
    throw error;
  }
}

/**
 * 交易记录 API
 */
export const transactionAPI = {
  // 获取某月交易记录
  async getTransactions(month) {
    const result = await request(`/api/transactions?month=${month}`);
    return result.transactions || [];
  },

  // 添加交易记录
  async addTransaction(data) {
    return await request('/api/transactions', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  // 更新交易记录
  async updateTransaction(id, data) {
    return await request(`/api/transactions/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  },

  // 删除交易记录
  async deleteTransaction(id) {
    return await request(`/api/transactions/${id}`, {
      method: 'DELETE'
    });
  }
};

/**
 * 分类 API
 */
export const categoryAPI = {
  // 获取分类列表
  async getCategories() {
    const result = await request('/api/categories');
    return result.categories || [];
  },

  // 添加分类
  async addCategory(data) {
    return await request('/api/categories', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  // 删除分类
  async deleteCategory(id) {
    return await request(`/api/categories/${id}`, {
      method: 'DELETE'
    });
  }
};

/**
 * 预算 API
 */
export const budgetAPI = {
  // 获取预算设置
  async getBudgets() {
    const result = await request('/api/budgets');
    return result.budgets || {};
  },

  // 设置预算
  async setBudgets(budgets) {
    return await request('/api/budgets', {
      method: 'POST',
      body: JSON.stringify({ budgets })
    });
  }
};

/**
 * 统计 API
 */
export const statsAPI = {
  // 获取统计数据
  async getStats(month) {
    const result = await request(`/api/stats?month=${month}`);
    return result.stats || null;
  }
};

