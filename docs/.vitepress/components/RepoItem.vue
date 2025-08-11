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
      <label class="url-label">镜像地址:</label>
      <code class="url-code">{{ repositoryUrl || originalUrl }}</code>
      <button
        @click="copyToClipboard(repositoryUrl || originalUrl)"
        class="copy-btn"
        title="复制镜像地址"
      >
        复制
      </button>
    </div>
    
    <!-- 失败时的提示 -->
    <div v-if="status === 'error'" class="error-notice">
      <div class="error-content">
        <span class="error-icon">⚠️</span>
        <div class="error-text">
          <p><strong>镜像同步失败！</strong>原始链接依然有效，但如果有更新需要等待下次同步成功后才能在镜像中看到。</p>
          <p>您可以直接使用原始地址：</p>
          <div class="original-url-fallback">
            <code class="url-code">{{ originalUrl }}</code>
            <button
              @click="copyToClipboard(originalUrl)"
              class="copy-btn copy-btn-fallback"
              title="复制原始地址"
            >
              复制原始地址
            </button>
          </div>
        </div>
      </div>
    </div>
    
    <!-- 版本特定链接 -->
    <div v-if="parsedVersionUrls && Object.keys(parsedVersionUrls).length > 0" class="version-section">
      <details class="version-details">
        <summary class="version-summary">查看不同 Jellyfin 版本的链接</summary>
        <div class="version-content">
          <div v-for="(urls, version) in parsedVersionUrls" :key="version" class="version-item">
            <div class="version-header">
              <div class="version-info">
                <strong>{{ urls.title || `Jellyfin ${version}` }}</strong>
                <span class="version-desc">{{ urls.description }}</span>
              </div>
              <code class="curl-example">curl -A "Jellyfin-Server/{{ version }}" {{ originalUrl }} -L</code>
            </div>
            <div class="version-links">
              <div class="version-link">
                <span class="link-type">翻译版:</span>
                <code class="url-code-small">{{ urls.translated }}</code>
                <button @click="copyToClipboard(urls.translated)" class="copy-btn-small">复制</button>
              </div>
              <div class="version-link">
                <span class="link-type">原始版:</span>
                <code class="url-code-small">{{ urls.original }}</code>
                <button @click="copyToClipboard(urls.original)" class="copy-btn-small">复制</button>
              </div>
            </div>
          </div>
        </div>
      </details>
    </div>
    
    <div class="repo-stats">
      <span class="success-rate">成功率: {{ successRate }}%</span>
      <span class="last-update">{{ formatDate(timestamp) }} (北京时间)</span>
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
  versionUrls: String
})

const parsedVersionUrls = computed(() => {
  try {
    return props.versionUrls ? JSON.parse(props.versionUrls) : {}
  } catch (e) {
    console.warn('Failed to parse versionUrls:', e)
    return {}
  }
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
  margin-bottom: 10px;
  flex-wrap: wrap;
}

.url-label {
  font-size: 12px;
  color: #718096;
  font-weight: 500;
  min-width: 70px;
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
  min-width: 200px;
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

.error-notice {
  margin: 10px 0;
  padding: 12px;
  background: #fff5f5;
  border: 1px solid #fed7d7;
  border-radius: 6px;
  border-left: 4px solid #f56565;
}

.error-content {
  display: flex;
  gap: 8px;
  align-items: flex-start;
}

.error-icon {
  font-size: 16px;
  flex-shrink: 0;
}

.error-text {
  flex: 1;
}

.error-text p {
  margin: 0 0 8px 0;
  font-size: 12px;
  color: #c53030;
  line-height: 1.4;
}

.error-text p:last-child {
  margin-bottom: 0;
}

.original-url-fallback {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 6px;
  flex-wrap: wrap;
}

.copy-btn-fallback {
  padding: 4px 8px;
  background: #e53e3e;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 11px;
  transition: background 0.2s ease;
}

.copy-btn-fallback:hover {
  background: #c53030;
}

.version-section {
  margin-top: 15px;
  border-top: 1px solid #e2e8f0;
  padding-top: 10px;
}

.version-details {
  margin: 0;
}

.version-summary {
  cursor: pointer;
  font-size: 13px;
  color: #4a5568;
  font-weight: 500;
  padding: 5px 0;
  user-select: none;
}

.version-summary:hover {
  color: #2d3748;
}

.version-content {
  margin-top: 10px;
}

.version-item {
  margin-bottom: 15px;
  padding: 12px;
  background: #f8f9fa;
  border-radius: 6px;
  border: 1px solid #e9ecef;
}

.version-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 8px;
  flex-wrap: wrap;
  gap: 8px;
}

.version-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.version-desc {
  font-size: 11px;
  color: #6c757d;
  font-weight: normal;
  line-height: 1.3;
}

.curl-example {
  font-size: 10px;
  color: #6c757d;
  background: #ffffff;
  padding: 2px 6px;
  border-radius: 3px;
  border: 1px solid #dee2e6;
}

.version-links {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.version-link {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.link-type {
  font-size: 11px;
  color: #6c757d;
  min-width: 50px;
  font-weight: 500;
}

.url-code-small {
  flex: 1;
  padding: 4px 6px;
  background: #ffffff;
  border: 1px solid #dee2e6;
  border-radius: 3px;
  font-size: 10px;
  font-family: 'Courier New', monospace;
  color: #495057;
  word-break: break-all;
  min-width: 150px;
}

.copy-btn-small {
  padding: 4px 6px;
  background: #6c757d;
  color: white;
  border: none;
  border-radius: 3px;
  cursor: pointer;
  font-size: 10px;
  transition: background 0.2s ease;
}

.copy-btn-small:hover {
  background: #495057;
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

.dark .error-notice {
  background: #2d1b1b;
  border-color: #c53030;
}

.dark .error-text p {
  color: #fed7d7;
}

.dark .copy-btn-fallback {
  background: #c53030;
}

.dark .copy-btn-fallback:hover {
  background: #9c2626;
}
</style>
