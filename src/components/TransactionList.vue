<template>
  <div class="transaction-list">
    <div class="list-header">
      <h3>交易记录</h3>
      <div class="filters">
        <select v-model="selectedMonth" @change="handleMonthChange">
          <option
            v-for="month in months"
            :key="month.value"
            :value="month.value"
          >
            {{ month.label }}
          </option>
        </select>
        <select v-model="selectedType" @change="handleFilterChange">
          <option value="">全部类型</option>
          <option value="income">收入</option>
          <option value="expense">支出</option>
        </select>
        <select v-model="selectedCategory" @change="handleFilterChange">
          <option value="">全部分类</option>
          <option
            v-for="cat in categories"
            :key="cat.id"
            :value="cat.id"
          >
            {{ cat.icon }} {{ cat.name }}
          </option>
        </select>
      </div>
    </div>

    <div v-if="loading" class="loading">加载中...</div>
    <div v-else-if="filteredTransactions.length === 0" class="empty">
      暂无交易记录
    </div>
    <div v-else class="transactions">
      <div
        v-for="transaction in filteredTransactions"
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
        <div class="transaction-actions">
          <button
            class="btn-icon"
            @click="$emit('edit', transaction)"
            title="编辑"
          >
            ✏️
          </button>
          <button
            class="btn-icon"
            @click="handleDelete(transaction.id)"
            title="删除"
          >
            🗑️
          </button>
        </div>
      </div>
    </div>

    <div v-if="filteredTransactions.length > 0" class="list-summary">
      <div class="summary-item">
        <span class="label">总收入:</span>
        <span class="value income">+¥{{ formatAmount(totalIncome) }}</span>
      </div>
      <div class="summary-item">
        <span class="label">总支出:</span>
        <span class="value expense">-¥{{ formatAmount(totalExpense) }}</span>
      </div>
      <div class="summary-item">
        <span class="label">余额:</span>
        <span
          class="value"
          :style="{ color: balance >= 0 ? '#27ae60' : '#e74c3c' }"
        >
          {{ balance >= 0 ? '+' : '' }}¥{{ formatAmount(balance) }}
        </span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { formatAmount, getAmountColor, getAmountSign } from '../utils/format'
import { formatDateCN, getPreviousMonths } from '../utils/date'

const props = defineProps({
  transactions: {
    type: Array,
    default: () => []
  },
  categories: {
    type: Array,
    default: () => []
  },
  loading: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['month-change', 'edit', 'delete'])

const selectedMonth = ref('')
const selectedType = ref('')
const selectedCategory = ref('')

// 生成月份选项
const months = computed(() => {
  const prevMonths = getPreviousMonths(12)
  return prevMonths.map(month => ({
    value: month,
    label: formatDateCN(month + '-01').replace(/\d+日/, '')
  }))
})

// 初始化选中月份为当前月
watch(() => props.transactions, () => {
  if (!selectedMonth.value && months.value.length > 0) {
    selectedMonth.value = months.value[0].value
  }
}, { immediate: true })

// 过滤后的交易记录
const filteredTransactions = computed(() => {
  let result = [...props.transactions]

  if (selectedType.value) {
    result = result.filter(t => t.type === selectedType.value)
  }

  if (selectedCategory.value) {
    result = result.filter(t => t.category === selectedCategory.value)
  }

  // 按日期倒序排列
  return result.sort((a, b) => new Date(b.date) - new Date(a.date))
})

// 统计信息
const totalIncome = computed(() => {
  return filteredTransactions.value
    .filter(t => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0)
})

const totalExpense = computed(() => {
  return filteredTransactions.value
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0)
})

const balance = computed(() => {
  return totalIncome.value - totalExpense.value
})

// 获取分类图标和名称
const getCategoryIcon = (categoryId) => {
  const category = props.categories.find(c => c.id === categoryId)
  return category ? category.icon : '📝'
}

const getCategoryName = (categoryId) => {
  const category = props.categories.find(c => c.id === categoryId)
  return category ? category.name : categoryId
}

// 处理月份变化
const handleMonthChange = () => {
  emit('month-change', selectedMonth.value)
}

// 处理筛选变化
const handleFilterChange = () => {
  // 筛选在本地完成，不需要重新请求
}

// 删除交易
const handleDelete = (id) => {
  if (confirm('确定要删除这条交易记录吗？')) {
    emit('delete', id)
  }
}
</script>

<style scoped>
.transaction-list {
  background: white;
  padding: 2rem;
  border-radius: 12px;
  box-shadow: 0 2px 10px rgba(0,0,0,0.1);
}

.list-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
  flex-wrap: wrap;
  gap: 1rem;
}

.list-header h3 {
  color: #333;
  font-size: 1.5rem;
}

.filters {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.filters select {
  padding: 0.5rem 1rem;
  border: 2px solid #e0e0e0;
  border-radius: 6px;
  font-size: 0.9rem;
  cursor: pointer;
  transition: border-color 0.3s;
}

.filters select:focus {
  outline: none;
  border-color: #667eea;
}

.loading,
.empty {
  text-align: center;
  padding: 3rem;
  color: #999;
}

.transactions {
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

.transaction-actions {
  display: flex;
  gap: 0.5rem;
  margin-left: 1rem;
}

.btn-icon {
  width: 36px;
  height: 36px;
  border: none;
  background: white;
  border-radius: 6px;
  cursor: pointer;
  font-size: 1rem;
  transition: all 0.3s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.btn-icon:hover {
  background: #e0e0e0;
  transform: scale(1.1);
}

.list-summary {
  margin-top: 2rem;
  padding-top: 1.5rem;
  border-top: 2px solid #e0e0e0;
  display: flex;
  justify-content: space-around;
  flex-wrap: wrap;
  gap: 1rem;
}

.summary-item {
  text-align: center;
}

.summary-item .label {
  display: block;
  color: #666;
  font-size: 0.875rem;
  margin-bottom: 0.25rem;
}

.summary-item .value {
  display: block;
  font-size: 1.25rem;
  font-weight: 700;
}

.summary-item .value.income {
  color: #27ae60;
}

.summary-item .value.expense {
  color: #e74c3c;
}

@media (max-width: 768px) {
  .list-header {
    flex-direction: column;
    align-items: stretch;
  }

  .filters {
    flex-direction: column;
  }

  .filters select {
    width: 100%;
  }

  .transaction-item {
    flex-wrap: wrap;
  }

  .transaction-actions {
    width: 100%;
    margin-left: 0;
    margin-top: 0.5rem;
    justify-content: flex-end;
  }
}
</style>

