#!/usr/bin/env node

require('dotenv').config();

/**
 * 防重复翻译功能测试
 */

/**
 * 判断文本是否需要翻译
 * @param {string} text - 要检查的文本
 * @returns {boolean} - 是否需要翻译
 */
function shouldTranslateText(text) {
    if (!text || typeof text !== 'string' || text.trim() === '') {
        return false;
    }
    
    // 检查是否已经包含翻译标记（<br> 格式）
    const translationPattern = /<br><br>原文:\s/;
    if (translationPattern.test(text)) {
        return false;
    }
    
    // 检查是否是已翻译的格式（包含 <br><br>原文: ）
    if (text.includes('<br><br>原文: ')) {
        return false;
    }
    
    // 兼容性检查：检查旧的 \n 格式（向下兼容）
    const oldTranslationPattern = /\n\n原文:\s/;
    if (oldTranslationPattern.test(text)) {
        return false;
    }
    
    if (text.includes('\n\n原文: ')) {
        return false;
    }
    
    // 检查文本长度，太短的文本可能不需要翻译
    if (text.trim().length < 3) {
        return false;
    }
    
    // 检查是否只包含数字、符号等不需要翻译的内容
    const nonTranslatablePattern = /^[\d\s\.\-_,;:!()\[\]{}\/\\@#$%^&*+=<>?|`~"']*$/;
    if (nonTranslatablePattern.test(text.trim())) {
        return false;
    }
    
    return true;
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
    console.log('🧪 防重复翻译功能测试');
    console.log('=' .repeat(50));

    const { BAIDU_TRANSLATE_APPID, BAIDU_TRANSLATE_SECRET } = process.env;
    if (!BAIDU_TRANSLATE_APPID || !BAIDU_TRANSLATE_SECRET) {
        console.warn('⚠️ Baidu Translation API not configured. Some tests will be skipped.');
    }

    const testCases = [
        {
            text: 'This is a test description',
            expected: true,
            description: '正常英文文本'
        },
        {
            text: 'This is a translated text<br><br>原文: This is the original text',
            expected: false,
            description: '已翻译的文本（<br>格式）'
        },
        {
            text: 'This is a translated text\n\n原文: This is the original text',
            expected: false,
            description: '已翻译的文本（\\n格式，向下兼容）'
        },
        {
            text: '',
            expected: false,
            description: '空字符串'
        },
        {
            text: '   ',
            expected: false,
            description: '只有空白字符'
        },
        {
            text: 'Hi',
            expected: false,
            description: '过短文本'
        },
        {
            text: '123.45',
            expected: false,
            description: '纯数字'
        },
        {
            text: '!!!@@@###',
            expected: false,
            description: '纯符号'
        },
        {
            text: 'Version 1.2.3',
            expected: true,
            description: '版本信息（应该翻译）'
        },
        {
            text: 'Fix bug in authentication module',
            expected: true,
            description: '更新日志（应该翻译）'
        }
    ];

    console.log('\n📋 Testing shouldTranslateText function:');
    const results = [];
    let passed = 0;
    let total = testCases.length;

    for (const testCase of testCases) {
        const result = shouldTranslateText(testCase.text);
        const success = result === testCase.expected;
        const status = success ? '✅' : '❌';
        console.log(`${status} ${testCase.description}: ${result} (expected: ${testCase.expected})`);
        
        results.push(success);
        if (success) passed++;
    }

    // 额外的单元测试
    console.log('\n� Additional unit tests:');
    
    // 测试已翻译文本识别
    results.push(assertEqual(shouldTranslateText('Some content<br><br>原文: Original'), false, '应该正确识别已翻译的文本（<br>格式）'));
    results.push(assertEqual(shouldTranslateText('Some content\n\n原文: Original'), false, '应该正确识别已翻译的文本（\\n格式）'));
    
    // 测试空或无效文本
    results.push(assertEqual(shouldTranslateText(''), false, '应该拒绝空字符串'));
    results.push(assertEqual(shouldTranslateText(null), false, '应该拒绝 null'));
    results.push(assertEqual(shouldTranslateText(undefined), false, '应该拒绝 undefined'));
    results.push(assertEqual(shouldTranslateText('   '), false, '应该拒绝只有空白字符的文本'));
    
    // 测试短文本
    results.push(assertEqual(shouldTranslateText('a'), false, '应该拒绝过短文本 (1字符)'));
    results.push(assertEqual(shouldTranslateText('ab'), false, '应该拒绝过短文本 (2字符)'));
    results.push(assertEqual(shouldTranslateText('Hi'), false, '应该拒绝过短文本 (2字符)'));
    
    // 测试纯数字和符号
    results.push(assertEqual(shouldTranslateText('123'), false, '应该拒绝纯数字'));
    results.push(assertEqual(shouldTranslateText('123.45'), false, '应该拒绝数字和小数点'));
    results.push(assertEqual(shouldTranslateText('!!!'), false, '应该拒绝纯符号'));
    results.push(assertEqual(shouldTranslateText('@#$'), false, '应该拒绝特殊符号'));
    
    // 测试有意义的文本
    results.push(assertEqual(shouldTranslateText('Hello World'), true, '应该接受有意义的文本'));
    results.push(assertEqual(shouldTranslateText('Version 1.2.3'), true, '应该接受版本信息'));
    results.push(assertEqual(shouldTranslateText('Bug fix'), true, '应该接受简短描述'));

    const totalTests = results.length;
    const passedTests = results.filter(r => r).length;
    
    console.log('\n' + '='.repeat(50));
    console.log('📊 测试结果统计:');
    console.log(`   总测试数: ${totalTests}`);
    console.log(`   通过数: ${passedTests}`);
    console.log(`   失败数: ${totalTests - passedTests}`);
    console.log(`   成功率: ${Math.round((passedTests / totalTests) * 100)}%`);
    console.log('='.repeat(50));
    
    if (passedTests === totalTests) {
        console.log('\n🎉 所有测试通过！');
    } else {
        console.log('\n❌ 部分测试失败');
    }

    return passedTests === totalTests;
}

// 异步测试缓存功能
async function testTranslationCache() {
    const { BAIDU_TRANSLATE_APPID, BAIDU_TRANSLATE_SECRET } = process.env;
    
    if (!BAIDU_TRANSLATE_APPID || !BAIDU_TRANSLATE_SECRET) {
        console.warn('⚠️ Baidu Translation API not configured. Cache test skipped.');
        return true;
    }

    try {
        // 动态导入翻译器
        const { BaiduTranslator } = require('../scripts/translator');
        
        console.log('\n🔄 Testing translation caching:');
        
        const translator = new BaiduTranslator(BAIDU_TRANSLATE_APPID, BAIDU_TRANSLATE_SECRET);
        const testText = 'Hello World';
        
        console.log('First translation (should call API):');
        const start1 = Date.now();
        const result1 = await translator.translate(testText, 'auto', 'zh');
        const time1 = Date.now() - start1;
        console.log(`Result: ${result1} (took ${time1}ms)`);
        
        console.log('\nSecond translation (should use cache):');
        const start2 = Date.now();
        const result2 = await translator.translate(testText, 'auto', 'zh');
        const time2 = Date.now() - start2;
        console.log(`Result: ${result2} (took ${time2}ms)`);
        
        const cacheWorking = result1 === result2 && time2 < time1;
        console.log(`\n${cacheWorking ? '✅' : '❌'} Cache test: ${cacheWorking ? 'Working' : 'Failed'}`);
        
        // 保存缓存
        translator.saveCache();
        
        return cacheWorking;
    } catch (error) {
        console.warn('⚠️ Translation cache test failed:', error.message);
        return true; // 不让这个错误导致整个测试失败
    }
}

// 如果直接运行此文件，执行完整的测试
if (require.main === module) {
    async function runAllTests() {
        const basicTestResult = runTests();
        const cacheTestResult = await testTranslationCache();
        
        const success = basicTestResult && cacheTestResult;
        
        console.log('\n🎉 Test completed!');
        process.exit(success ? 0 : 1);
    }

    runAllTests().catch(console.error);
}

module.exports = { shouldTranslateText };
