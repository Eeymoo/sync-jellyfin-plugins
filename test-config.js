const fs = require('fs');

function calculateSuccessRate(history) {
    if (!history || history.length === 0) return 0;
    const successCount = history.filter(record => record.status === 'success').length;
    return Math.round((successCount / history.length) * 100);
}

console.log('=== 原始配置中的 tags ===');
const originalManifest = JSON.parse(fs.readFileSync('./original-manifest-list.json', 'utf8'));
originalManifest.forEach(item => {
    console.log(`- ${item.name}: ${item.tags ? item.tags.join(', ') : '无标签'}`);
});

if (fs.existsSync('./manifest-list.json')) {
    console.log('\n=== 现有配置检查 ===');
    const existingManifest = JSON.parse(fs.readFileSync('./manifest-list.json', 'utf8'));
    console.log(`共 ${existingManifest.length} 个仓库`);
    
    existingManifest.forEach(item => {
        const successRate = calculateSuccessRate(item.statusHistory);
        const historyCount = item.statusHistory ? item.statusHistory.length : 0;
        console.log(`- ${item.name}: ${item.tags ? item.tags.join(', ') : '无'} (成功率: ${successRate}%, 历史记录: ${historyCount}条)`);
    });
} else {
    console.log('\n现有 manifest-list.json 不存在');
}
