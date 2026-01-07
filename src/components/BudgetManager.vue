<template>
  <div class="budget-manager">
    <div class="manager-header">
      <h3>预算管理</h3>
      <button class="btn btn-primary" @click="showSetForm = true">
        + 设置预算
      </button>
    </div>

    <!-- 设置预算表单 -->
    <div v-if="showSetForm" class="budget-form">
      <h4>设置月度预算</h4>
      <form @submit.prevent="handleSubmit">
        <div class="form-group">
          <label>选择分类</label>
          <select v-model="formData.categoryId" required>
            <option value="">请选择分类</option>
            <option
              v-for="cat in expenseCategories"
              :key="cat.id"
              :value="cat.id"
            >
              {{ cat.icon }} {{ cat.name }}
            </option>
          </select>
          <div v-if="expenseCategories.length === 0" class="form-hint">
            ⚠️ 暂无支出分类，请先在"交易记录"页面添加分类
          </div>
        </div>

        <div class="form-group">
          <label>预算金额（元）</label>
          <input
            type="number"
            v-model.number="formData.amount"
            step="0.01"
            min="0.01"
            required
            placeholder="请输入预算金额"
          />
        </div>

        <div class="form-actions">
          <button type="submit" class="btn btn-primary" :disabled="loading">
            {{ loading ? '保存中...' : '保存' }}
          </button>
          <button
            type="button"
            class="btn btn-secondary"
            @click="cancelForm"
          >
            取消
          </button>
        </div>
      </form>
    </div>

    <!-- 预算列表 -->
    <div v-if="budgetList.length > 0" class="budgets-list">
      <div
        v-for="budget in budgetList"
        :key="budget.categoryId"
        class="budget-item"
      >
        <div class="budget-icon">{{ getCategoryIcon(budget.categoryId) }}</div>
        <div class="budget-info">
          <div class="budget-name">{{ getCategoryName(budget.categoryId) }}</div>
          <div class="budget-amount">
            <span class="label">预算:</span>
            <span class="value">¥{{ formatAmount(budget.amount) }}</span>
          </div>
          <div class="budget-progress">
            <div class="progress-bar">
              <div
                class="progress-fill"
                :style="{
                  width: `${budget.percentage}%`,
                  backgroundColor: budget.percentage > 100 ? '#e74c3c' : '#27ae60'
                }"
              ></div>
            </div>
            <div class="progress-text">
              <span>已用: ¥{{ formatAmount(budget.used) }}</span>
              <span
                class="percentage"
                :style="{ color: budget.percentage > 100 ? '#e74c3c' : '#27ae60' }"
              >
                {{ budget.percentage.toFixed(1) }}%
              </span>
            </div>
          </div>
        </div>
        <div class="budget-actions">
          <button
            class="btn-icon"
            @click="handleEdit(budget)"
            title="编辑"
          >
            ✏️
          </button>
          <button
            class="btn-icon"
            @click="handleDelete(budget.categoryId)"
            title="删除"
          >
            🗑️
          </button>
        </div>
      </div>
    </div>

    <div v-else class="empty">
      暂无预算设置，请添加预算
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { formatAmount } from '../utils/format'

