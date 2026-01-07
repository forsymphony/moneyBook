<template>
  <div class="home">
    <div v-if="loading" class="loading">加载中...</div>
    <div v-else>
      <!-- 概览卡片 -->
      <div class="overview-cards">
        <div class="card income-card">
          <div class="card-icon">💰</div>
          <div class="card-content">
            <div class="card-label">本月收入</div>
            <div class="card-value income">+¥{{ formatAmount(currentStats?.totalIncome || 0) }}</div>
          </div>
        </div>
        <div class="card expense-card">
          <div class="card-icon">💸</div>
          <div class="card-content">
            <div class="card-label">本月支出</div>
            <div class="card-value expense">-¥{{ formatAmount(currentStats?.totalExpense || 0) }}</div>
          </div>
        </div>
        <div class="card balance-card">
          <div class="card-icon">📊</div>
          <div class="card-content">
            <div class="card-label">本月余额</div>
            <div
              class="card-value"
              :style="{ color: balance >= 0 ? '#27ae60' : '#e74c3c' }"
            >
              {{ balance >= 0 ? '+' : '' }}¥{{ formatAmount(Math.abs(balance)) }}
            </div>
          </div>
        </div>
      </div>

      <!-- 快速添加交易 -->
      <div class="quick-add-section">
        <h2>快速添加</h2>
        <TransactionForm
          :categories="categories"
          @submit="handleAddTransaction"
        />
      </div>

      <!-- 最近交易 -->
      <div class="recent-transactions">
        <h2>最近交易</h2>
        <div v-if="recentTransactions.length === 0" class="empty">
          暂无交易记录
        </div>
        <div v-else class="transactions-list">
          <div
            v-for="transaction in recentTransactions"
            :key="transaction.id"
            class="transaction-item"
          >
            <div class="transaction-icon">
              <span>{{ getCategoryIcon(transaction.category) }}</span>
            </div>
            <div class="transaction-info">
              <div class="transaction-main">
                <span class="category-name">{{ getCategoryName(transaction.category) }}</span>
                <span
                  class="amount"
                  :style="{ color: getAmountColor(transaction.type) }"
                >
                  {{ getAmountSign(transaction.type) }}¥{{ formatAmount(transaction.amount) }}
                </span>
              </div>
              <div class="transaction-meta">
                <span class="date">{{ formatDateCN(transaction.date) }}</span>
                <span v-if="transaction.note" class="note">{{ transaction.note }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { transactionAPI, categoryAPI, statsAPI } from '../api'
import { formatAmount, getAmountColor, getAmountSign } from '../utils/format'
import { formatDateCN, getCurrentMonth } from '../utils/date'
import TransactionForm from '../components/TransactionForm.vue'

const loading = ref(false)
const categories = ref([])
const transactions = ref([])
const currentStats = ref(null)

const currentMonth = getCurrentMonth()

// 计算余额
const balance = computed(() => {
  if (!currentStats.value) return 0
  return currentStats.value.totalIncome - currentStats.value.totalExpense
})

// 最近5条交易记录
const recentTransactions = computed(() => {
  return [...transactions.value]
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 5)
})

// 获取分类图标和名称
const getCategoryIcon = (categoryId) => {
  const category = categories.value.find(c => c.id === categoryId)
  return category ? category.icon : '📝'
}

const getCategoryName = (categoryId) => {
  const category = categories.value.find(c => c.id === categoryId)
  return category ? category.name : categoryId
}

// 加载数据
const loadData = async () => {
  loading.value = true
  try {
    const [categoriesData, transactionsData, statsData] = await Promise.all([
      categoryAPI.getCategories(),
      transactionAPI.getTransactions(currentMonth),
      statsAPI.getStats(currentMonth)
    ])
    
    categories.value = categoriesData
    transactions.value = transactionsData
    currentStats.value = statsData
  } catch (error) {
    console.error('加载数据失败:', error)
    alert('加载数据失败，请稍后重试')
  } finally {
    loading.value = false
  }
}

// 添加交易
const handleAddTransaction = async (data) => {
  try {
    await transactionAPI.addTransaction(data)
    await loadData() // 重新加载数据
  } catch (error) {
    console.error('添加交易失败:', error)
    alert('添加交易失败，请稍后重试')
    throw error
  }
}

onMounted(() => {
  loadData()
})
</script>

<style scoped>
.home {
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.loading {
  text-align: center;
  padding: 3rem;
  color: #999;
}

.overview-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1.5rem;
}

.card {
  background: white;
  padding: 1.5rem;
  border-radius: 12px;
  box-shadow: 0 2px 10px rgba(0,0,0,0.1);
  display: flex;
  align-items: center;
  gap: 1.5rem;
  transition: transform 0.3s;
}

.card:hover {
  transform: translateY(-5px);
  box-shadow: 0 5px 20px rgba(0,0,0,0.15);
}

.card-icon {
  font-size: 3rem;
  width: 80px;
  height: 80px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 50%;
}

.card-content {
  flex: 1;
}

.card-label {
  color: #666;
  font-size: 0.9rem;
  margin-bottom: 0.5rem;
}

.card-value {
  font-size: 1.8rem;
  font-weight: 700;
}

.card-value.income {
  color: #27ae60;
}

.card-value.expense {
  color: #e74c3c;
}

.quick-add-section,
.recent-transactions {
  background: white;
  padding: 2rem;
  border-radius: 12px;
  box-shadow: 0 2px 10px rgba(0,0,0,0.1);
}

.quick-add-section h2,
.recent-transactions h2 {
  margin-bottom: 1.5rem;
  color: #333;
  font-size: 1.5rem;
}

.empty {
  text-align: center;
  padding: 2rem;
  color: #999;
}

.transactions-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.transaction-item {
  display: flex;
  align-items: center;
  padding: 1rem;
  background: #f8f9fa;
  border-radius: 8px;
  transition: all 0.3s;
}

.transaction-item:hover {
  background: #e9ecef;
  transform: translateX(5px);
}

.transaction-icon {
  width: 50px;
  height: 50px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: white;
  border-radius: 50%;
  font-size: 1.5rem;
  margin-right: 1rem;
}

.transaction-info {
  flex: 1;
  min-width: 0;
}

.transaction-main {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}

.category-name {
  font-weight: 500;
  color: #333;
}

.amount {
  font-weight: 700;
  font-size: 1.1rem;
}

.transaction-meta {
  display: flex;
  gap: 1rem;
  font-size: 0.875rem;
  color: #999;
}

.note {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 200px;
}

@media (max-width: 768px) {
  .overview-cards {
    grid-template-columns: 1fr;
  }
}
</style>

