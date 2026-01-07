<template>
  <div class="transaction-form">
    <h3>{{ editing ? '编辑交易' : '添加交易' }}</h3>
    <form @submit.prevent="handleSubmit">
      <div class="form-group">
        <label>类型</label>
        <div class="type-buttons">
          <button
            type="button"
            :class="['type-btn', formData.type === 'income' ? 'active' : '']"
            @click="formData.type = 'income'"
          >
            <span>💰</span> 收入
          </button>
          <button
            type="button"
            :class="['type-btn', formData.type === 'expense' ? 'active' : '']"
            @click="formData.type = 'expense'"
          >
            <span>💸</span> 支出
          </button>
        </div>
      </div>

      <div class="form-group">
        <label>金额</label>
        <input
          type="number"
          v-model.number="formData.amount"
          step="0.01"
          min="0.01"
          required
          placeholder="请输入金额"
        />
      </div>

      <div class="form-group">
        <label>分类</label>
        <select v-model="formData.category" required>
          <option value="">请选择分类</option>
          <option
            v-for="cat in filteredCategories"
            :key="cat.id"
            :value="cat.id"
          >
            {{ cat.icon }} {{ cat.name }}
          </option>
        </select>
      </div>

      <div class="form-group">
        <label>日期</label>
        <input
          type="date"
          v-model="formData.date"
          required
        />
      </div>

      <div class="form-group">
        <label>备注（可选，最多100字）</label>
        <textarea
          v-model="formData.note"
          maxlength="100"
          rows="3"
          placeholder="添加备注信息"
        ></textarea>
        <div class="char-count">{{ formData.note.length }}/100</div>
      </div>

      <div class="form-actions">
        <button type="submit" class="btn btn-primary" :disabled="loading">
          {{ loading ? '提交中...' : (editing ? '更新' : '添加') }}
        </button>
        <button
          v-if="editing"
          type="button"
          class="btn btn-secondary"
          @click="$emit('cancel')"
        >
          取消
        </button>
      </div>
    </form>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { getTodayDate } from '../utils/date'

const props = defineProps({
  categories: {
    type: Array,
    default: () => []
  },
  editing: {
    type: Boolean,
    default: false
  },
  transaction: {
    type: Object,
    default: null
  }
})

const emit = defineEmits(['submit', 'cancel'])

const loading = ref(false)
const formData = ref({
  type: 'expense',
  amount: '',
  category: '',
  date: getTodayDate(),
  note: ''
})

// 根据类型过滤分类
const filteredCategories = computed(() => {
  return props.categories.filter(cat => cat.type === formData.value.type)
})

// 编辑时填充表单
watch(() => props.transaction, (transaction) => {
  if (transaction) {
    formData.value = {
      type: transaction.type,
      amount: transaction.amount,
      category: transaction.category,
      date: transaction.date,
      note: transaction.note || ''
    }
  }
}, { immediate: true })

// 重置表单
const resetForm = () => {
  formData.value = {
    type: 'expense',
    amount: '',
    category: '',
    date: getTodayDate(),
    note: ''
  }
}

// 提交表单
const handleSubmit = async () => {
  if (!formData.value.amount || formData.value.amount <= 0) {
    alert('请输入有效的金额')
    return
  }

  loading.value = true
  try {
    await emit('submit', { ...formData.value })
    if (!props.editing) {
      resetForm()
    }
  } finally {
    loading.value = false
  }
}

defineExpose({ resetForm })
</script>

<style scoped>
.transaction-form {
  background: white;
  padding: 2rem;
  border-radius: 12px;
  box-shadow: 0 2px 10px rgba(0,0,0,0.1);
}

.transaction-form h3 {
  margin-bottom: 1.5rem;
  color: #333;
  font-size: 1.5rem;
}

.form-group {
  margin-bottom: 1.5rem;
}

.form-group label {
  display: block;
  margin-bottom: 0.5rem;
  color: #666;
  font-weight: 500;
}

.type-buttons {
  display: flex;
  gap: 1rem;
}

.type-btn {
  flex: 1;
  padding: 1rem;
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  background: white;
  cursor: pointer;
  transition: all 0.3s;
  font-size: 1rem;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
}

.type-btn:hover {
  border-color: #667eea;
  background: #f8f9ff;
}

.type-btn.active {
  border-color: #667eea;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.type-btn span {
  font-size: 1.2rem;
}

input[type="number"],
input[type="date"],
select,
textarea {
  width: 100%;
  padding: 0.75rem;
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  font-size: 1rem;
  transition: border-color 0.3s;
}

input:focus,
select:focus,
textarea:focus {
  outline: none;
  border-color: #667eea;
}

textarea {
  resize: vertical;
  font-family: inherit;
}

.char-count {
  text-align: right;
  color: #999;
  font-size: 0.875rem;
  margin-top: 0.25rem;
}

.form-actions {
  display: flex;
  gap: 1rem;
  margin-top: 2rem;
}

.btn {
  flex: 1;
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 8px;
  font-size: 1rem;
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
</style>

