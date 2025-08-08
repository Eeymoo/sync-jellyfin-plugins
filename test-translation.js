require('dotenv').config();
const { MultiLanguageManager } = require('./scripts/translator');

/**
 * 测试翻译功能
 */
async function testTranslation() {
    console.log('Testing translation functionality...');
    
    // 检查环境变量
    const { BAIDU_TRANSLATE_APPID, BAIDU_TRANSLATE_SECRET } = process.env;
    if (!BAIDU_TRANSLATE_APPID || !BAIDU_TRANSLATE_SECRET) {
        console.error('Please configure BAIDU_TRANSLATE_APPID and BAIDU_TRANSLATE_SECRET in .env file');
        process.exit(1);
    }
    
    try {
        const multiLangManager = new MultiLanguageManager();
        
        // 测试单句翻译
        console.log('\n--- Testing single sentence translation ---');
        const testText = '这是一个测试文本，用于验证百度翻译API的功能。';
        console.log(`Original (Chinese): ${testText}`);
        
        const englishResult = await multiLangManager.translator.translate(testText, 'zh', 'en');
        console.log(`English: ${englishResult}`);
        
        const japaneseResult = await multiLangManager.translator.translate(testText, 'zh', 'jp');
        console.log(`Japanese: ${japaneseResult}`);
        
        // 测试模板翻译
        console.log('\n--- Testing template translation ---');
        const fs = require('fs');
        const path = require('path');
        
        // 创建一个测试模板
        const testTemplateContent = `# 测试文档

## 介绍

这是一个测试文档，用于验证翻译功能。

## 功能特性

- 自动翻译
- 缓存机制
- 多语言支持

## 使用方法

1. 配置API密钥
2. 运行翻译命令
3. 查看结果

感谢使用！`;
        
        const testTemplatePath = './test-template.md';
        fs.writeFileSync(testTemplatePath, testTemplateContent, 'utf8');
        
        // 翻译模板到英语
        await multiLangManager.translateTemplate(
            testTemplatePath, 
            './test-output', 
            ['en']
        );
        
        // 清理测试文件
        fs.unlinkSync(testTemplatePath);
        
        console.log('\n✅ Translation test completed successfully!');
        console.log('Check ./test-output/ for translated files.');
        
    } catch (error) {
        console.error('❌ Translation test failed:', error.message);
        process.exit(1);
    }
}

// 如果直接运行此文件，执行测试
if (require.main === module) {
    testTranslation();
}

module.exports = { testTranslation };
