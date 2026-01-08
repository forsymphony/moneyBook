<template>
  <div class="transactions-page">
    <div class="page-header">
      <h2>交易记录</h2>
      <button class="btn btn-primary" @click="showForm = !showForm">
        {{ showForm ? '取消' : '+ 添加交易' }}
      </button>
    </div>

    <!-- 添加/编辑表单 -->
    <div v-if="showForm" class="form-section">
      <TransactionForm
        :categories="categories"
        :editing="!!editingTransaction"
        :transaction="editingTransaction"
        @submit="handleSubmit"
        @cancel="cancelForm"
      />
    </div>

    <!-- 交易列表 -->
    <TransactionList
      :transactions="transactions"
      :categories="categories"
      :loading="loading"
      @month-change="handleMonthChange"
      @edit="handleEdit"
      @delete="handleDelete"
    />

    <!-- 分类管理 -->
    <div class="category-section">
      <h3>分类管理</h3>
      <CategoryManager
        :categories="categories"
        :loading="categoryLoading"
        @add="handleAddCategory"
        @update="handleUpdateCategory"
        @delete="handleDeleteCategory"
      />
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { transactionAPI, categoryAPI } from '../api'
import { getCurrentMonth } from '../utils/date'
import TransactionForm from '../components/TransactionForm.vue'
import TransactionList from '../components/TransactionList.vue'
import CategoryManager from '../components/CategoryManager.vue'

const loading = ref(false)
const categoryLoading = ref(false)
const showForm = ref(false)
const editingTransaction = ref(null)
const categories = ref([])
const transactions = ref([])
const currentMonth = ref(getCurrentMonth())

// 加载分类
const loadCategories = async () => {
  try {
    categories.value = await categoryAPI.getCategories()
  } catch (error) {
    console.error('加载分类失败:', error)
    alert('加载分类失败')
  }
}

// 加载交易记录
const loadTransactions = async (month) => {
  loading.value = true
  try {
    transactions.value = await transactionAPI.getTransactions(month)
  } catch (error) {
    console.error('加载交易记录失败:', error)
    alert('加载交易记录失败')
  } finally {
    loading.value = false
  }
}

// 月份变化
const handleMonthChange = (month) => {
  currentMonth.value = month
  loadTransactions(month)
}

// 提交表单（添加或更新）- 使用乐观更新，仅在本地更新
const handleSubmit = async (data) => {
  if (editingTransaction.value) {
    // 更新操作：乐观更新
    const originalMonth = editingTransaction.value.date ? editingTransaction.value.date.substring(0, 7) : currentMonth.value
    const originalIndex = transactions.value.findIndex(t => t.id === editingTransaction.value.id)
    const originalTransaction = transactions.value[originalIndex]
    
    // 1. 立即更新UI（乐观更新）
    if (originalIndex !== -1) {
      transactions.value[originalIndex] = { ...originalTransaction, ...data }
    }
    cancelForm()
    
    // 2. 发送请求到服务器
    try {
      await transactionAPI.updateTransaction(editingTransaction.value.id, data, originalMonth)
      // 3. 成功：UI已更新，仅在本地更新，不重新加载
      // 如果跨月了，需要重新加载当前月份的数据
      if (data.date && data.date.substring(0, 7) !== currentMonth.value) {
        await loadTransactions(currentMonth.value)
      }
    } catch (error) {
      // 4. 失败：回滚UI
      if (originalIndex !== -1) {
        transactions.value[originalIndex] = originalTransaction
      }
      console.error('更新交易失败:', error)
      alert('更新交易失败，请稍后重试')
      throw error
    }
  } else {
    // 添加操作：乐观更新
    // 1. 立即在UI中添加新记录（临时ID）
    const tempId = 'temp_' + Date.now()
    const newTransaction = {
      id: tempId,
      ...data,
      createdAt: new Date().toISOString()
    }
    transactions.value.push(newTransaction)
    cancelForm()
    
    // 2. 发送请求到服务器
    try {
      const savedTransaction = await transactionAPI.addTransaction(data)
      // 3. 成功：用服务器返回的真实记录替换临时记录，仅在本地更新
      const tempIndex = transactions.value.findIndex(t => t.id === tempId)
      if (tempIndex !== -1) {
        transactions.value[tempIndex] = savedTransaction
      }
    } catch (error) {
      // 4. 失败：移除临时记录
      const tempIndex = transactions.value.findIndex(t => t.id === tempId)
      if (tempIndex !== -1) {
        transactions.value.splice(tempIndex, 1)
      }
      console.error('添加交易失败:', error)
      alert('添加交易失败，请稍后重试')
      throw error
    }
  }
}

// 编辑交易
const handleEdit = (transaction) => {
  editingTransaction.value = transaction
  showForm.value = true
}

// 删除交易 - 使用乐观更新，仅在本地更新
const handleDelete = async (id) => {
  // 1. 立即从UI中移除（乐观更新）
  const index = transactions.value.findIndex(t => t.id === id)
  if (index === -1) return
  
  const deletedTransaction = transactions.value[index]
  transactions.value.splice(index, 1)
  
  // 2. 发送请求到服务器
  try {
    await transactionAPI.deleteTransaction(id, currentMonth.value)
    // 3. 成功：UI已更新，仅在本地更新，不重新加载
  } catch (error) {
    // 4. 失败：恢复记录
    transactions.value.splice(index, 0, deletedTransaction)
    console.error('删除交易失败:', error)
    alert('删除交易失败，请稍后重试')
  }
}

// 取消表单
const cancelForm = () => {
  showForm.value = false
  editingTransaction.value = null
}

// 添加分类
const handleAddCategory = async (data) => {
  categoryLoading.value = true
  try {
    await categoryAPI.addCategory(data)
    await loadCategories()
  } catch (error) {
    console.error('添加分类失败:', error)
    alert('添加分类失败')
    throw error
  } finally {
    categoryLoading.value = false
  }
}

// 更新分类（实际上分类API没有更新接口，这里可以扩展）
const handleUpdateCategory = async (data) => {
  // 如果需要更新分类，可以先删除再添加
  // 或者扩展API支持更新
  console.log('更新分类:', data)
}

// 删除分类
const handleDeleteCategory = async (id) => {
  categoryLoading.value = true
  try {
    await categoryAPI.deleteCategory(id)
    await loadCategories()
  } catch (error) {
    console.error('删除分类失败:', error)
    alert('删除分类失败')
  } finally {
    categoryLoading.value = false
  }
}

onMounted(() => {
  loadCategories()
  loadTransactions(currentMonth.value)
})
</script>

<style scoped>
.transactions-page {
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

.btn {
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

.btn-primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 5px 15px rgba(102, 126, 234, 0.4);
}

.form-section {
  background: white;
  padding: 2rem;
  border-radius: 12px;
  box-shadow: 0 2px 10px rgba(0,0,0,0.1);
}

.category-section {
  background: white;
  padding: 2rem;
  border-radius: 12px;
  box-shadow: 0 2px 10px rgba(0,0,0,0.1);
}

.category-section h3 {
  margin-bottom: 1.5rem;
  color: #333;
  font-size: 1.5rem;
}

@media (max-width: 768px) {
  .page-header {
    flex-direction: column;
    gap: 1rem;
    align-items: stretch;
  }

  .btn {
    width: 100%;
  }
}
</style>

