<template>
  <div class="repo-status-simple">
    <div v-if="loading" class="loading">加载仓库状态中...</div>
    <div v-else-if="error" class="error">{{ error }}</div>
    <div v-else class="repo-list">
      <div
        v-for="repo in repositories"
        :key="repo.name"
        class="repo-item"
        :class="{ 'status-error': repo.status === 'error', 'status-success': repo.status === 'success' }"
      >
        <div class="repo-header">
          <h4 class="repo-name">
            <a :href="repo.originalUrl" target="_blank" rel="noopener noreferrer">
              {{ repo.name }}
            </a>
            <span class="status-badge" :class="`status-${repo.status}`">
            </span>
          </h4>
          <div class="repo-tags">
            <span
              v-for="tag in repo.tags"
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
        </div>
        
        <div class="repo-url">
          <code class="url-code">{{ repo.repositoryUrl || repo.originalUrl }}</code>
          <button
            @click="copyToClipboard(repo.repositoryUrl || repo.originalUrl)"
            class="copy-btn"
            title="复制镜像地址"
          >
            复制
          </button>
        </div>
        
        <div class="repo-stats">
          <span class="success-rate">成功率: {{ repo.successRate }}%</span>
          <span class="last-update">{{ formatDate(repo.timestamp) }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'

const repositories = ref([])
const loading = ref(true)
const error = ref('')

const fetchRepositories = async () => {
  try {
    const response = await fetch('/repository-status.json')
    if (!response.ok) {
      throw new Error('Failed to fetch repository data')
    }
    const data = await response.json()
    repositories.value = data
  } catch (err) {
    error.value = '无法加载仓库数据'
    console.error('Error fetching repositories:', err)
    repositories.value = []
  } finally {
    loading.value = false
  }
}

const formatDate = (timestamp) => {
  return new Date(timestamp).toLocaleString('zh-CN', {
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

onMounted(() => {
  fetchRepositories()
})
</script>

<style scoped>
.repo-status-simple {
  margin: 20px 0;
}

.loading, .error {
  text-align: center;
  padding: 20px;
  color: #666;
}

.error {
  color: #f56565;
}

.repo-list {
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.repo-item {
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 15px;
  background: #f9fafb;
  transition: border-color 0.2s ease;
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

.repo-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.tag {
  padding: 2px 6px;
  border-radius: 8px;
  font-size: 11px;
  font-weight: 500;
  background: #e2e8f0;
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
