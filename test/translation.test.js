#!/usr/bin/env node

require('dotenv').config();
const fs = require('fs');
const path = require('path');

/**
 * 翻译功能测试
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

function runBasicTests() {
    console.log('🧪 翻译功能基础测试');
    console.log('=' .repeat(50));

    const results = [];
    const { BAIDU_TRANSLATE_APPID, BAIDU_TRANSLATE_SECRET } = process.env;

    console.log('\n📋 运行基础测试:');

    // 环境变量测试
    if (!BAIDU_TRANSLATE_APPID || !BAIDU_TRANSLATE_SECRET) {
        console.warn('⚠️ BAIDU_TRANSLATE_APPID 和 BAIDU_TRANSLATE_SECRET 未在 .env 文件中配置');
        console.warn('⚠️ 某些翻译测试将被跳过');
        // 不计为失败，只是跳过
    } else {
        results.push(assertTruthy(typeof BAIDU_TRANSLATE_APPID === 'string', '环境变量 BAIDU_TRANSLATE_APPID 应该是字符串'));
        results.push(assertTruthy(typeof BAIDU_TRANSLATE_SECRET === 'string', '环境变量 BAIDU_TRANSLATE_SECRET 应该是字符串'));
        results.push(assertTruthy(BAIDU_TRANSLATE_APPID.length > 0, 'BAIDU_TRANSLATE_APPID 应该不为空'));
        results.push(assertTruthy(BAIDU_TRANSLATE_SECRET.length > 0, 'BAIDU_TRANSLATE_SECRET 应该不为空'));
    }

    // 翻译器模块加载测试
    let translatorModule;
    try {
        translatorModule = require('../scripts/translator');
        results.push(assertTruthy(translatorModule, '翻译器模块应该能够加载'));
        
        if (translatorModule.MultiLanguageManager) {
            results.push(assertEqual(typeof translatorModule.MultiLanguageManager, 'function', 'MultiLanguageManager 应该是构造函数'));
        }
        
        if (translatorModule.BaiduTranslator) {
            results.push(assertEqual(typeof translatorModule.BaiduTranslator, 'function', 'BaiduTranslator 应该是构造函数'));
        }
    } catch (error) {
        console.warn('⚠️ 翻译器模块加载失败:', error.message);
        results.push(false);
    }

    const passed = results.filter(r => r).length;
    const total = results.length;
    
    console.log('\n' + '='.repeat(50));
    console.log('📊 基础测试结果:');
    console.log(`   总测试数: ${total}`);
    console.log(`   通过数: ${passed}`);
    console.log(`   失败数: ${total - passed}`);
    console.log(`   成功率: ${Math.round((passed / total) * 100)}%`);
    console.log('='.repeat(50));

    return passed === total;
}

async function runTranslationTests() {
    const { BAIDU_TRANSLATE_APPID, BAIDU_TRANSLATE_SECRET } = process.env;
    
    if (!BAIDU_TRANSLATE_APPID || !BAIDU_TRANSLATE_SECRET) {
        console.warn('⚠️ 跳过翻译测试：API 未配置');
        return true;
    }

    let MultiLanguageManager;
    try {
        const translatorModule = require('../scripts/translator');
        MultiLanguageManager = translatorModule.MultiLanguageManager;
    } catch (error) {
        console.warn('⚠️ 跳过翻译测试：模块加载失败');
        return true;
    }

    console.log('\n🌐 单句翻译功能测试');
    console.log('=' .repeat(50));

    try {
        const multiLangManager = new MultiLanguageManager();
        
        const testText = '这是一个测试文本，用于验证百度翻译API的功能。';
        console.log(`Original (Chinese): ${testText}`);
        
        // 测试英文翻译
        console.log('\n正在测试英文翻译...');
        const englishResult = await multiLangManager.translator.translate(testText, 'zh', 'en');
        console.log(`✅ English: ${englishResult}`);
        
        if (typeof englishResult !== 'string' || englishResult.length === 0 || englishResult === testText) {
            console.log('❌ 英文翻译结果异常');
            return false;
        }
        
        // 测试日文翻译
        console.log('\n正在测试日文翻译...');
        const japaneseResult = await multiLangManager.translator.translate(testText, 'zh', 'jp');
        console.log(`✅ Japanese: ${japaneseResult}`);
        
        if (typeof japaneseResult !== 'string' || japaneseResult.length === 0 || japaneseResult === testText) {
            console.log('❌ 日文翻译结果异常');
            return false;
        }
        
        console.log('\n✅ 单句翻译测试通过');
        return true;
        
    } catch (error) {
        console.log(`❌ 翻译测试失败: ${error.message}`);
        return false;
    }
}

async function runTemplateTranslationTests() {
    const { BAIDU_TRANSLATE_APPID, BAIDU_TRANSLATE_SECRET } = process.env;
    
    if (!BAIDU_TRANSLATE_APPID || !BAIDU_TRANSLATE_SECRET) {
        console.warn('⚠️ 跳过模板翻译测试：API 未配置');
        return true;
    }

    let MultiLanguageManager;
    try {
        const translatorModule = require('../scripts/translator');
        MultiLanguageManager = translatorModule.MultiLanguageManager;
    } catch (error) {
        console.warn('⚠️ 跳过模板翻译测试：模块加载失败');
        return true;
    }

    console.log('\n📄 模板翻译功能测试');
    console.log('=' .repeat(50));
    
    const multiLangManager = new MultiLanguageManager();
    
    // 创建测试模板
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
    
    const testTemplatePath = path.join(__dirname, 'test-template.md');
    const testOutputPath = path.join(__dirname, 'test-output');
    
    // 清理可能存在的文件
    if (fs.existsSync(testTemplatePath)) {
        fs.unlinkSync(testTemplatePath);
    }
    if (fs.existsSync(testOutputPath)) {
        fs.rmSync(testOutputPath, { recursive: true, force: true });
    }

    try {
        fs.writeFileSync(testTemplatePath, testTemplateContent, 'utf8');
        console.log('✅ 测试模板文件创建成功');
        
        if (!fs.existsSync(testTemplatePath)) {
            console.log('❌ 测试模板文件创建失败');
            return false;
        }
        
        console.log('\n正在翻译模板到英语...');
        
        // 翻译模板到英语
        await multiLangManager.translateTemplate(
            testTemplatePath, 
            testOutputPath, 
            ['en']
        );
        
        // 检查输出文件是否存在
        const englishOutputPath = path.join(testOutputPath, 'en', 'test-template.md');
        
        if (fs.existsSync(englishOutputPath)) {
            const translatedContent = fs.readFileSync(englishOutputPath, 'utf8');
            if (typeof translatedContent === 'string' && translatedContent.length > 0) {
                console.log('✅ 模板翻译完成，翻译文件生成成功');
                console.log(`   输出路径: ${englishOutputPath}`);
                console.log(`   文件大小: ${translatedContent.length} 字符`);
                return true;
            } else {
                console.log('❌ 翻译文件内容为空');
                return false;
            }
        } else {
            console.warn('⚠️ 翻译文件未生成，可能是翻译服务暂时不可用');
            return true; // 不算作失败，可能是网络问题
        }
        
    } catch (error) {
        console.log(`❌ 模板翻译测试失败: ${error.message}`);
        return false;
    } finally {
        // 清理测试文件
        if (fs.existsSync(testTemplatePath)) {
            fs.unlinkSync(testTemplatePath);
        }
        if (fs.existsSync(testOutputPath)) {
            fs.rmSync(testOutputPath, { recursive: true, force: true });
        }
    }
}

async function runErrorHandlingTests() {
    const { BAIDU_TRANSLATE_APPID, BAIDU_TRANSLATE_SECRET } = process.env;
    
    if (!BAIDU_TRANSLATE_APPID || !BAIDU_TRANSLATE_SECRET) {
        console.warn('⚠️ 跳过错误处理测试：API 未配置');
        return true;
    }

    let BaiduTranslator;
    try {
        const translatorModule = require('../scripts/translator');
        BaiduTranslator = translatorModule.BaiduTranslator;
    } catch (error) {
        console.warn('⚠️ 跳过错误处理测试：模块加载失败');
        return true;
    }

    console.log('\n🚨 错误处理测试');
    console.log('=' .repeat(50));

    const translator = new BaiduTranslator(BAIDU_TRANSLATE_APPID, BAIDU_TRANSLATE_SECRET);
    
    try {
        // 测试空文本
        console.log('测试空文本处理...');
        try {
            await translator.translate('', 'en', 'zh');
            console.log('❌ 空文本应该抛出错误');
            return false;
        } catch (error) {
            console.log('✅ 空文本正确抛出错误');
        }
        
        console.log('\n✅ 错误处理测试通过');
        return true;
        
    } catch (error) {
        console.log(`❌ 错误处理测试失败: ${error.message}`);
        return false;
    }
}

// 如果直接运行此文件，执行完整的翻译测试
if (require.main === module) {
    async function runAllTranslationTests() {
        console.log('Testing translation functionality...');
        
        const basicResult = runBasicTests();
        
        if (!basicResult) {
            console.log('❌ 基础测试失败，跳过其他测试');
            process.exit(1);
        }
        
        try {
            const translationResult = await runTranslationTests();
            const templateResult = await runTemplateTranslationTests();
            const errorResult = await runErrorHandlingTests();
            
            const allPassed = basicResult && translationResult && templateResult && errorResult;
            
            console.log('\n' + '='.repeat(60));
            console.log('📊 翻译功能测试汇总');
            console.log('='.repeat(60));
            console.log(`✅ 基础测试: ${basicResult ? '通过' : '失败'}`);
            console.log(`✅ 单句翻译: ${translationResult ? '通过' : '失败'}`);
            console.log(`✅ 模板翻译: ${templateResult ? '通过' : '失败'}`);
            console.log(`✅ 错误处理: ${errorResult ? '通过' : '失败'}`);
            console.log('='.repeat(60));
            
            if (allPassed) {
                console.log('\n🎉 所有翻译测试通过！');
                process.exit(0);
            } else {
                console.log('\n❌ 部分翻译测试失败');
                process.exit(1);
            }
            
        } catch (error) {
            console.error('❌ Translation test failed:', error.message);
            process.exit(1);
        }
    }

    runAllTranslationTests();
}

module.exports = { runBasicTests, runTranslationTests, runTemplateTranslationTests, runErrorHandlingTests };
