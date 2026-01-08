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

// 4. 生成ID
const generateId = () => Date.now().toString(36) + Math.random().toString(36).substr(2, 5);

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
        return new Response(JSON.stringify({ transactions }), { headers: corsHeaders });
      }

      // POST /api/transactions
      if (method === 'POST' && pathname === '/api/transactions') {
        const body = await request.json();
        const dateStr = body.date || getBJTime().full;
        const month = dateStr.substring(0, 7);
        
        const newRecord = {
          id: generateId(),
          type: body.type === 'income' ? 'income' : 'expense',
          amount: parseFloat(parseFloat(body.amount || 0).toFixed(2)),
          category: String(body.category || 'other'),
          date: dateStr,
          note: String(body.note || '').substring(0, 100),
          createdAt: new Date().toISOString()
        };

        const list = await getTransactionsData(edgeKV, month);
        list.push(newRecord);
        await edgeKV.put(getTransactionsKey(month), JSON.stringify(list));
        return new Response(JSON.stringify(newRecord), { status: 201, headers: corsHeaders });
      }

      // PUT /api/transactions/:id
      if (method === 'PUT' && pathname.startsWith('/api/transactions/')) {
        const id = pathname.split('/').pop();
        const body = await request.json();
        const month = url.searchParams.get('month') || getBJTime().month; // 建议前端传入原月份

        const list = await getTransactionsData(edgeKV, month);
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
        } else {
          // 同月内修改
          list[idx] = updated;
          await edgeKV.put(getTransactionsKey(month), JSON.stringify(list));
        }
        return new Response(JSON.stringify(updated), { headers: corsHeaders });
      }

      // DELETE /api/transactions/:id
      if (method === 'DELETE' && pathname.startsWith('/api/transactions/')) {
        const id = pathname.split('/').pop();
        const monthHint = url.searchParams.get('month');
        // 如果前端没传 month，则只搜最近3个月，防止性能浪费
        const toSearch = monthHint ? [monthHint] : [0, 1, 2].map(i => {
          const d = new Date(); d.setMonth(d.getMonth() - i);
          return getBJTime(d).month;
        });

        for (const m of toSearch) {
          let list = await getTransactionsData(edgeKV, m);
          const startLen = list.length;
          list = list.filter(t => t.id !== id);
          if (list.length !== startLen) {
            await edgeKV.put(getTransactionsKey(m), JSON.stringify(list));
            return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
          }
        }
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
        }
        return new Response(JSON.stringify({ categories: cats }), { headers: corsHeaders });
      }

      // GET /api/stats
      if (method === 'GET' && pathname === '/api/stats') {
        const month = url.searchParams.get('month') || getBJTime().month;
        const list = await getTransactionsData(edgeKV, month);
        const stats = list.reduce((acc, t) => {
          const amt = t.amount || 0;
          if (t.type === 'income') acc.income += amt; else acc.expense += amt;
          return acc;
        }, { income: 0, expense: 0 });
        
        return new Response(JSON.stringify({
          month,
          ...stats,
          balance: stats.income - stats.expense,
          count: list.length
        }), { headers: corsHeaders });
      }

      return new Response('Not Found', { status: 404 });

    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders });
    }
  }
};