#!/usr/bin/env node

/**
 * 测试运行器 - 执行所有测试
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const testFiles = [
    'node.test.js',
    'config.test.js', 
    'version-logic.test.js',
    'duplicate-prevention.test.js',
    'translation.test.js'
];

async function runTest(testFile) {
    return new Promise((resolve, reject) => {
        console.log(`\n${'='.repeat(60)}`);
        console.log(`🧪 运行测试: ${testFile}`);
        console.log(`${'='.repeat(60)}\n`);

        const testPath = path.join(__dirname, testFile);
        
        if (!fs.existsSync(testPath)) {
            console.error(`❌ 测试文件不存在: ${testPath}`);
            resolve({ file: testFile, success: false, error: '文件不存在' });
            return;
        }

        const child = spawn('node', [testPath], {
            stdio: 'inherit',
            cwd: path.dirname(testPath)
        });

        child.on('close', (code) => {
            if (code === 0) {
                console.log(`\n✅ ${testFile} 测试通过`);
                resolve({ file: testFile, success: true });
            } else {
                console.log(`\n❌ ${testFile} 测试失败 (退出码: ${code})`);
                resolve({ file: testFile, success: false, error: `退出码: ${code}` });
            }
        });

        child.on('error', (error) => {
            console.error(`\n❌ ${testFile} 运行出错:`, error.message);
            resolve({ file: testFile, success: false, error: error.message });
        });
    });
}

async function runAllTests() {
    console.log('🚀 开始运行所有测试...\n');
    
    const results = [];
    
    for (const testFile of testFiles) {
        const result = await runTest(testFile);
        results.push(result);
    }
    
    // 汇总结果
    console.log('\n' + '='.repeat(60));
    console.log('📊 测试结果汇总');
    console.log('='.repeat(60));
    
    const passed = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    
    results.forEach(result => {
        const status = result.success ? '✅' : '❌';
        const error = result.error ? ` (${result.error})` : '';
        console.log(`${status} ${result.file}${error}`);
    });
    
    console.log('\n' + '='.repeat(60));
    console.log(`总计: ${results.length} 个测试`);
    console.log(`通过: ${passed} 个`);
    console.log(`失败: ${failed} 个`);
    console.log(`成功率: ${Math.round((passed / results.length) * 100)}%`);
    console.log('='.repeat(60));
    
    if (failed > 0) {
        console.log('\n❌ 部分测试失败');
        process.exit(1);
    } else {
        console.log('\n🎉 所有测试通过！');
        process.exit(0);
    }
}

// 检查命令行参数
const args = process.argv.slice(2);

if (args.length > 0) {
    // 运行指定的测试文件
    const testFile = args[0];
    if (!testFile.endsWith('.test.js')) {
        console.error('❌ 测试文件名必须以 .test.js 结尾');
        process.exit(1);
    }
    
    runTest(testFile).then(result => {
        process.exit(result.success ? 0 : 1);
    });
} else {
    // 运行所有测试
    runAllTests();
}
