/**
 * 阿里云 ESA 边缘函数 - 个人记账本全量优化版
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json;charset=UTF-8'
};

// 统一的响应函数
function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), { 
    status, 
    headers: corsHeaders 
  });
}

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

// 2. 获取 KV 键名 - 按日期+哈希分散存储（更细化）
// 格式: transactions_YYYY_MM_DD_HH (按小时分散) 或 transactions_YYYY_MM_DD_hash (按ID哈希分散)
// 使用日期+ID哈希的组合，既保证查询效率，又最大化分散

// 简单的哈希函数（用于分散key）
function simpleHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36).substring(0, 4);
}

// 根据日期和ID生成key（按日期+ID哈希分散，分成16个bucket）
function getTransactionsKeyByDateAndHash(dateStr, id) {
  // dateStr 格式: YYYY-MM-DD
  const datePart = dateStr.replace(/-/g, '_');
  // 使用ID的前几个字符进行哈希，分散到16个bucket (0-f)
  const hash = id ? simpleHash(id) : Math.random().toString(36).substring(2, 6);
  const bucket = hash.substring(0, 2); // 取前2位，分成更多bucket
  return `transactions_${datePart}_${bucket}`;
}

// 获取某日期的所有可能的 key (用于读取该日期的所有数据)
function getDateKeys(dateStr) {
  // 生成所有可能的bucket key (00-ff，256个bucket)
  const keys = [];
  const datePart = dateStr.replace(/-/g, '_');
  // 使用16进制，分成256个bucket (00-ff)
  for (let i = 0; i < 256; i++) {
    const bucket = i.toString(16).padStart(2, '0');
    keys.push(`transactions_${datePart}_${bucket}`);
  }
  return keys;
}

// 获取月份的所有可能的 key (用于读取整个月的数据)
function getMonthKeys(monthStr) {
  // monthStr 格式: YYYY-MM
  const [year, month] = monthStr.split('-');
  const daysInMonth = new Date(parseInt(year), parseInt(month), 0).getDate();
  const keys = [];
  for (let day = 1; day <= daysInMonth; day++) {
    const dayStr = String(day).padStart(2, '0');
    const dateStr = `${year}-${month}-${dayStr}`;
    keys.push(...getDateKeys(dateStr));
  }
  return keys;
}

// 3. 健壮的读取逻辑：从多个 key 读取并合并数据
async function getTransactionsData(edgeKV, month) {
  const monthKeys = getMonthKeys(month);
  const oldKey = `transactions_${month.replace('-', '_')}`; // 兼容旧格式（按月）
  const oldDateKeys = []; // 兼容旧格式（按日期）
  
  // 生成旧格式的日期key（兼容按日期分散的旧格式）
  const [year, monthNum] = month.split('-');
  const daysInMonth = new Date(parseInt(year), parseInt(monthNum), 0).getDate();
  for (let day = 1; day <= daysInMonth; day++) {
    const dayStr = String(day).padStart(2, '0');
    oldDateKeys.push(`transactions_${year}_${monthNum}_${dayStr}`);
  }
  
  // 并行读取所有 key（分批读取，避免一次性读取太多）
  const batchSize = 50;
  let allData = [];
  
  for (let i = 0; i < monthKeys.length; i += batchSize) {
    const batch = monthKeys.slice(i, i + batchSize);
    const promises = batch.map(key => edgeKV.get(key, { type: 'json' }));
    const results = await Promise.all(promises);
    
    results.forEach((data) => {
      if (data && Array.isArray(data)) {
        allData = allData.concat(data);
      }
    });
  }
  
  // 兼容旧格式：如果新格式没有数据，尝试读取旧格式
  if (allData.length === 0) {
    // 先尝试按日期分散的旧格式
    const oldDatePromises = oldDateKeys.map(key => edgeKV.get(key, { type: 'json' }));
    const oldDateResults = await Promise.all(oldDatePromises);
    
    oldDateResults.forEach((data) => {
      if (data && Array.isArray(data)) {
        allData = allData.concat(data);
      }
    });
    
    // 如果还是没有，尝试按月存储的旧格式
    if (allData.length === 0) {
      const oldData = await edgeKV.get(oldKey, { type: 'json' });
      if (oldData && Array.isArray(oldData)) {
        // 迁移旧数据：按日期+哈希分散到新的 key
        const dataByKey = {};
        oldData.forEach(item => {
          const date = item.date || month + '-01';
          const key = getTransactionsKeyByDateAndHash(date, item.id);
          if (!dataByKey[key]) {
            dataByKey[key] = [];
          }
          dataByKey[key].push(item);
        });
        
        // 保存到新的 key
        for (const [key, items] of Object.entries(dataByKey)) {
          await edgeKV.put(key, JSON.stringify(items));
        }
        allData = oldData;
      }
    }
  }
  
  // 按日期和创建时间排序
  allData.sort((a, b) => {
    const dateCompare = (a.date || '').localeCompare(b.date || '');
    if (dateCompare !== 0) return dateCompare;
    return (a.createdAt || '').localeCompare(b.createdAt || '');
  });
  
  console.log(`[getTransactionsData] month: ${month}, total count: ${allData.length}, keys checked: ${monthKeys.length}`);
  
  return allData;
}

// 根据日期和ID获取对应的 key
function getKeyForTransaction(dateStr, id) {
  return getTransactionsKeyByDateAndHash(dateStr, id);
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

    if (method === 'OPTIONS') return jsonResponse(null, 204);

    try {
      // ========== 交易记录 API ==========

      // GET /api/transactions
      if (method === 'GET' && pathname === '/api/transactions') {
        const month = url.searchParams.get('month') || getBJTime().month;
        console.log(`[GET /api/transactions] 请求月份: ${month}`);
        const transactions = await getTransactionsData(edgeKV, month);
        console.log(`[GET /api/transactions] 返回数据条数: ${transactions.length}`);
        return jsonResponse(transactions);
      }

      // POST /api/transactions
      if (method === 'POST' && pathname === '/api/transactions') {
        const body = await request.json();
        const dateStr = body.date || getBJTime().full;
        const month = dateStr.substring(0, 7);
        
        console.log(`[POST /api/transactions] 添加记录，日期: ${dateStr}, 金额: ${body.amount}`);
        
        // 生成唯一ID
        let newId = generateId();
        
        // 根据日期和ID获取对应的 key（按日期+哈希分散存储，更细化）
        let dateKey = getKeyForTransaction(dateStr, newId);
        
        // 读取该key的数据（只读取对应的bucket，大幅减少冲突）
        let dateData = await edgeKV.get(dateKey, { type: 'json' }) || [];
        if (!Array.isArray(dateData)) dateData = [];
        
        // 确保ID唯一（简单检查，如果冲突则重新生成）
        let retryCount = 0;
        while (dateData.find(t => t.id === newId) && retryCount < 5) {
          newId = generateId();
          dateKey = getKeyForTransaction(dateStr, newId); // 重新计算key
          dateData = await edgeKV.get(dateKey, { type: 'json' }) || [];
          if (!Array.isArray(dateData)) dateData = [];
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
        
        dateData.push(newRecord);
        
        console.log(`[POST /api/transactions] 准备保存到 key: ${dateKey}, 该bucket记录数: ${dateData.length}, 新记录ID: ${newId}`);
        await edgeKV.put(dateKey, JSON.stringify(dateData));
        console.log(`[POST /api/transactions] 保存完成`);
        
        return jsonResponse(newRecord, 201);
      }

      // PUT /api/transactions/:id
      if (method === 'PUT' && pathname.startsWith('/api/transactions/')) {
        const id = pathname.split('/').pop();
        const body = await request.json();
        const monthHint = url.searchParams.get('month') || getBJTime().month;

        // 先尝试根据ID快速定位（如果知道原日期）
        let foundRecord = null;
        let foundKey = null;
        let foundIndex = -1;
        
        // 如果body中有原日期，可以快速定位
        if (body.originalDate) {
          const possibleKey = getKeyForTransaction(body.originalDate, id);
          const data = await edgeKV.get(possibleKey, { type: 'json' }) || [];
          if (Array.isArray(data)) {
            const idx = data.findIndex(t => t.id === id);
            if (idx !== -1) {
              foundRecord = data[idx];
              foundKey = possibleKey;
              foundIndex = idx;
            }
          }
        }
        
        // 如果快速定位失败，搜索整个月份的所有key
        if (!foundRecord) {
          const monthKeys = monthHint ? getMonthKeys(monthHint) : getMonthKeys(getBJTime().month);
          
          // 分批搜索，避免一次性读取太多
          const batchSize = 50;
          for (let i = 0; i < monthKeys.length; i += batchSize) {
            const batch = monthKeys.slice(i, i + batchSize);
            const promises = batch.map(key => edgeKV.get(key, { type: 'json' }));
            const results = await Promise.all(promises);
            
            for (let j = 0; j < results.length; j++) {
              const data = results[j];
              if (Array.isArray(data)) {
                const idx = data.findIndex(t => t.id === id);
                if (idx !== -1) {
                  foundRecord = data[idx];
                  foundKey = batch[j];
                  foundIndex = idx;
                  break;
                }
              }
            }
            if (foundRecord) break;
          }
        }
        
        // 如果还没找到，搜索最近3个月
        if (!foundRecord) {
          for (let i = 0; i < 3; i++) {
            const d = new Date();
            d.setMonth(d.getMonth() - i);
            const m = getBJTime(d).month;
            const keys = getMonthKeys(m);
            
            const batchSize = 50;
            for (let j = 0; j < keys.length; j += batchSize) {
              const batch = keys.slice(j, j + batchSize);
              const promises = batch.map(key => edgeKV.get(key, { type: 'json' }));
              const results = await Promise.all(promises);
              
              for (let k = 0; k < results.length; k++) {
                const data = results[k];
                if (Array.isArray(data)) {
                  const idx = data.findIndex(t => t.id === id);
                  if (idx !== -1) {
                    foundRecord = data[idx];
                    foundKey = batch[k];
                    foundIndex = idx;
                    break;
                  }
                }
              }
              if (foundRecord) break;
            }
            if (foundRecord) break;
          }
        }
        
        if (!foundRecord) throw new Error('记录未找到，请确认月份参数是否正确');

        // 更新逻辑：处理可能的跨日期移动
        const updated = { ...foundRecord, ...body, updatedAt: new Date().toISOString() };
        const newDate = body.date || foundRecord.date;
        const newKey = getKeyForTransaction(newDate, id); // 使用ID计算新key
        
        if (newKey !== foundKey) {
          // 跨日期了：从旧key删除，加到新key
          const oldData = await edgeKV.get(foundKey, { type: 'json' }) || [];
          oldData.splice(foundIndex, 1);
          await edgeKV.put(foundKey, JSON.stringify(oldData));
          
          const newData = await edgeKV.get(newKey, { type: 'json' }) || [];
          if (!Array.isArray(newData)) newData = [];
          newData.push(updated);
          await edgeKV.put(newKey, JSON.stringify(newData));
        } else {
          // 同key内修改
          const data = await edgeKV.get(foundKey, { type: 'json' }) || [];
          data[foundIndex] = updated;
          await edgeKV.put(foundKey, JSON.stringify(data));
        }
        return jsonResponse(updated);
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

        // 分批搜索所有可能的 key
        for (const m of toSearch) {
          const monthKeys = getMonthKeys(m);
          const batchSize = 50;
          
          for (let i = 0; i < monthKeys.length; i += batchSize) {
            const batch = monthKeys.slice(i, i + batchSize);
            const promises = batch.map(key => edgeKV.get(key, { type: 'json' }));
            const results = await Promise.all(promises);
            
            for (let j = 0; j < results.length; j++) {
              const data = results[j];
              if (Array.isArray(data)) {
                const idx = data.findIndex(t => t.id === id);
                if (idx !== -1) {
                  data.splice(idx, 1);
                  await edgeKV.put(batch[j], JSON.stringify(data));
                  return jsonResponse({ success: true });
                }
              }
            }
          }
        }
        return jsonResponse({ error: 'Record not found' }, 404);
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
        return jsonResponse(cats);
      }

      // POST /api/categories
      if (method === 'POST' && pathname === '/api/categories') {
        const body = await request.json();
        let cats = await edgeKV.get('categories', { type: 'json' }) || [];
        const newCategory = {
          id: body.id || generateId(),
          name: String(body.name || ''),
          icon: String(body.icon || '📝'),
          type: body.type === 'income' ? 'income' : 'expense'
        };
        cats.push(newCategory);
        await edgeKV.put('categories', JSON.stringify(cats));
        return jsonResponse(newCategory, 201);
      }

      // DELETE /api/categories/:id
      if (method === 'DELETE' && pathname.startsWith('/api/categories/')) {
        const id = pathname.split('/').pop();
        let cats = await edgeKV.get('categories', { type: 'json' }) || [];
        const idx = cats.findIndex(c => c.id === id);
        if (idx === -1) {
          return jsonResponse({ error: '分类未找到' }, 404);
        }
        cats.splice(idx, 1);
        await edgeKV.put('categories', JSON.stringify(cats));
        return jsonResponse({ success: true });
      }

      // GET /api/budgets
      if (method === 'GET' && pathname === '/api/budgets') {
        let budgets = await edgeKV.get('budgets', { type: 'json' });
        if (!budgets) budgets = {};
        return jsonResponse(budgets);
      }

      // POST /api/budgets
      if (method === 'POST' && pathname === '/api/budgets') {
        const body = await request.json();
        await edgeKV.put('budgets', JSON.stringify(body.budgets || {}));
        return jsonResponse({ success: true });
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
        
        return jsonResponse({
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
        });
      }

      return jsonResponse({ error: 'Not Found' }, 404);

    } catch (e) {
      return jsonResponse({ error: e.message }, 500);
    }
  }
};