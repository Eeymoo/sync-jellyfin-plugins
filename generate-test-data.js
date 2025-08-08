const fs = require('fs');
const path = require('path');

// 确保目录存在
const docsPublicDir = './docs/public';
if (!fs.existsSync(docsPublicDir)) {
    fs.mkdirSync(docsPublicDir, { recursive: true });
}

// 读取原始配置
const originalManifest = JSON.parse(fs.readFileSync('./original-manifest-list.json', 'utf8'));

// 生成测试数据
const testData = originalManifest.map((item, index) => {
    const successCount = Math.floor(Math.random() * 50) + 10;
    const errorCount = Math.floor(Math.random() * 10);
    const total = successCount + errorCount;
    
    // 生成历史记录
    const history = [];
    for (let i = 0; i < total && i < 60; i++) {
        const timestamp = new Date(Date.now() - i * 60 * 60 * 1000).toISOString();
        const status = i < errorCount ? 'error' : 'success';
        const error = status === 'error' ? ['Connection timeout', 'HTTP 404', 'Network error', 'Rate limit'][Math.floor(Math.random() * 4)] : null;
        history.push({ timestamp, status, error });
    }
    
    return {
        name: item.name,
        originalUrl: item.repositoryUrl,
        repositoryUrl: index % 3 === 2 ? '' : `https://jellyfin-mirror.oss-cn-wuhan-lr.aliyuncs.com/plugins/${item.name.replace(/[^\w]/g, '_')}/manifest.json`,
        timestamp: new Date().toISOString(),
        status: Math.random() > 0.2 ? 'success' : 'error',
        tags: item.tags || [],
        statusHistory: history,
        successRate: Math.round((successCount / total) * 100),
        lastError: errorCount > 0 ? history.find(h => h.status === 'error')?.error : null
    };
});

// 按优先级排序
testData.sort((a, b) => {
    const getPriority = (tags) => {
        if (tags.includes('official')) return 0;
        if (tags.includes('official-community')) return 1;
        return 2;
    };
    return getPriority(a.tags) - getPriority(b.tags);
});

fs.writeFileSync(path.join(docsPublicDir, 'repository-status.json'), JSON.stringify(testData, null, 2));
console.log('测试数据已生成到 ./docs/public/repository-status.json');
console.log('共', testData.length, '个仓库');
console.log('官方仓库:', testData.filter(d => d.tags.includes('official')).length);
console.log('官方社区仓库:', testData.filter(d => d.tags.includes('official-community')).length);
