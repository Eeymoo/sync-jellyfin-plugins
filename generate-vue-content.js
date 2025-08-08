const fs = require('fs');
const path = require('path');

// 读取原始数据
const originalManifest = JSON.parse(fs.readFileSync('./original-manifest-list.json', 'utf8'));

// 模拟状态数据
const repositoryStatusData = originalManifest.map(item => ({
    name: item.name,
    originalUrl: item.repositoryUrl,
    repositoryUrl: `https://jellyfin-mirror.oss-cn-wuhan-lr.aliyuncs.com/${formatName(item.name)}/manifest.json`,
    timestamp: new Date().toISOString(),
    status: 'success',
    tags: item.tags || [],
    successRate: 95,
    statusHistory: Array(60).fill().map((_, i) => ({
        timestamp: new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString(),
        status: Math.random() > 0.1 ? 'success' : 'error'
    }))
}));

function formatName(name) {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '_');
}

function generateVueComponentContent(repositoryStatusData) {
    const repoItemsContent = repositoryStatusData.map(repo => {
        return `    <RepoItem
      :name="${escapeString(repo.name)}"
      :original-url="${escapeString(repo.originalUrl)}"
      :repository-url="${escapeString(repo.repositoryUrl)}"
      :timestamp="${escapeString(repo.timestamp)}"
      :status="${escapeString(repo.status)}"
      :tags='${JSON.stringify(repo.tags)}'
      :success-rate="${repo.successRate}"
    />`;
    }).join('\n');

    return `<template>
  <div class="repo-status-list">
${repoItemsContent}
  </div>
</template>

<script setup>
import RepoItem from './.vitepress/components/RepoItem.vue'
</script>

<style scoped>
.repo-status-list {
  margin: 20px 0;
}
</style>`;
}

function escapeString(str) {
    return String(str || '').replace(/"/g, '&quot;').replace(/'/g, '&#x27;');
}

// 生成 Vue 组件内容
const vueComponentContent = generateVueComponentContent(repositoryStatusData);

// 读取模板文件
const templatePath = './template/get-started.md';
const templateContent = fs.readFileSync(templatePath, 'utf8');

// 替换内容
const updatedContent = templateContent.replace('###########\nRepo List\n###########', vueComponentContent);

// 写入到文档目录
const outputPath = './docs/get-started.md';
fs.writeFileSync(outputPath, updatedContent);

console.log('✅ 成功生成 Vue 组件内容并同步到 get-started.md');
console.log(`生成的组件包含 ${repositoryStatusData.length} 个仓库`);
