<template>
  <div class="category-manager">
    <div class="manager-header">
      <h3>分类管理</h3>
      <button class="btn btn-primary" @click="showAddForm = true">
        + 添加分类
      </button>
    </div>

    <!-- 添加/编辑分类表单 -->
    <div v-if="showAddForm || editingCategory" class="category-form">
      <h4>{{ editingCategory ? '编辑分类' : '添加分类' }}</h4>
      <form @submit.prevent="handleSubmit">
        <div class="form-group">
          <label>类型</label>
          <div class="type-buttons">
            <button
              type="button"
              :class="['type-btn', formData.type === 'income' ? 'active' : '']"
              @click="formData.type = 'income'"
            >
              收入
            </button>
            <button
              type="button"
              :class="['type-btn', formData.type === 'expense' ? 'active' : '']"
              @click="formData.type = 'expense'"
            >
              支出
            </button>
          </div>
        </div>

        <div class="form-group">
          <label>分类名称</label>
          <input
            type="text"
            v-model="formData.name"
            required
            placeholder="请输入分类名称"
            maxlength="20"
          />
        </div>

        <div class="form-group">
          <label>图标（可选）</label>
          <div class="icon-selector">
            <input
              type="text"
              v-model="formData.icon"
              placeholder="输入emoji或文字"
              maxlength="2"
            />
            <div class="icon-preview">
              <span>{{ formData.icon || '📝' }}</span>
            </div>
          </div>
        </div>

        <div class="form-actions">
          <button type="submit" class="btn btn-primary" :disabled="loading">
            {{ loading ? '提交中...' : (editingCategory ? '更新' : '添加') }}
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

    <!-- 分类列表 -->
    <div class="categories-grid">
      <div
        v-for="category in categories"
        :key="category.id"
        class="category-card"
      >
        <div class="category-icon">{{ category.icon }}</div>
        <div class="category-info">
          <div class="category-name">{{ category.name }}</div>
          <div class="category-type">
            {{ category.type === 'income' ? '收入' : '支出' }}
          </div>
        </div>
        <div class="category-actions">
          <button
            class="btn-icon"
            @click="handleEdit(category)"
            title="编辑"
          >
            ✏️
          </button>
          <button
            class="btn-icon"
            @click="handleDelete(category.id)"
            title="删除"
          >
            🗑️
          </button>
        </div>
      </div>
    </div>

    <div v-if="categories.length === 0" class="empty">
      暂无分类，请添加分类
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'

const props = defineProps({
  categories: {
    type: Array,
    default: () => []
  },
  loading: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['add', 'update', 'delete'])

const showAddForm = ref(false)
const editingCategory = ref(null)
const loading = ref(false)

const formData = ref({
  type: 'expense',
  name: '',
  icon: '📝'
})

// 重置表单
const resetForm = () => {
  formData.value = {
    type: 'expense',
    name: '',
    icon: '📝'
  }
  showAddForm.value = false
  editingCategory.value = null
}

// 取消表单
const cancelForm = () => {
  resetForm()
}

// 编辑分类
const handleEdit = (category) => {
  editingCategory.value = category
  formData.value = {
    type: category.type,
    name: category.name,
    icon: category.icon
  }
  showAddForm.value = false
}

// 提交表单
const handleSubmit = async () => {
  if (!formData.value.name.trim()) {
    alert('请输入分类名称')
    return
  }

  loading.value = true
  try {
    if (editingCategory.value) {
      await emit('update', {
        id: editingCategory.value.id,
        ...formData.value
      })
    } else {
      await emit('add', formData.value)
    }
    resetForm()
  } finally {
    loading.value = false
  }
}

// 删除分类
const handleDelete = (id) => {
  if (confirm('确定要删除这个分类吗？删除后相关交易记录的分类信息可能会丢失。')) {
    emit('delete', id)
  }
}

// 监听编辑状态变化
watch(() => props.categories, () => {
  if (editingCategory.value) {
    const category = props.categories.find(c => c.id === editingCategory.value.id)
    if (!category) {
      resetForm()
    }
  }
})
</script>

<style scoped>
.category-manager {
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

.category-form {
  background: #f8f9fa;
  padding: 1.5rem;
  border-radius: 8px;
  margin-bottom: 2rem;
}

.category-form h4 {
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

.type-buttons {
  display: flex;
  gap: 0.5rem;
}

.type-btn {
  flex: 1;
  padding: 0.5rem;
  border: 2px solid #e0e0e0;
  border-radius: 6px;
  background: white;
  cursor: pointer;
  transition: all 0.3s;
}

.type-btn:hover {
  border-color: #667eea;
}

.type-btn.active {
  border-color: #667eea;
  background: #667eea;
  color: white;
}

input[type="text"] {
  width: 100%;
  padding: 0.75rem;
  border: 2px solid #e0e0e0;
  border-radius: 6px;
  font-size: 1rem;
}

input:focus {
  outline: none;
  border-color: #667eea;
}

.icon-selector {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.icon-selector input {
  flex: 1;
}

.icon-preview {
  width: 50px;
  height: 50px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: white;
  border: 2px solid #e0e0e0;
  border-radius: 6px;
  font-size: 1.5rem;
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

.categories-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 1rem;
}

.category-card {
  display: flex;
  align-items: center;
  padding: 1rem;
  background: #f8f9fa;
  border-radius: 8px;
  transition: all 0.3s;
}

.category-card:hover {
  background: #e9ecef;
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(0,0,0,0.1);
}

.category-icon {
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

.category-info {
  flex: 1;
  min-width: 0;
}

.category-name {
  font-weight: 500;
  color: #333;
  margin-bottom: 0.25rem;
}

.category-type {
  font-size: 0.875rem;
  color: #999;
}

.category-actions {
  display: flex;
  gap: 0.25rem;
}

.btn-icon {
  width: 32px;
  height: 32px;
  border: none;
  background: white;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.9rem;
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
  .categories-grid {
    grid-template-columns: 1fr;
  }
}
</style>

