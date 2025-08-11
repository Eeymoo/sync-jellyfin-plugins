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
      
      <!-- 镜像地址 -->
      <div class="repo-url">
        <label class="url-label">镜像地址:</label>
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
      
      <!-- 原始地址 -->
      <div class="repo-url">
        <label class="url-label">原始地址:</label>
        <input
          :value="originalUrl"
          readonly
          class="url-input"
        />
        <button
          @click="copyToClipboard(originalUrl)"
          class="copy-btn"
        >
          复制
        </button>
      </div>
      
      <!-- 不同版本的链接 -->
      <div v-if="parsedVersionUrls && Object.keys(parsedVersionUrls).length > 0" class="version-urls">
        <h4 class="version-title">按 Jellyfin 版本访问:</h4>
        <div v-for="(urls, version) in parsedVersionUrls" :key="version" class="version-group">
          <div class="version-header">
            <div class="version-info">
              <span class="version-name">{{ urls.title || `Jellyfin ${version}` }}</span>
              <span class="version-description">{{ urls.description }}</span>
            </div>
            <span class="version-curl">curl -A "Jellyfin-Server/{{ version }}" {{ originalUrl }} -L</span>
          </div>
          <div class="version-links">
            <div class="version-url">
              <label class="url-label">翻译版本:</label>
              <input
                :value="urls.translated"
                readonly
                class="url-input"
              />
              <button
                @click="copyToClipboard(urls.translated)"
                class="copy-btn copy-btn-small"
              >
                复制
              </button>
            </div>
            <div class="version-url">
              <label class="url-label">原始版本:</label>
              <input
                :value="urls.original"
                readonly
                class="url-input"
              />
              <button
                @click="copyToClipboard(urls.original)"
                class="copy-btn copy-btn-small"
              >
                复制
              </button>
            </div>
          </div>
        </div>
      </div>
      
      <!-- 如果没有版本配置，显示传统的原始文件链接 -->
      <div v-if="!parsedVersionUrls || Object.keys(parsedVersionUrls).length === 0" class="traditional-links">
        <div class="repo-url">
          <label class="url-label">原始文件:</label>
          <input
            :value="repositoryUrl.replace('manifest.json', 'manifest-original.json')"
            readonly
            class="url-input"
          />
          <button
            @click="copyToClipboard(repositoryUrl.replace('manifest.json', 'manifest-original.json'))"
            class="copy-btn"
          >
            复制
          </button>
        </div>
      </div>
    </div>

    <div class="status-history" v-if="parsedStatusHistory && parsedStatusHistory.length > 0">
      <h4>最近状态 (最近60次) - 时间为北京时间</h4>
      <div class="history-chart">
        <div
          v-for="(item, index) in statusGrid"
          :key="index"
          class="history-dot"
          :class="item.isPlaceholder ? 'status-placeholder' : `status-${item.status}`"
          :title="item.isPlaceholder ? '暂无数据' : `${formatDate(item.timestamp)} (北京时间): ${item.status}${item.error ? ' - ' + item.error : ''}`"
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
      <strong>最近错误:</strong> 
      <span class="error-message">{{ lastError }}</span>
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
  lastError: String,
  versionUrls: String
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

const parsedVersionUrls = computed(() => {
  try {
    return props.versionUrls ? JSON.parse(props.versionUrls) : {}
  } catch (e) {
    console.warn('Failed to parse versionUrls:', e)
    return {}
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

// 生成15x4的状态网格，最新数据在后面
const statusGrid = computed(() => {
  const totalSlots = 60
  const history = parsedStatusHistory.value.slice(0, totalSlots)
  const grid = []
  
  // 计算需要填充的灰色占位符数量
  const placeholderCount = Math.max(0, totalSlots - history.length)
  
  // 先添加灰色占位符
  for (let i = 0; i < placeholderCount; i++) {
    grid.push({
      isPlaceholder: true
    })
  }
  
  // 然后添加实际数据（最旧的在前面，最新的在后面）
  const reversedHistory = [...history].reverse()
  for (const record of reversedHistory) {
    grid.push({
      ...record,
      isPlaceholder: false
    })
  }
  
  return grid
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
  display: grid;
  grid-template-columns: repeat(15, 1fr);
  grid-template-rows: repeat(4, 1fr);
  gap: 3px;
  margin-bottom: 10px;
  min-height: 80px;
  max-width: 100%;
}

.history-dot {
  width: 100%;
  height: 18px;
  border-radius: 2px;
  cursor: help;
  aspect-ratio: 1;
}

.history-dot.status-success {
  background: #48bb78;
}

.history-dot.status-error {
  background: #f56565;
}

.history-dot.status-placeholder {
  background: #e2e8f0;
}

.history-stats {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  color: #718096;
}

.version-urls {
  margin-top: 20px;
  padding-top: 15px;
  border-top: 1px solid #e2e8f0;
}

.version-title {
  margin: 0 0 15px 0;
  font-size: 16px;
  color: #2d3748;
  font-weight: 600;
}

.version-group {
  margin-bottom: 20px;
  padding: 15px;
  background: #f8f9fa;
  border-radius: 8px;
  border: 1px solid #e9ecef;
}

.version-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 10px;
  flex-wrap: wrap;
  gap: 10px;
}

.version-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.version-name {
  font-weight: 600;
  color: #495057;
  font-size: 14px;
}

.version-description {
  font-size: 12px;
  color: #6c757d;
  line-height: 1.4;
}

.version-curl {
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 11px;
  color: #6c757d;
  background: #ffffff;
  padding: 4px 8px;
  border-radius: 4px;
  border: 1px solid #dee2e6;
}

.version-links {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.version-url {
  display: flex;
  align-items: center;
  gap: 8px;
}

.url-label {
  font-size: 12px;
  color: #6c757d;
  min-width: 80px;
  font-weight: 500;
}

.copy-btn-small {
  padding: 6px 12px;
  font-size: 11px;
}

@media (max-width: 768px) {
  .version-header {
    flex-direction: column;
    align-items: flex-start;
  }
  
  .version-curl {
    word-break: break-all;
    font-size: 10px;
  }
  
  .version-url {
    flex-direction: column;
    align-items: stretch;
    gap: 5px;
  }
  
  .url-label {
    min-width: auto;
  }
}

.success-rate {
  font-weight: 500;
}

.last-error {
  margin-top: 8px;
  padding: 12px;
  background: #fed7d7;
  border: 1px solid #fc8181;
  border-radius: 6px;
  font-size: 13px;
  color: #c53030;
  border-left: 4px solid #f56565;
}

.error-message {
  font-family: 'Courier New', monospace;
  font-weight: 500;
  display: block;
  margin-top: 4px;
}

.traditional-links {
  margin-top: 15px;
  padding-top: 10px;
  border-top: 1px solid #e2e8f0;
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

.dark .last-error {
  background: #2d1b1b;
  border-color: #c53030;
  color: #fed7d7;
}

.dark .error-message {
  color: #fc8181;
}

.dark .history-dot.status-placeholder {
  background: #4a5568;
}
</style>
