#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

/**
 * 配置文件测试
 */

function calculateSuccessRate(history) {
    if (!history || history.length === 0) return 0;
    const successCount = history.filter(record => record.status === 'success').length;
    return Math.round((successCount / history.length) * 100);
}

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
    console.log('🧪 配置文件测试');
    console.log('=' .repeat(50));

    const results = [];
    const originalManifestPath = path.join(__dirname, '..', 'original-manifest-list.json');
    const manifestPath = path.join(__dirname, '..', 'manifest-list.json');

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

    // 测试原始配置文件
    results.push(assertTruthy(originalManifest, '应该能正确读取原始配置文件'));
    results.push(assertTruthy(Array.isArray(originalManifest), '原始配置应该是数组'));
    results.push(assertTruthy(originalManifest.length > 0, '原始配置应该不为空'));

    // 测试配置文件结构
    let structureValid = true;
    originalManifest.forEach((item, index) => {
        if (!item.name || typeof item.name !== 'string') {
            console.log(`❌ 配置项 ${index + 1} 缺少有效的 name 字段`);
            structureValid = false;
        }
        if (!item.repositoryUrl || typeof item.repositoryUrl !== 'string') {
            console.log(`❌ 配置项 ${index + 1} 缺少有效的 repositoryUrl 字段`);
            structureValid = false;
        }
        if (item.tags && !Array.isArray(item.tags)) {
            console.log(`❌ 配置项 ${index + 1} 的 tags 字段应该是数组`);
            structureValid = false;
        }
        if (item.versions && typeof item.versions !== 'object') {
            console.log(`❌ 配置项 ${index + 1} 的 versions 字段应该是对象`);
            structureValid = false;
        }
    });
    results.push(assertTruthy(structureValid, '配置文件结构应该正确'));

    // 测试标签有效性
    let tagsValid = true;
    originalManifest.forEach((item, index) => {
        if (item.tags) {
            item.tags.forEach((tag, tagIndex) => {
                if (typeof tag !== 'string' || tag.length === 0) {
                    console.log(`❌ 配置项 ${index + 1} 的标签 ${tagIndex + 1} 无效`);
                    tagsValid = false;
                }
            });
        }
    });
    results.push(assertTruthy(tagsValid, '原始配置中的标签应该有效'));

    // 测试成功率计算功能
    const testHistory1 = [
        { status: 'success' },
        { status: 'success' },
        { status: 'error' },
        { status: 'success' }
    ];
    results.push(assertEqual(calculateSuccessRate(testHistory1), 75, '应该正确计算成功率 (75%)'));
    results.push(assertEqual(calculateSuccessRate([]), 0, '空历史应该返回 0% 成功率'));
    results.push(assertEqual(calculateSuccessRate(null), 0, 'null 历史应该返回 0% 成功率'));
    results.push(assertEqual(calculateSuccessRate(undefined), 0, 'undefined 历史应该返回 0% 成功率'));

    // 测试现有配置文件（如果存在）
    if (fs.existsSync(manifestPath)) {
        try {
            const existingManifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
            results.push(assertTruthy(Array.isArray(existingManifest), '现有配置应该是数组'));
            
            let existingStructureValid = true;
            existingManifest.forEach((item, index) => {
                if (!item.name || typeof item.name !== 'string') {
                    console.log(`❌ 现有配置项 ${index + 1} 缺少有效的 name 字段`);
                    existingStructureValid = false;
                }
                if (item.statusHistory && !Array.isArray(item.statusHistory)) {
                    console.log(`❌ 现有配置项 ${index + 1} 的 statusHistory 应该是数组`);
                    existingStructureValid = false;
                }
                if (item.statusHistory) {
                    const successRate = calculateSuccessRate(item.statusHistory);
                    if (successRate < 0 || successRate > 100) {
                        console.log(`❌ 现有配置项 ${index + 1} 的成功率计算异常: ${successRate}`);
                        existureValid = false;
                    }
                }
            });
            results.push(assertTruthy(existingStructureValid, '现有配置文件结构应该正确'));
        } catch (error) {
            console.log(`❌ 读取现有配置文件失败: ${error.message}`);
            results.push(false);
        }
    } else {
        console.log(`⚠️ 现有配置文件不存在，跳过相关测试`);
    }

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
    console.log('\n📋 详细配置信息:');
    console.log('=== 原始配置中的 tags ===');
    const originalManifest = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'original-manifest-list.json'), 'utf8'));
    originalManifest.forEach(item => {
        console.log(`- ${item.name}: ${item.tags ? item.tags.join(', ') : '无标签'}`);
    });

    const manifestPath = path.join(__dirname, '..', 'manifest-list.json');
    if (fs.existsSync(manifestPath)) {
        console.log('\n=== 现有配置检查 ===');
        const existingManifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
        console.log(`共 ${existingManifest.length} 个仓库`);
        
        existingManifest.forEach(item => {
            const successRate = calculateSuccessRate(item.statusHistory);
            const historyCount = item.statusHistory ? item.statusHistory.length : 0;
            console.log(`- ${item.name}: ${item.tags ? item.tags.join(', ') : '无'} (成功率: ${successRate}%, 历史记录: ${historyCount}条)`);
        });
    } else {
        console.log('\n现有 manifest-list.json 不存在');
    }
    
    process.exit(success ? 0 : 1);
}

module.exports = { calculateSuccessRate };
