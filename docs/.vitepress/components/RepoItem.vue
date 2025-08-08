<template>
  <div 
    class="repo-item"
    :class="{ 'status-error': status === 'error', 'status-success': status === 'success' }"
  >
    <div class="repo-header">
      <h4 class="repo-name">
        <a :href="originalUrl" target="_blank" rel="noopener noreferrer">
          {{ name }}
        </a>
        <span class="status-badge" :class="`status-${status}`"></span>
      </h4>
    </div>
    
    <div class="repo-url">
      <code class="url-code">{{ repositoryUrl || originalUrl }}</code>
      <button
        @click="copyToClipboard(repositoryUrl || originalUrl)"
        class="copy-btn"
        title="复制镜像地址"
      >
        复制
      </button>
    </div>
    
    <div class="repo-stats">
      <span class="success-rate">成功率: {{ successRate }}%</span>
      <span class="last-update">{{ formatDate(timestamp) }} (北京时间)</span>
    </div>
  </div>
</template>

<script setup>
defineProps({
  name: String,
  originalUrl: String,
  repositoryUrl: String,
  timestamp: String,
  status: String,
  successRate: Number
})

const formatDate = (timestamp) => {
  // 将时间转换为北京时间显示
  return new Date(timestamp).toLocaleString('zh-CN', {
    timeZone: 'Asia/Shanghai',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

const copyToClipboard = async (text) => {
  try {
    await navigator.clipboard.writeText(text)
    alert('镜像地址已复制')
  } catch (err) {
    const textArea = document.createElement('textarea')
    textArea.value = text
    document.body.appendChild(textArea)
    textArea.select()
    document.execCommand('copy')
    document.body.removeChild(textArea)
    alert('镜像地址已复制')
  }
}
</script>

<style scoped>
.repo-item {
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 15px;
  background: #f9fafb;
  transition: border-color 0.2s ease;
  margin-bottom: 15px;
}

.repo-item.status-success {
  border-color: #48bb78;
  background: #f0fff4;
}

.repo-item.status-error {
  border-color: #f56565;
  background: #fffafa;
}

.repo-header {
  margin-bottom: 10px;
}

.repo-name {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 0 0 8px 0;
  font-size: 16px;
  font-weight: 600;
}

.repo-name a {
  color: #2d3748;
  text-decoration: none;
  flex: 1;
}

.repo-name a:hover {
  color: #3182ce;
}

.status-badge {
  width: 16px;
  height: 16px;
  border-radius: 3px;
  background: #cbd5e0;
}

.status-badge.status-success {
  background: #48bb78;
}

.status-badge.status-error {
  background: #f56565;
}

.repo-url {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.url-code {
  flex: 1;
  padding: 6px 8px;
  background: #edf2f7;
  border: 1px solid #e2e8f0;
  border-radius: 4px;
  font-size: 12px;
  font-family: 'Courier New', monospace;
  color: #4a5568;
  word-break: break-all;
}

.copy-btn {
  padding: 6px 8px;
  background: #3182ce;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  transition: background 0.2s ease;
}

.copy-btn:hover {
  background: #2c5282;
}

.repo-stats {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  color: #718096;
}

.success-rate {
  font-weight: 500;
}

/* 暗色主题支持 */
.dark .repo-item {
  background: #2d3748;
  border-color: #4a5568;
}

.dark .repo-item.status-success {
  background: #1a202c;
}

.dark .repo-item.status-error {
  background: #1a202c;
}

.dark .repo-name a {
  color: #e2e8f0;
}

.dark .url-code {
  background: #4a5568;
  border-color: #718096;
  color: #e2e8f0;
}
</style>
