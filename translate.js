#!/usr/bin/env node
require('dotenv').config();
const { MultiLanguageManager } = require('./scripts/translator');
const fs = require('fs');

/**
 * 独立翻译脚本
 */
async function runTranslation() {
    console.log('🌍 Starting translation process...');
    
    // 检查环境变量
    const { BAIDU_TRANSLATE_APPID, BAIDU_TRANSLATE_SECRET } = process.env;
    if (!BAIDU_TRANSLATE_APPID || !BAIDU_TRANSLATE_SECRET) {
        console.warn('⚠️ Baidu Translation API not configured. Skipping translation.');
        console.log('To enable translation, please configure:');
        console.log('  BAIDU_TRANSLATE_APPID=your-app-id');
        console.log('  BAIDU_TRANSLATE_SECRET=your-secret');
        return;
    }
    
    try {
        const multiLangManager = new MultiLanguageManager();
        
        // 要翻译的目标语言
        const targetLanguages = ['en', 'ja', 'ko', 'fr', 'de', 'es', 'ru'];
        
        // 翻译模板文件
        const templateFiles = [
            { 
                path: './template/get-started.md',
                outputDir: './docs/i18n'
            },
            { 
                path: './template/status.md',
                outputDir: './docs/i18n'
            }
        ];

        for (const templateFile of templateFiles) {
            if (fs.existsSync(templateFile.path)) {
                console.log(`📄 Translating ${templateFile.path}...`);
                await multiLangManager.translateTemplate(
                    templateFile.path,
                    templateFile.outputDir,
                    targetLanguages
                );
            } else {
                console.log(`⚠️ Template file not found: ${templateFile.path}`);
            }
        }

        console.log('✅ Translation process completed successfully!');
        console.log('📁 Translated files are saved in ./docs/i18n/');
        
    } catch (error) {
        console.error('❌ Translation failed:', error.message);
        if (error.message.includes('54003')) {
            console.log('💡 Tip: This error usually means API call frequency limit. Please try again later.');
        } else if (error.message.includes('54001')) {
            console.log('💡 Tip: This error usually means wrong API credentials. Please check your APPID and SECRET.');
        }
        process.exit(1);
    }
}

runTranslation();