const props = defineProps({
  categories: {
    type: Array,
    default: () => []
  },
  budgets: {
    type: Object,
    default: () => ({})
  },
  stats: {
    type: Object,
    default: null
  },
  loading: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['set', 'delete'])

const showSetForm = ref(false)
const editingBudget = ref(null)
const loading = ref(false)

const formData = ref({
  categoryId: '',
  amount: ''
})

// 只显示支出分类
const expenseCategories = computed(() => {
  return props.categories.filter(cat => cat.type === 'expense')
})

// 预算列表（带使用情况）
const budgetList = computed(() => {
  const list = []
  const expenseByCategory = props.stats?.expenseByCategory || []

  Object.keys(props.budgets).forEach(categoryId => {
    const budgetAmount = props.budgets[categoryId]
    const used = expenseByCategory.find(item => item.categoryId === categoryId)?.amount || 0
    const percentage = budgetAmount > 0 ? (used / budgetAmount) * 100 : 0

    list.push({
      categoryId,
      amount: budgetAmount,
      used,
      percentage
    })
  })

  return list.sort((a, b) => b.percentage - a.percentage)
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

// 编辑预算
const handleEdit = (budget) => {
  editingBudget.value = budget
  formData.value = {
    categoryId: budget.categoryId,
    amount: budget.amount
  }
  showSetForm.value = true
}

// 取消表单
const cancelForm = () => {
  showSetForm.value = false
  editingBudget.value = null
  formData.value = {
    categoryId: '',
    amount: ''
  }
}

// 提交表单
const handleSubmit = async () => {
  if (!formData.value.amount || formData.value.amount <= 0) {
    alert('请输入有效的预算金额')
    return
  }

  loading.value = true
  try {
    const newBudgets = { ...props.budgets }
    newBudgets[formData.value.categoryId] = parseFloat(formData.value.amount.toFixed(2))
    
    await emit('set', newBudgets)
    cancelForm()
  } finally {
    loading.value = false
  }
}

// 删除预算
const handleDelete = (categoryId) => {
  if (confirm('确定要删除这个预算设置吗？')) {
    const newBudgets = { ...props.budgets }
    delete newBudgets[categoryId]
    emit('set', newBudgets)
  }
}

// 监听编辑状态
watch(() => props.budgets, () => {
  if (editingBudget.value) {
    const budget = budgetList.value.find(b => b.categoryId === editingBudget.value.categoryId)
    if (!budget) {
      cancelForm()
    }
  }
})
</script>

<style scoped>
.budget-manager {
  background: white;
  padding: 2rem;
  border-radius: 12px;
  box-shadow: 0 2px 10px rgba(0,0,0,0.1);
}

.manager-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
}

.manager-header h3 {
  color: #333;
  font-size: 1.5rem;
}

.budget-form {
  background: #f8f9fa;
  padding: 1.5rem;
  border-radius: 8px;
  margin-bottom: 2rem;
}

.budget-form h4 {
  margin-bottom: 1rem;
  color: #333;
}

.form-group {
  margin-bottom: 1rem;
}

.form-group label {
  display: block;
  margin-bottom: 0.5rem;
  color: #666;
  font-weight: 500;
}

select,
input[type="number"] {
  width: 100%;
  padding: 0.75rem;
  border: 2px solid #e0e0e0;
  border-radius: 6px;
  font-size: 1rem;
}

select:focus,
input:focus {
  outline: none;
  border-color: #667eea;
}

.form-hint {
  margin-top: 0.5rem;
  padding: 0.5rem;
  background: #fff3cd;
  border: 1px solid #ffc107;
  border-radius: 4px;
  color: #856404;
  font-size: 0.875rem;
}

.form-actions {
  display: flex;
  gap: 0.5rem;
  margin-top: 1rem;
}

.btn {
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 6px;
  font-size: 0.9rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s;
}

.btn-primary {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.btn-primary:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 5px 15px rgba(102, 126, 234, 0.4);
}

.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-secondary {
  background: #e0e0e0;
  color: #666;
}

.btn-secondary:hover {
  background: #d0d0d0;
}

.budgets-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.budget-item {
  display: flex;
  align-items: center;
  padding: 1.5rem;
  background: #f8f9fa;
  border-radius: 8px;
  transition: all 0.3s;
}

.budget-item:hover {
  background: #e9ecef;
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(0,0,0,0.1);
}

.budget-icon {
  width: 60px;
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: white;
  border-radius: 50%;
  font-size: 2rem;
  margin-right: 1.5rem;
}

.budget-info {
  flex: 1;
  min-width: 0;
}

.budget-name {
  font-weight: 600;
  color: #333;
  font-size: 1.1rem;
  margin-bottom: 0.5rem;
}

.budget-amount {
  margin-bottom: 0.75rem;
}

.budget-amount .label {
  color: #666;
  font-size: 0.9rem;
  margin-right: 0.5rem;
}

.budget-amount .value {
  color: #667eea;
  font-weight: 700;
  font-size: 1.1rem;
}

.budget-progress {
  width: 100%;
}

.progress-bar {
  width: 100%;
  height: 8px;
  background: #e0e0e0;
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 0.5rem;
}

.progress-fill {
  height: 100%;
  transition: width 0.3s;
  border-radius: 4px;
}

.progress-text {
  display: flex;
  justify-content: space-between;
  font-size: 0.875rem;
  color: #666;
}

.progress-text .percentage {
  font-weight: 700;
}

.budget-actions {
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

.empty {
  text-align: center;
  padding: 3rem;
  color: #999;
}

@media (max-width: 768px) {
  .budget-item {
    flex-wrap: wrap;
  }

  .budget-actions {
    width: 100%;
    margin-left: 0;
    margin-top: 1rem;
    justify-content: flex-end;
  }
}
</style>

