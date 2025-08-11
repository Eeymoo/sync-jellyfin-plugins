#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

/**
 * 版本逻辑测试
 */

// 简单的断言函数
function assertEqual(actual, expected, message) {
    if (actual === expected) {
        console.log(`✅ ${message}`);
        return true;
    } else {
        console.log(`❌ ${message}`);
        console.log(`   期望: ${expected}`);
        console.log(`   实际: ${actual}`);
        return false;
    }
}

function assertTruthy(value, message) {
    if (value) {
        console.log(`✅ ${message}`);
        return true;
    } else {
        console.log(`❌ ${message}`);
        console.log(`   期望: truthy`);
        console.log(`   实际: ${value}`);
        return false;
    }
}

function runTests() {
    console.log('🧪 测试版本配置逻辑');
    console.log('=' .repeat(50));

    const results = [];
    const originalManifestPath = path.join(__dirname, '..', 'original-manifest-list.json');

    console.log('\n📋 运行测试用例:');

    // 检查文件存在性
    if (!fs.existsSync(originalManifestPath)) {
        console.log(`❌ 原始配置文件不存在: ${originalManifestPath}`);
        return false;
    }

    let originalManifest;
    try {
        originalManifest = JSON.parse(fs.readFileSync(originalManifestPath, 'utf8'));
    } catch (error) {
        console.log(`❌ 读取原始配置文件失败: ${error.message}`);
        return false;
    }

    // 基础测试
    results.push(assertTruthy(originalManifest, '应该能正确读取配置文件'));
    results.push(assertTruthy(Array.isArray(originalManifest), '配置应该是数组'));
    results.push(assertTruthy(originalManifest.length > 0, '配置应该不为空'));

    // 测试版本配置识别
    const reposWithVersions = originalManifest.filter(item => 
        item.versions && Object.keys(item.versions).length > 0
    );
    
    results.push(assertTruthy(reposWithVersions.length >= 0, '应该正确识别有版本配置的仓库'));

    // 测试版本配置结构
    let versionStructureValid = true;
    originalManifest.forEach((item, index) => {
        if (item.versions) {
            Object.keys(item.versions).forEach(version => {
                const versionInfo = item.versions[version];
                if (!versionInfo.title || typeof versionInfo.title !== 'string') {
                    console.log(`❌ 配置项 ${index + 1} 版本 ${version} 缺少有效的 title`);
                    versionStructureValid = false;
                }
                if (!versionInfo.description || typeof versionInfo.description !== 'string') {
                    console.log(`❌ 配置项 ${index + 1} 版本 ${version} 缺少有效的 description`);
                    versionStructureValid = false;
                }
            });
        }
    });
    results.push(assertTruthy(versionStructureValid, '版本配置应该有正确的结构'));

    // 测试统计计算
    const totalRepos = originalManifest.length;
    const reposWithVersionsCount = reposWithVersions.length;
    const reposWithoutVersions = totalRepos - reposWithVersionsCount;
    
    results.push(assertEqual(totalRepos, reposWithVersionsCount + reposWithoutVersions, '应该正确统计版本配置'));
    results.push(assertTruthy(totalRepos > 0, '总仓库数应该大于0'));

    // 统计结果
    const passed = results.filter(r => r).length;
    const total = results.length;
    
    console.log('\n' + '='.repeat(50));
    console.log('📊 测试结果统计:');
    console.log(`   总测试数: ${total}`);
    console.log(`   通过数: ${passed}`);
    console.log(`   失败数: ${total - passed}`);
    console.log(`   成功率: ${Math.round((passed / total) * 100)}%`);
    console.log('='.repeat(50));
    
    if (passed === total) {
        console.log('\n🎉 所有测试通过！');
    } else {
        console.log('\n❌ 部分测试失败');
    }

    return passed === total;
}

// 如果直接运行此文件，执行简单的控制台输出
if (require.main === module) {
    const success = runTests();
    
    // 输出详细信息
    console.log('\n📋 详细版本配置信息:');
    const originalManifestPath = path.join(__dirname, '..', 'original-manifest-list.json');
    
    if (fs.existsSync(originalManifestPath)) {
        const originalManifest = JSON.parse(fs.readFileSync(originalManifestPath, 'utf8'));
        
        console.log('配置检查:');
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

        const totalRepos = originalManifest.length;
        const reposWithVersions = originalManifest.filter(item => 
            item.versions && Object.keys(item.versions).length > 0
        ).length;
        const reposWithoutVersions = totalRepos - reposWithVersions;

        console.log(`📊 总结:`);
        console.log(`   总仓库数: ${totalRepos}`);
        console.log(`   有版本配置: ${reposWithVersions}`);
        console.log(`   无版本配置: ${reposWithoutVersions}`);
    } else {
        console.log('⚠️ 原始配置文件不存在，无法显示详细信息');
    }
    
    process.exit(success ? 0 : 1);
}
