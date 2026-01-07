<template>
  <div class="statistics-page">
    <div class="page-header">
      <h2>统计分析</h2>
      <select v-model="selectedMonth" @change="handleMonthChange" class="month-select">
        <option
          v-for="month in months"
          :key="month.value"
          :value="month.value"
        >
          {{ month.label }}
        </option>
      </select>
    </div>

    <div v-if="loading" class="loading">加载中...</div>
    <div v-else-if="!stats" class="empty">暂无统计数据</div>
    <div v-else>
      <!-- 统计概览 -->
      <div class="stats-overview">
        <div class="stat-card">
          <div class="stat-label">总收入</div>
          <div class="stat-value income">+¥{{ formatAmount(stats.totalIncome) }}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">总支出</div>
          <div class="stat-value expense">-¥{{ formatAmount(stats.totalExpense) }}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">余额</div>
          <div
            class="stat-value"
            :style="{ color: stats.balance >= 0 ? '#27ae60' : '#e74c3c' }"
          >
            {{ stats.balance >= 0 ? '+' : '' }}¥{{ formatAmount(Math.abs(stats.balance)) }}
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-label">交易笔数</div>
          <div class="stat-value">{{ stats.transactionCount }}</div>
        </div>
      </div>

      <!-- 图表区域 -->
      <div class="charts-section">
        <!-- 支出分类饼图 -->
        <div v-if="stats.expenseByCategory.length > 0" class="chart-wrapper">
          <PieChart
            :data="stats.expenseByCategory"
            title="支出分类占比"
          />
        </div>

        <!-- 收入分类饼图 -->
        <div v-if="stats.incomeByCategory.length > 0" class="chart-wrapper">
          <PieChart
            :data="stats.incomeByCategory"
            title="收入分类占比"
          />
        </div>
      </div>

      <!-- 多月份对比 -->
      <div class="comparison-section">
        <h3>多月份对比</h3>
        <div class="chart-wrapper">
          <BarChart
            :data="comparisonData"
            title="月度收入支出对比"
          />
        </div>
        <div class="chart-wrapper">
          <LineChart
            :data="comparisonData"
            title="消费趋势分析"
          />
        </div>
      </div>

      <!-- 预算管理 -->
      <div class="budget-section">
        <h3>预算管理</h3>
        <BudgetManager
          :categories="categories"
          :budgets="budgets"
          :stats="stats"
          :loading="budgetLoading"
          @set="handleSetBudgets"
          @delete="handleDeleteBudget"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { statsAPI, categoryAPI, budgetAPI } from '../api'
import { formatAmount } from '../utils/format'
import { formatDateCN, getPreviousMonths } from '../utils/date'
import PieChart from '../components/Charts/PieChart.vue'
import BarChart from '../components/Charts/BarChart.vue'
import LineChart from '../components/Charts/LineChart.vue'
import BudgetManager from '../components/BudgetManager.vue'

const loading = ref(false)
const budgetLoading = ref(false)
const selectedMonth = ref('')
const stats = ref(null)
const categories = ref([])
const budgets = ref({})
const comparisonData = ref([])

// 生成月份选项
const months = computed(() => {
  const prevMonths = getPreviousMonths(12)
  return prevMonths.map(month => ({
    value: month,
    label: formatDateCN(month + '-01').replace(/\d+日/, '')
  }))
})

// 初始化选中月份
if (months.value.length > 0 && !selectedMonth.value) {
  selectedMonth.value = months.value[0].value
}

// 加载统计数据
const loadStats = async (month) => {
  loading.value = true
  try {
    stats.value = await statsAPI.getStats(month)
  } catch (error) {
    console.error('加载统计数据失败:', error)
    alert('加载统计数据失败')
  } finally {
    loading.value = false
  }
}

// 加载分类
const loadCategories = async () => {
  try {
    categories.value = await categoryAPI.getCategories()
    console.log('分类数据加载成功:', categories.value)
  } catch (error) {
    console.error('加载分类失败:', error)
    alert('加载分类失败: ' + (error.message || '未知错误'))
  }
}

// 加载预算
const loadBudgets = async () => {
  try {
    budgets.value = await budgetAPI.getBudgets()
  } catch (error) {
    console.error('加载预算失败:', error)
  }
}

// 加载多月份对比数据
const loadComparisonData = async () => {
  try {
    const months = getPreviousMonths(6)
    const promises = months.map(month => statsAPI.getStats(month))
    const results = await Promise.all(promises)
    
    comparisonData.value = months.map((month, index) => {
      const stat = results[index]
      return {
        month: formatDateCN(month + '-01').replace(/\d+日/, ''),
        income: stat?.totalIncome || 0,
        expense: stat?.totalExpense || 0
      }
    })
  } catch (error) {
    console.error('加载对比数据失败:', error)
  }
}

// 月份变化
const handleMonthChange = () => {
  loadStats(selectedMonth.value)
}

// 设置预算
const handleSetBudgets = async (newBudgets) => {
  budgetLoading.value = true
  try {
    await budgetAPI.setBudgets(newBudgets)
    budgets.value = newBudgets
  } catch (error) {
    console.error('设置预算失败:', error)
    alert('设置预算失败')
  } finally {
    budgetLoading.value = false
  }
}

// 删除预算（通过设置预算实现）
const handleDeleteBudget = async (categoryId) => {
  const newBudgets = { ...budgets.value }
  delete newBudgets[categoryId]
  await handleSetBudgets(newBudgets)
}

onMounted(async () => {
  await Promise.all([
    loadCategories(),
    loadBudgets()
  ])
  
  if (selectedMonth.value) {
    await loadStats(selectedMonth.value)
  }
  
  await loadComparisonData()
})
</script>

<style scoped>
.statistics-page {
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: white;
  padding: 1.5rem 2rem;
  border-radius: 12px;
  box-shadow: 0 2px 10px rgba(0,0,0,0.1);
}

.page-header h2 {
  color: #333;
  font-size: 1.5rem;
}

.month-select {
  padding: 0.5rem 1rem;
  border: 2px solid #e0e0e0;
  border-radius: 6px;
  font-size: 1rem;
  cursor: pointer;
}

.month-select:focus {
  outline: none;
  border-color: #667eea;
}

.loading,
.empty {
  text-align: center;
  padding: 3rem;
  color: #999;
}

.stats-overview {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1.5rem;
}

.stat-card {
  background: white;
  padding: 1.5rem;
  border-radius: 12px;
  box-shadow: 0 2px 10px rgba(0,0,0,0.1);
  text-align: center;
}

.stat-label {
  color: #666;
  font-size: 0.9rem;
  margin-bottom: 0.5rem;
}

.stat-value {
  font-size: 1.8rem;
  font-weight: 700;
}

.stat-value.income {
  color: #27ae60;
}

.stat-value.expense {
  color: #e74c3c;
}

.charts-section {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
  gap: 2rem;
}

.comparison-section,
.budget-section {
  background: white;
  padding: 2rem;
  border-radius: 12px;
  box-shadow: 0 2px 10px rgba(0,0,0,0.1);
}

.comparison-section h3,
.budget-section h3 {
  margin-bottom: 1.5rem;
  color: #333;
  font-size: 1.5rem;
}

.chart-wrapper {
  margin-bottom: 2rem;
}

.chart-wrapper:last-child {
  margin-bottom: 0;
}

@media (max-width: 768px) {
  .page-header {
    flex-direction: column;
    gap: 1rem;
    align-items: stretch;
  }

  .stats-overview {
    grid-template-columns: repeat(2, 1fr);
  }

  .charts-section {
    grid-template-columns: 1fr;
  }
}
</style>

