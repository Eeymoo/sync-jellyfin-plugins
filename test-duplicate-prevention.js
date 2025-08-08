#!/usr/bin/env node
require('dotenv').config();
const { BaiduTranslator } = require('./scripts/translator');

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

/**
 * 测试防重复翻译功能
 */
async function testDuplicatePrevention() {
    console.log('🧪 Testing duplicate translation prevention...');
    
    const { BAIDU_TRANSLATE_APPID, BAIDU_TRANSLATE_SECRET } = process.env;
    if (!BAIDU_TRANSLATE_APPID || !BAIDU_TRANSLATE_SECRET) {
        console.warn('⚠️ Baidu Translation API not configured. Some tests will be skipped.');
    }

    // 测试用例
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
    let passed = 0;
    let total = testCases.length;

    for (const testCase of testCases) {
        const result = shouldTranslateText(testCase.text);
        const status = result === testCase.expected ? '✅' : '❌';
        console.log(`${status} ${testCase.description}: ${result} (expected: ${testCase.expected})`);
        if (result === testCase.expected) passed++;
    }

    console.log(`\n📊 Test Results: ${passed}/${total} passed`);

    // 测试翻译缓存（如果API配置了）
    if (BAIDU_TRANSLATE_APPID && BAIDU_TRANSLATE_SECRET) {
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
    }

    console.log('\n🎉 Test completed!');
}

// 运行测试
testDuplicatePrevention().catch(console.error);
