/**
 * 阿里云 ESA 边缘函数 - 个人记账本 API
 * 
 * API 路径：
 * GET    /api/transactions?month=2024-01  - 获取某月交易记录
 * POST   /api/transactions                 - 添加交易记录
 * PUT    /api/transactions/:id             - 更新交易记录
 * DELETE /api/transactions/:id             - 删除交易记录
 * GET    /api/categories                   - 获取分类列表
 * POST   /api/categories                   - 添加分类
 * DELETE /api/categories/:id               - 删除分类
 * GET    /api/budgets                      - 获取预算设置
 * POST   /api/budgets                      - 设置预算
 * GET    /api/stats?month=2024-01          - 获取统计数据
 */

// CORS 响应头
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json;charset=UTF-8'
};

// 生成唯一ID
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// 从日期字符串提取年月（YYYY-MM）
function getYearMonth(dateStr) {
  return dateStr.substring(0, 7);
}

// 获取KV键名（按月存储）
function getTransactionsKey(dateStr) {
  const yearMonth = getYearMonth(dateStr);
  // 将 YYYY-MM 格式转换为 YYYY_MM 格式（下划线分隔）
  return `transactions_${yearMonth.replace('-', '_')}`;
}

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const method = request.method;
    const pathname = url.pathname;

    // 处理 CORS 预检
    if (method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    try {
      const edgeKV = new EdgeKV({ namespace: 'moneryNumber' });

      // ========== 交易记录 API ==========
      
      // GET /api/transactions?month=2024-01
      if (method === 'GET' && pathname === '/api/transactions') {
        const month = url.searchParams.get('month') || getYearMonth(new Date().toISOString());
        // 将 YYYY-MM 格式转换为 YYYY_MM 格式（下划线分隔）
        const key = `transactions_${month.replace('-', '_')}`;
        
        const data = await edgeKV.get(key, { type: 'json' });
        const transactions = data || [];
        
        return new Response(JSON.stringify({ transactions }), { headers: corsHeaders });
      }

      // POST /api/transactions
      if (method === 'POST' && pathname === '/api/transactions') {
        const body = await request.json();
        const { type, amount, category, date, note } = body;

        // 数据验证
        if (!type || (type !== 'income' && type !== 'expense')) {
          return new Response(JSON.stringify({ error: '类型必须是 income 或 expense' }), {
            status: 400,
            headers: corsHeaders
          });
        }

        if (!amount || typeof amount !== 'number' || amount <= 0) {
          return new Response(JSON.stringify({ error: '金额必须是大于0的数字' }), {
            status: 400,
            headers: corsHeaders
          });
        }

        if (!category || !category.trim()) {
          return new Response(JSON.stringify({ error: '分类不能为空' }), {
            status: 400,
            headers: corsHeaders
          });
        }

        if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
          return new Response(JSON.stringify({ error: '日期格式错误，应为 YYYY-MM-DD' }), {
            status: 400,
            headers: corsHeaders
          });
        }

        // 备注限制100字符
        const noteText = note ? note.substring(0, 100) : '';

        const transaction = {
          id: generateId(),
          type,
          amount: parseFloat(amount.toFixed(2)),
          category: category.trim(),
          date,
          note: noteText,
          createdAt: new Date().toISOString()
        };

        const key = getTransactionsKey(date);
        const transactions = await edgeKV.get(key, { type: 'json' }) || [];
        transactions.push(transaction);
        await edgeKV.put(key, JSON.stringify(transactions));

        return new Response(JSON.stringify(transaction), {
          status: 201,
          headers: corsHeaders
        });
      }

      // PUT /api/transactions/:id
      if (method === 'PUT' && pathname.startsWith('/api/transactions/')) {
        const id = pathname.split('/').pop();
        const body = await request.json();

        // 查找交易记录所在的月份
        const currentMonth = getYearMonth(new Date().toISOString());
        const months = [currentMonth];
        
        // 如果更新了日期，需要查找新日期所在的月份
        if (body.date) {
          const newMonth = getYearMonth(body.date);
          if (!months.includes(newMonth)) {
            months.push(newMonth);
          }
        }

        let found = false;
        let transaction = null;

        // 在所有可能的月份中查找
        for (const month of months) {
          // 将 YYYY-MM 格式转换为 YYYY_MM 格式（下划线分隔）
          const key = `transactions_${month.replace('-', '_')}`;
          const transactions = await edgeKV.get(key, { type: 'json' }) || [];
          const index = transactions.findIndex(t => t.id === id);
          
          if (index !== -1) {
            transaction = transactions[index];
            found = true;

            // 如果日期改变，需要移动到新的月份
            if (body.date && getYearMonth(body.date) !== month) {
              // 从旧月份删除
              transactions.splice(index, 1);
              await edgeKV.put(key, JSON.stringify(transactions));

              // 添加到新月份
              const newKey = getTransactionsKey(body.date);
              const newTransactions = await edgeKV.get(newKey, { type: 'json' }) || [];
              const updated = {
                ...transaction,
                ...body,
                amount: body.amount ? parseFloat(body.amount.toFixed(2)) : transaction.amount,
                note: body.note ? body.note.substring(0, 100) : transaction.note,
                updatedAt: new Date().toISOString()
              };
              newTransactions.push(updated);
              await edgeKV.put(newKey, JSON.stringify(newTransactions));
              transaction = updated;
            } else {
              // 更新当前月份的数据
              transactions[index] = {
                ...transaction,
                ...body,
                amount: body.amount ? parseFloat(body.amount.toFixed(2)) : transaction.amount,
                note: body.note ? body.note.substring(0, 100) : transaction.note,
                updatedAt: new Date().toISOString()
              };
              await edgeKV.put(key, JSON.stringify(transactions));
              transaction = transactions[index];
            }
            break;
          }
        }

        if (!found) {
          return new Response(JSON.stringify({ error: '交易记录不存在' }), {
            status: 404,
            headers: corsHeaders
          });
        }

        return new Response(JSON.stringify(transaction), { headers: corsHeaders });
      }

      // DELETE /api/transactions/:id
      if (method === 'DELETE' && pathname.startsWith('/api/transactions/')) {
        const id = pathname.split('/').pop();
        const currentMonth = getYearMonth(new Date().toISOString());
        
        // 尝试最近12个月
        const months = [];
        const now = new Date();
        for (let i = 0; i < 12; i++) {
          const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
          months.push(date.toISOString().substring(0, 7));
        }

        let found = false;

        for (const month of months) {
          // 将 YYYY-MM 格式转换为 YYYY_MM 格式（下划线分隔）
          const key = `transactions_${month.replace('-', '_')}`;
          const transactions = await edgeKV.get(key, { type: 'json' }) || [];
          const index = transactions.findIndex(t => t.id === id);
          
          if (index !== -1) {
            transactions.splice(index, 1);
            await edgeKV.put(key, JSON.stringify(transactions));
            found = true;
            break;
          }
        }

        if (!found) {
          return new Response(JSON.stringify({ error: '交易记录不存在' }), {
            status: 404,
            headers: corsHeaders
          });
        }

        return new Response(JSON.stringify({ message: '删除成功' }), { headers: corsHeaders });
      }

      // ========== 分类 API ==========

      // GET /api/categories
      if (method === 'GET' && pathname === '/api/categories') {
        const categories = await edgeKV.get('categories', { type: 'json' });
        
        // 如果没有分类，初始化默认分类
        if (!categories || categories.length === 0) {
          const defaultCategories = [
            { id: 'food', name: '餐饮', icon: '🍔', type: 'expense' },
            { id: 'transport', name: '交通', icon: '🚗', type: 'expense' },
            { id: 'shopping', name: '购物', icon: '🛍️', type: 'expense' },
            { id: 'entertainment', name: '娱乐', icon: '🎬', type: 'expense' },
            { id: 'medical', name: '医疗', icon: '🏥', type: 'expense' },
            { id: 'education', name: '教育', icon: '📚', type: 'expense' },
            { id: 'salary', name: '工资', icon: '💰', type: 'income' },
            { id: 'bonus', name: '奖金', icon: '🎁', type: 'income' },
            { id: 'investment', name: '投资', icon: '📈', type: 'income' }
          ];
          await edgeKV.put('categories', JSON.stringify(defaultCategories));
          return new Response(JSON.stringify({ categories: defaultCategories }), { headers: corsHeaders });
        }

        return new Response(JSON.stringify({ categories }), { headers: corsHeaders });
      }

      // POST /api/categories
      if (method === 'POST' && pathname === '/api/categories') {
        const body = await request.json();
        const { name, icon, type } = body;

        if (!name || !name.trim()) {
          return new Response(JSON.stringify({ error: '分类名称不能为空' }), {
            status: 400,
            headers: corsHeaders
          });
        }

        if (type !== 'income' && type !== 'expense') {
          return new Response(JSON.stringify({ error: '类型必须是 income 或 expense' }), {
            status: 400,
            headers: corsHeaders
          });
        }

        const categories = await edgeKV.get('categories', { type: 'json' }) || [];
        
        // 检查分类名称是否已存在（同类型下）
        const existingCategory = categories.find(
          c => c.name.trim() === name.trim() && c.type === type
        );
        
        if (existingCategory) {
          return new Response(JSON.stringify({ error: '该分类已存在' }), {
            status: 400,
            headers: corsHeaders
          });
        }

        const newCategory = {
          id: generateId(),
          name: name.trim(),
          icon: icon || '📝',
          type
        };

        categories.push(newCategory);
        await edgeKV.put('categories', JSON.stringify(categories));

        return new Response(JSON.stringify(newCategory), {
          status: 201,
          headers: corsHeaders
        });
      }

      // DELETE /api/categories/:id
      if (method === 'DELETE' && pathname.startsWith('/api/categories/')) {
        const id = pathname.split('/').pop();
        const categories = await edgeKV.get('categories', { type: 'json' }) || [];
        const filtered = categories.filter(c => c.id !== id);

        if (categories.length === filtered.length) {
          return new Response(JSON.stringify({ error: '分类不存在' }), {
            status: 404,
            headers: corsHeaders
          });
        }

        await edgeKV.put('categories', JSON.stringify(filtered));
        return new Response(JSON.stringify({ message: '删除成功' }), { headers: corsHeaders });
      }

      // ========== 预算 API ==========

      // GET /api/budgets
      if (method === 'GET' && pathname === '/api/budgets') {
        const budgets = await edgeKV.get('budgets', { type: 'json' }) || {};
        return new Response(JSON.stringify({ budgets }), { headers: corsHeaders });
      }

      // POST /api/budgets
      if (method === 'POST' && pathname === '/api/budgets') {
        const body = await request.json();
        const { budgets } = body;

        if (!budgets || typeof budgets !== 'object') {
          return new Response(JSON.stringify({ error: '预算数据格式错误' }), {
            status: 400,
            headers: corsHeaders
          });
        }

        await edgeKV.put('budgets', JSON.stringify(budgets));
        return new Response(JSON.stringify({ budgets }), { headers: corsHeaders });
      }

      // ========== 统计 API ==========

      // GET /api/stats?month=2024-01
      if (method === 'GET' && pathname === '/api/stats') {
        const month = url.searchParams.get('month') || getYearMonth(new Date().toISOString());
        // 将 YYYY-MM 格式转换为 YYYY_MM 格式（下划线分隔）
        const key = `transactions_${month.replace('-', '_')}`;
        const transactions = await edgeKV.get(key, { type: 'json' }) || [];
        const categories = await edgeKV.get('categories', { type: 'json' }) || [];

        // 计算统计数据
        let totalIncome = 0;
        let totalExpense = 0;
        const categoryExpense = {};
        const categoryIncome = {};

        transactions.forEach(t => {
          if (t.type === 'income') {
            totalIncome += t.amount;
            categoryIncome[t.category] = (categoryIncome[t.category] || 0) + t.amount;
          } else {
            totalExpense += t.amount;
            categoryExpense[t.category] = (categoryExpense[t.category] || 0) + t.amount;
          }
        });

        // 构建分类统计（支出）
        const expenseByCategory = Object.keys(categoryExpense).map(catId => {
          const category = categories.find(c => c.id === catId);
          return {
            categoryId: catId,
            categoryName: category ? category.name : catId,
            icon: category ? category.icon : '📝',
            amount: categoryExpense[catId]
          };
        }).sort((a, b) => b.amount - a.amount);

        // 构建分类统计（收入）
        const incomeByCategory = Object.keys(categoryIncome).map(catId => {
          const category = categories.find(c => c.id === catId);
          return {
            categoryId: catId,
            categoryName: category ? category.name : catId,
            icon: category ? category.icon : '📝',
            amount: categoryIncome[catId]
          };
        }).sort((a, b) => b.amount - a.amount);

        const stats = {
          month,
          totalIncome,
          totalExpense,
          balance: totalIncome - totalExpense,
          expenseByCategory,
          incomeByCategory,
          transactionCount: transactions.length
        };

        return new Response(JSON.stringify({ stats }), { headers: corsHeaders });
      }

      // 404
      return new Response(JSON.stringify({ error: 'Not Found' }), {
        status: 404,
        headers: corsHeaders
      });

    } catch (error) {
      return new Response(JSON.stringify({
        error: error.message,
        stack: error.stack
      }), {
        status: 500,
        headers: corsHeaders
      });
    }
  }
};

