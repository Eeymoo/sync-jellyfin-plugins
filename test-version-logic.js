#!/usr/bin/env node

// 简单测试新的版本逻辑
const fs = require('fs');

console.log('🧪 测试版本配置逻辑\n');

// 读取配置文件
const originalManifest = JSON.parse(fs.readFileSync('./original-manifest-list.json', 'utf8'));

console.log('📋 配置检查:');
console.log('=' .repeat(50));

originalManifest.forEach((item, index) => {
    const hasVersionConfig = item.versions && Object.keys(item.versions).length > 0;
    const versions = hasVersionConfig ? Object.keys(item.versions) : [];
    
    console.log(`${index + 1}. ${item.name}`);
    console.log(`   📍 URL: ${item.repositoryUrl}`);
    console.log(`   🏷️  Tags: ${(item.tags || []).join(', ')}`);
    
    if (hasVersionConfig) {
        console.log(`   ✅ 有版本配置 (${versions.length} 个版本):`);
        versions.forEach(version => {
            const versionInfo = item.versions[version];
            console.log(`      - ${version}: ${versionInfo.title}`);
            console.log(`        📝 ${versionInfo.description}`);
        });
        console.log(`   🔗 将生成版本特定的文件: manifest-{version}.json`);
    } else {
        console.log(`   ⚪ 无版本配置`);
        console.log(`   🔗 将使用传统文件名: manifest.json`);
    }
    
    console.log('');
});

console.log(`📊 总结:`);
console.log(`   总仓库数: ${originalManifest.length}`);
console.log(`   有版本配置: ${originalManifest.filter(item => item.versions && Object.keys(item.versions).length > 0).length}`);
console.log(`   无版本配置: ${originalManifest.filter(item => !item.versions || Object.keys(item.versions).length === 0).length}`);
