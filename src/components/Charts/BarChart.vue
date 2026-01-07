<template>
  <div class="bar-chart">
    <h4>{{ title }}</h4>
    <div ref="chartRef" class="chart-container"></div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch, onBeforeUnmount } from 'vue'
import * as echarts from 'echarts'

const props = defineProps({
  data: {
    type: Array,
    default: () => []
  },
  title: {
    type: String,
    default: '月度对比'
  }
})

const chartRef = ref(null)
let chartInstance = null

const initChart = () => {
  if (!chartRef.value) return

  chartInstance = echarts.init(chartRef.value)

  const months = props.data.map(item => item.month)
  const incomeData = props.data.map(item => item.income || 0)
  const expenseData = props.data.map(item => item.expense || 0)

  const option = {
    tooltip: {
      trigger: 'axis',
      axisPointer: {
        type: 'shadow'
      },
      formatter: (params) => {
        let result = `${params[0].axisValue}<br/>`
        params.forEach(param => {
          result += `${param.seriesName}: ¥${param.value.toFixed(2)}<br/>`
        })
        return result
      }
    },
    legend: {
      data: ['收入', '支出'],
      top: 10
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      data: months,
      axisLabel: {
        rotate: 45
      }
    },
    yAxis: {
      type: 'value',
      axisLabel: {
        formatter: (value) => {
          if (value >= 10000) {
            return (value / 10000).toFixed(1) + '万'
          } else if (value >= 1000) {
            return (value / 1000).toFixed(1) + 'K'
          }
          return value
        }
      }
    },
    series: [
      {
        name: '收入',
        type: 'bar',
        data: incomeData,
        itemStyle: {
          color: '#27ae60'
        }
      },
      {
        name: '支出',
        type: 'bar',
        data: expenseData,
        itemStyle: {
          color: '#e74c3c'
        }
      }
    ]
  }

  chartInstance.setOption(option)

  // 响应式调整
  window.addEventListener('resize', () => {
    chartInstance?.resize()
  })
}

watch(() => props.data, () => {
  if (chartInstance && props.data.length > 0) {
    const months = props.data.map(item => item.month)
    const incomeData = props.data.map(item => item.income || 0)
    const expenseData = props.data.map(item => item.expense || 0)

    const option = {
      xAxis: {
        data: months
      },
      series: [
        { data: incomeData },
        { data: expenseData }
      ]
    }
    chartInstance.setOption(option)
  }
}, { deep: true })

onMounted(() => {
  if (props.data.length > 0) {
    initChart()
  }
})

onBeforeUnmount(() => {
  if (chartInstance) {
    chartInstance.dispose()
    chartInstance = null
  }
  window.removeEventListener('resize', () => {
    chartInstance?.resize()
  })
})
</script>

<style scoped>
.bar-chart {
  background: white;
  padding: 1.5rem;
  border-radius: 12px;
  box-shadow: 0 2px 10px rgba(0,0,0,0.1);
}

.bar-chart h4 {
  margin-bottom: 1rem;
  color: #333;
  font-size: 1.2rem;
}

.chart-container {
  width: 100%;
  height: 400px;
}

@media (max-width: 768px) {
  .chart-container {
    height: 300px;
  }
}
</style>

