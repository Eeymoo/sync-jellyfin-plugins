#!/usr/bin/env node
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { BaiduTranslator } = require('./scripts/translator');

/**
 * 获取百度翻译API对应的语言代码
 * @param {string} lang - 语言简码
 * @returns {string} - 百度API语言代码
 */
function getLangCode(lang) {
    const langMap = {
        'en': 'en',
        'ja': 'jp',
        'ko': 'kor',
        'fr': 'fra',
        'de': 'de',
        'es': 'spa',
        'ru': 'ru',
        'pt': 'pt',
        'it': 'it'
    };
    return langMap[lang] || 'en';
}

/**
 * 翻译插件数据中的指定字段（changelog 和 description）
 */
async function translatePluginData() {
    console.log('🌍 Starting plugin data translation...');
    
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
        const translator = new BaiduTranslator(BAIDU_TRANSLATE_APPID, BAIDU_TRANSLATE_SECRET);
        
        // 从环境变量读取翻译配置，默认为 auto -> zh (自动检测 -> 中文)
        const targetLang = process.env.TRANSLATION_TARGET_LANGUAGE || 'zh';
        const sourceLang = process.env.TRANSLATION_SOURCE_LANGUAGE || 'auto';
        
        console.log(`🔄 Translation config: ${sourceLang} -> ${targetLang}`);
        
        // 读取插件清单
        const manifestPath = './manifest-list.json';
        if (!fs.existsSync(manifestPath)) {
            console.error('❌ manifest-list.json not found. Please run sync first.');
            return;
        }
        
        const manifestData = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
        const downloadDir = path.join(__dirname, 'download');
        
        for (const item of manifestData) {
            console.log(`📦 Processing: ${item.name}`);
            
            try {
                // 检查本地文件
                const itemName = item.name.replace(/[^\w\s]/g, '').replace(/\s+/g, '_');
                const localManifestPath = path.join(downloadDir, itemName, 'manifest.json');
                
                if (!fs.existsSync(localManifestPath)) {
                    console.log(`⚠️ Local manifest not found for ${item.name}, skipping.`);
                    continue;
                }
                
                const projects = JSON.parse(fs.readFileSync(localManifestPath, 'utf8'));
                let hasChanges = false;
                
                // 翻译每个项目的字段
                for (const project of projects) {
                    // 翻译 description
                    if (project.description) {
                        const originalDescription = project.description;
                        const fieldName = `description_${targetLang}`;
                        
                        // 检查是否已经翻译过
                        if (!project[fieldName] || !project[fieldName].includes('原文:')) {
                            console.log(`  📝 Translating description to ${targetLang}...`);
                            const translated = await translator.translate(originalDescription, sourceLang, targetLang);
                            // 格式：翻译文本 + 原文
                            project[fieldName] = `${translated}\n\n原文: ${originalDescription}`;
                            hasChanges = true;
                        }
                    }
                    
                    // 翻译版本信息中的 changelog
                    if (project.versions) {
                        for (const version of project.versions) {
                            if (version.changelog) {
                                const originalChangelog = version.changelog;
                                const fieldName = `changelog_${targetLang}`;
                                
                                // 检查是否已经翻译过
                                if (!version[fieldName] || !version[fieldName].includes('原文:')) {
                                    console.log(`  📋 Translating changelog (v${version.version}) to ${targetLang}...`);
                                    const translated = await translator.translate(originalChangelog, sourceLang, targetLang);
                                    // 格式：翻译文本 + 原文
                                    version[fieldName] = `${translated}\n\n原文: ${originalChangelog}`;
                                    hasChanges = true;
                                }
                            }
                        }
                    }
                }
                
                // 保存更新后的数据
                if (hasChanges) {
                    fs.writeFileSync(localManifestPath, JSON.stringify(projects, null, 2));
                    console.log(`✅ Updated translations for ${item.name}`);
                } else {
                    console.log(`✨ No new translations needed for ${item.name}`);
                }
                
            } catch (error) {
                console.error(`❌ Failed to process ${item.name}:`, error.message);
            }
        }
        
        // 保存翻译缓存
        translator.saveCache();
        
        console.log('🎉 Plugin data translation completed!');
        console.log('💡 Tip: Run "pnpm run sync" to upload the translated data to OSS.');
        
    } catch (error) {
        console.error('❌ Translation failed:', error.message);
        if (error.message.includes('54003')) {
            console.log('💡 Tip: API call frequency limit reached. Please try again later.');
        } else if (error.message.includes('54001')) {
            console.log('💡 Tip: API credentials error. Please check your APPID and SECRET.');
        }
        process.exit(1);
    }
}

translatePluginData();
