<template>
  <div 
    class="repository-card"
    :class="{ 'status-error': status === 'error', 'status-success': status === 'success' }"
  >
    <div class="repo-header">
      <h3 class="repo-name">
        <a :href="originalUrl" target="_blank" rel="noopener noreferrer">
          {{ name }}
        </a>
      </h3>
      <div class="repo-status" :class="`status-${status}`">
      </div>
    </div>
    
    <div class="repo-tags" v-if="parsedTags && parsedTags.length > 0">
      <span
        v-for="tag in parsedTags"
        :key="tag"
        class="tag"
        :class="{
          'tag-official': tag === 'official',
          'tag-community': tag === 'official-community',
          'tag-stable': tag === 'stable',
          'tag-beta': tag === 'beta' || tag === 'unstable'
        }"
      >
        {{ tag }}
      </span>
    </div>

    <div class="repo-info">
      <p class="last-update">最后更新: {{ formatDate(timestamp) }} (北京时间)</p>
      <div class="repo-url">
        <input
          :value="repositoryUrl || originalUrl"
          readonly
          class="url-input"
        />
        <button
          @click="copyToClipboard(repositoryUrl || originalUrl)"
          class="copy-btn"
        >
          复制
        </button>
      </div>
    </div>

    <div class="status-history" v-if="parsedStatusHistory && parsedStatusHistory.length > 0">
      <h4>最近状态 (最多60次) - 时间为北京时间</h4>
      <div class="history-chart">
        <div
          v-for="(record, index) in parsedStatusHistory.slice(0, 60)"
          :key="index"
          class="history-dot"
          :class="`status-${record.status}`"
          :title="`${formatDate(record.timestamp)} (北京时间): ${record.status}${record.error ? ' - ' + record.error : ''}`"
        ></div>
      </div>
      <div class="history-stats">
        <span class="success-rate">
          成功率: {{ successRate || calculateSuccessRate(parsedStatusHistory) }}%
        </span>
        <span class="total-checks">
          总检查次数: {{ parsedStatusHistory.length }}
        </span>
      </div>
    </div>
    
    <div v-if="lastError" class="last-error">
      <strong>最近错误:</strong> {{ lastError }}
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  name: String,
  originalUrl: String,
  repositoryUrl: String,
  timestamp: String,
  status: String,
  successRate: Number,
  tags: String,
  statusHistory: String,
  lastError: String
})

// 解析 JSON 字符串为数组
const parsedTags = computed(() => {
  try {
    return props.tags ? JSON.parse(props.tags) : []
  } catch (e) {
    console.warn('Failed to parse tags:', e)
    return []
  }
})

const parsedStatusHistory = computed(() => {
  try {
    return props.statusHistory ? JSON.parse(props.statusHistory) : []
  } catch (e) {
    console.warn('Failed to parse statusHistory:', e)
    return []
  }
})

const formatDate = (timestamp) => {
  // 将时间转换为北京时间显示
  return new Date(timestamp).toLocaleString('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

const copyToClipboard = async (text) => {
  try {
    await navigator.clipboard.writeText(text)
    alert('URL 已复制到剪贴板')
  } catch (err) {
    console.error('Failed to copy text: ', err)
    // 降级方案
    const textArea = document.createElement('textarea')
    textArea.value = text
    document.body.appendChild(textArea)
    textArea.focus()
    textArea.select()
    try {
      document.execCommand('copy')
      alert('URL 已复制到剪贴板')
    } catch (fallbackErr) {
      console.error('Fallback copy failed: ', fallbackErr)
    }
    document.body.removeChild(textArea)
  }
}

const calculateSuccessRate = (history) => {
  if (!history || history.length === 0) return 0
  const successCount = history.filter(record => record.status === 'success').length
  return Math.round((successCount / history.length) * 100)
}
</script>

<style scoped>
.repository-card {
  border: 2px solid #e2e8f0;
  border-radius: 12px;
  padding: 20px;
  background: #ffffff;
  transition: all 0.3s ease;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  margin-bottom: 20px;
}

.repository-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.repository-card.status-success {
  border-color: #48bb78;
}

.repository-card.status-error {
  border-color: #f56565;
}

.repo-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
}

.repo-name {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
}

.repo-name a {
  color: #2d3748;
  text-decoration: none;
  transition: color 0.2s ease;
}

.repo-name a:hover {
  color: #3182ce;
}

.repo-status {
  width: 20px;
  height: 20px;
  border-radius: 4px;
  background: #cbd5e0;
}

.repo-status.status-success {
  background: #48bb78;
}

.repo-status.status-error {
  background: #f56565;
}

.repo-tags {
  margin-bottom: 15px;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.tag {
  padding: 4px 8px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
  background: #edf2f7;
  color: #4a5568;
}

.tag-official {
  background: #bee3f8;
  color: #2c5282;
}

.tag-community {
  background: #c6f6d5;
  color: #276749;
}

.tag-stable {
  background: #d4edda;
  color: #155724;
}

.tag-beta {
  background: #ffeaa7;
  color: #856404;
}

.repo-info {
  margin-bottom: 20px;
}

.last-update {
  margin: 0 0 10px 0;
  color: #718096;
  font-size: 14px;
}

.repo-url {
  display: flex;
  gap: 8px;
}

.url-input {
  flex: 1;
  padding: 8px 12px;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  font-size: 12px;
  background: #f7fafc;
  color: #4a5568;
}

.copy-btn {
  padding: 8px 16px;
  background: #3182ce;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 12px;
  font-weight: 500;
  transition: background 0.2s ease;
}

.copy-btn:hover {
  background: #2c5282;
}

.status-history h4 {
  margin: 0 0 10px 0;
  font-size: 14px;
  color: #4a5568;
}

.history-chart {
  display: flex;
  flex-wrap: wrap;
  gap: 3px;
  margin-bottom: 10px;
  min-height: 20px;
}

.history-dot {
  width: 12px;
  height: 12px;
  border-radius: 2px;
  cursor: help;
}

.history-dot.status-success {
  background: #48bb78;
}

.history-dot.status-error {
  background: #f56565;
}

.history-stats {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  color: #718096;
}

.success-rate {
  font-weight: 500;
}

.last-error {
  margin-top: 8px;
  padding: 8px;
  background: #fed7d7;
  border: 1px solid #fc8181;
  border-radius: 4px;
  font-size: 12px;
  color: #c53030;
}

/* 暗色主题支持 */
.dark .repository-card {
  background: #2d3748;
  border-color: #4a5568;
}

.dark .repo-name a {
  color: #e2e8f0;
}

.dark .repo-name a:hover {
  color: #90cdf4;
}

.dark .url-input {
  background: #4a5568;
  border-color: #718096;
  color: #e2e8f0;
}
</style>
