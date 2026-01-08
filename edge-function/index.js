/**
 * 阿里云 ESA 边缘函数 - 个人记账本全量优化版
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json;charset=UTF-8'
};

// --- 工具函数 ---

// 1. 锁定北京时间，生成 YYYY-MM 或 YYYY-MM-DD
function getBJTime(dateInput = new Date()) {
  const d = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  const options = { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' };
  const parts = new Intl.DateTimeFormat('zh-CN', options).formatToParts(d);
  const getPart = (type) => parts.find(p => p.type === type).value;
  return {
    month: `${getPart('year')}-${getPart('month')}`,
    full: `${getPart('year')}-${getPart('month')}-${getPart('day')}`
  };
}

// 2. 获取 KV 键名 (transactions_YYYY_MM)
function getTransactionsKey(monthStr) {
  return `transactions_${monthStr.replace('-', '_')}`;
}

// 3. 健壮的读取逻辑：处理新旧Key迁移及空值
async function getTransactionsData(edgeKV, month) {
  const newKey = getTransactionsKey(month);
  const oldKey = `transactions_${month}`;
  
  let data = await edgeKV.get(newKey, { type: 'json' });
  
  // 如果新Key不存在且不是空数组，尝试读取旧Key
  if (data === null) {
    data = await edgeKV.get(oldKey, { type: 'json' });
    if (data && Array.isArray(data)) {
      await edgeKV.put(newKey, JSON.stringify(data)); // 自动迁移
    }
  }
  return Array.isArray(data) ? data : [];
}

// 4. 生成ID（增强唯一性，避免并发冲突）
const generateId = () => {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 9);
  const extra = Math.random().toString(36).substring(2, 6);
  return `${timestamp.toString(36)}_${random}_${extra}`;
};

// --- 主函数 ---

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const method = request.method;
    const pathname = url.pathname;
    const edgeKV = new EdgeKV({ namespace: 'moneryNumber' });

    if (method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });

    try {
      // ========== 交易记录 API ==========

      // GET /api/transactions
      if (method === 'GET' && pathname === '/api/transactions') {
        const month = url.searchParams.get('month') || getBJTime().month;
        const transactions = await getTransactionsData(edgeKV, month);
        console.log(`[GET /api/transactions] month: ${month}, count: ${transactions.length}, data:`, JSON.stringify(transactions));
        return new Response(JSON.stringify(transactions), { headers: corsHeaders });
      }

      // POST /api/transactions
      if (method === 'POST' && pathname === '/api/transactions') {
        const body = await request.json();
        const dateStr = body.date || getBJTime().full;
        const month = dateStr.substring(0, 7);
        
        // 生成唯一ID
        let newId = generateId();
        const list = await getTransactionsData(edgeKV, month);
        console.log(`[POST /api/transactions] 读取数据 - month: ${month}, count: ${list.length}, data:`, JSON.stringify(list));
        
        // 确保ID唯一（简单检查，如果冲突则重新生成）
        let retryCount = 0;
        while (list.find(t => t.id === newId) && retryCount < 5) {
          newId = generateId();
          retryCount++;
        }
        
        const newRecord = {
          id: newId,
          type: body.type === 'income' ? 'income' : 'expense',
          amount: parseFloat(parseFloat(body.amount || 0).toFixed(2)),
          category: String(body.category || 'other'),
          date: dateStr,
          note: String(body.note || '').substring(0, 100),
          createdAt: new Date().toISOString()
        };

        list.push(newRecord);
        console.log(`[POST /api/transactions] 准备保存 - month: ${month}, 新记录:`, JSON.stringify(newRecord), `总条数: ${list.length}`);
        await edgeKV.put(getTransactionsKey(month), JSON.stringify(list));
        
        // 保存后再次读取验证
        const verifyList = await getTransactionsData(edgeKV, month);
        console.log(`[POST /api/transactions] 保存后验证 - month: ${month}, count: ${verifyList.length}, data:`, JSON.stringify(verifyList));
        
        return new Response(JSON.stringify(newRecord), { status: 201, headers: corsHeaders });
      }

      // PUT /api/transactions/:id
      if (method === 'PUT' && pathname.startsWith('/api/transactions/')) {
        const id = pathname.split('/').pop();
        const body = await request.json();
        const month = url.searchParams.get('month') || getBJTime().month; // 建议前端传入原月份

        const list = await getTransactionsData(edgeKV, month);
        console.log(`[PUT /api/transactions/${id}] 读取数据 - month: ${month}, count: ${list.length}, data:`, JSON.stringify(list));
        const idx = list.findIndex(t => t.id === id);
        
        if (idx === -1) throw new Error('记录未找到，请确认月份参数是否正确');

        // 更新逻辑：处理可能的跨月移动
        const updated = { ...list[idx], ...body, updatedAt: new Date().toISOString() };
        
        if (body.date && body.date.substring(0, 7) !== month) {
          // 跨月了：从当前月删除，加到新月
          list.splice(idx, 1);
          await edgeKV.put(getTransactionsKey(month), JSON.stringify(list));
          const newList = await getTransactionsData(edgeKV, body.date.substring(0, 7));
          newList.push(updated);
          await edgeKV.put(getTransactionsKey(body.date.substring(0, 7)), JSON.stringify(newList));
          console.log(`[PUT /api/transactions/${id}] 跨月更新 - 从${month}移到${body.date.substring(0, 7)}, 新列表count: ${newList.length}`);
        } else {
          // 同月内修改
          list[idx] = updated;
          await edgeKV.put(getTransactionsKey(month), JSON.stringify(list));
          console.log(`[PUT /api/transactions/${id}] 同月更新 - month: ${month}, 更新后count: ${list.length}`);
        }
        return new Response(JSON.stringify(updated), { headers: corsHeaders });
      }

      // DELETE /api/transactions/:id
      if (method === 'DELETE' && pathname.startsWith('/api/transactions/')) {
        const id = pathname.split('/').pop();
        const monthHint = url.searchParams.get('month');
        console.log(`[DELETE /api/transactions/${id}] monthHint: ${monthHint || '未提供，搜索最近3个月'}`);
        // 如果前端没传 month，则只搜最近3个月，防止性能浪费
        const toSearch = monthHint ? [monthHint] : [0, 1, 2].map(i => {
          const d = new Date(); d.setMonth(d.getMonth() - i);
          return getBJTime(d).month;
        });

        for (const m of toSearch) {
          let list = await getTransactionsData(edgeKV, m);
          console.log(`[DELETE /api/transactions/${id}] 搜索月份: ${m}, count: ${list.length}`);
          const startLen = list.length;
          list = list.filter(t => t.id !== id);
          if (list.length !== startLen) {
            await edgeKV.put(getTransactionsKey(m), JSON.stringify(list));
            console.log(`[DELETE /api/transactions/${id}] 删除成功 - month: ${m}, 删除前: ${startLen}, 删除后: ${list.length}`);
            return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
          }
        }
        console.log(`[DELETE /api/transactions/${id}] 未找到记录`);
        return new Response(JSON.stringify({ error: 'Record not found' }), { status: 404, headers: corsHeaders });
      }

      // ========== 分类与统计 API ==========

      // GET /api/categories (内置初始化逻辑)
      if (method === 'GET' && pathname === '/api/categories') {
        let cats = await edgeKV.get('categories', { type: 'json' });
        if (!cats) {
          cats = [
            { id: 'food', name: '餐饮', icon: '🍔', type: 'expense' },
            { id: 'salary', name: '工资', icon: '💰', type: 'income' }
          ];
          await edgeKV.put('categories', JSON.stringify(cats));
          console.log(`[GET /api/categories] 初始化默认分类`);
        }
        console.log(`[GET /api/categories] count: ${cats.length}, data:`, JSON.stringify(cats));
        return new Response(JSON.stringify(cats), { headers: corsHeaders });
      }

      // POST /api/categories
      if (method === 'POST' && pathname === '/api/categories') {
        const body = await request.json();
        let cats = await edgeKV.get('categories', { type: 'json' }) || [];
        console.log(`[POST /api/categories] 读取数据 - count: ${cats.length}`);
        const newCategory = {
          id: body.id || generateId(),
          name: String(body.name || ''),
          icon: String(body.icon || '📝'),
          type: body.type === 'income' ? 'income' : 'expense'
        };
        cats.push(newCategory);
        await edgeKV.put('categories', JSON.stringify(cats));
        console.log(`[POST /api/categories] 添加成功 - 新分类:`, JSON.stringify(newCategory), `总数量: ${cats.length}`);
        return new Response(JSON.stringify(newCategory), { status: 201, headers: corsHeaders });
      }

      // DELETE /api/categories/:id
      if (method === 'DELETE' && pathname.startsWith('/api/categories/')) {
        const id = pathname.split('/').pop();
        let cats = await edgeKV.get('categories', { type: 'json' }) || [];
        console.log(`[DELETE /api/categories/${id}] 读取数据 - count: ${cats.length}`);
        const idx = cats.findIndex(c => c.id === id);
        if (idx === -1) {
          console.log(`[DELETE /api/categories/${id}] 未找到分类`);
          return new Response(JSON.stringify({ error: '分类未找到' }), { status: 404, headers: corsHeaders });
        }
        cats.splice(idx, 1);
        await edgeKV.put('categories', JSON.stringify(cats));
        console.log(`[DELETE /api/categories/${id}] 删除成功 - 删除后count: ${cats.length}`);
        return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
      }

      // GET /api/budgets
      if (method === 'GET' && pathname === '/api/budgets') {
        let budgets = await edgeKV.get('budgets', { type: 'json' });
        if (!budgets) budgets = {};
        console.log(`[GET /api/budgets] data:`, JSON.stringify(budgets));
        return new Response(JSON.stringify(budgets), { headers: corsHeaders });
      }

      // POST /api/budgets
      if (method === 'POST' && pathname === '/api/budgets') {
        const body = await request.json();
        const budgets = body.budgets || {};
        await edgeKV.put('budgets', JSON.stringify(budgets));
        console.log(`[POST /api/budgets] 保存预算 - data:`, JSON.stringify(budgets));
        return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
      }

      // GET /api/stats
      if (method === 'GET' && pathname === '/api/stats') {
        const month = url.searchParams.get('month') || getBJTime().month;
        const list = await getTransactionsData(edgeKV, month);
        console.log(`[GET /api/stats] month: ${month}, count: ${list.length}, data:`, JSON.stringify(list));
        const stats = list.reduce((acc, t) => {
          const amt = t.amount || 0;
          if (t.type === 'income') acc.income += amt; else acc.expense += amt;
          return acc;
        }, { income: 0, expense: 0 });
        
        // 获取分类数据用于统计
        let cats = await edgeKV.get('categories', { type: 'json' });
        if (!cats) cats = [];
        
        // 按分类统计
        const incomeByCategory = {};
        const expenseByCategory = {};
        list.forEach(t => {
          const amt = t.amount || 0;
          if (t.type === 'income') {
            incomeByCategory[t.category] = (incomeByCategory[t.category] || 0) + amt;
          } else {
            expenseByCategory[t.category] = (expenseByCategory[t.category] || 0) + amt;
          }
        });
        
        // 转换为数组格式
        const incomeByCategoryArray = Object.entries(incomeByCategory).map(([categoryId, amount]) => {
          const category = cats.find(c => c.id === categoryId);
          return {
            name: category ? category.name : categoryId,
            value: amount,
            icon: category ? category.icon : '📝'
          };
        });
        
        const expenseByCategoryArray = Object.entries(expenseByCategory).map(([categoryId, amount]) => {
          const category = cats.find(c => c.id === categoryId);
          return {
            name: category ? category.name : categoryId,
            value: amount,
            icon: category ? category.icon : '📝'
          };
        });
        
        return new Response(JSON.stringify({
          month,
          totalIncome: stats.income,
          totalExpense: stats.expense,
          income: stats.income,
          expense: stats.expense,
          balance: stats.income - stats.expense,
          transactionCount: list.length,
          count: list.length,
          incomeByCategory: incomeByCategoryArray,
          expenseByCategory: expenseByCategoryArray
        }), { headers: corsHeaders });
      }

      return new Response('Not Found', { status: 404 });

    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders });
    }
  }
};