require('dotenv').config();
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const crypto = require('crypto-js');

const { BAIDU_TRANSLATE_APPID, BAIDU_TRANSLATE_SECRET } = process.env;

/**
 * 百度翻译API客户端
 */
class BaiduTranslator {
    constructor(appid, secret) {
        this.appid = appid;
        this.secret = secret;
        this.apiUrl = 'https://fanyi-api.baidu.com/api/trans/vip/translate';
        
        // 翻译缓存，避免重复翻译相同内容
        this.translationCache = new Map();
        this.loadCache();
    }

    /**
     * 加载翻译缓存
     */
    loadCache() {
        const cacheFile = path.join(__dirname, '../translation-cache.json');
        try {
            if (fs.existsSync(cacheFile)) {
                const cacheData = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
                this.translationCache = new Map(Object.entries(cacheData));
                console.log(`Loaded ${this.translationCache.size} cached translations`);
            }
        } catch (error) {
            console.warn('Failed to load translation cache:', error.message);
        }
    }

    /**
     * 保存翻译缓存
     */
    saveCache() {
        const cacheFile = path.join(__dirname, '../translation-cache.json');
        try {
            const cacheData = Object.fromEntries(this.translationCache);
            fs.writeFileSync(cacheFile, JSON.stringify(cacheData, null, 2), 'utf8');
            console.log(`Saved ${this.translationCache.size} translations to cache`);
        } catch (error) {
            console.error('Failed to save translation cache:', error.message);
        }
    }

    /**
     * 生成MD5签名
     * @param {string} query - 待翻译文本
     * @param {string} salt - 随机数
     * @returns {string} - MD5签名
     */
    generateSign(query, salt) {
        const signStr = this.appid + query + salt + this.secret;
        return crypto.MD5(signStr).toString().toLowerCase();
    }

    /**
     * 生成随机盐值
     * @returns {string} - 随机盐值
     */
    generateSalt() {
        return Math.random().toString(36).substr(2, 10);
    }

    /**
     * 翻译文本
     * @param {string} text - 待翻译文本
     * @param {string} from - 源语言（默认auto）
     * @param {string} to - 目标语言（默认en）
     * @returns {Promise<string>} - 翻译结果
     */
    async translate(text, from = 'auto', to = 'en') {
        if (!text || !text.trim()) {
            return text;
        }

        // 检查缓存 - 使用内容哈希作为缓存键，更可靠
        const textHash = crypto.MD5(text.trim()).toString();
        const cacheKey = `${textHash}|${from}|${to}`;
        
        if (this.translationCache.has(cacheKey)) {
            console.log(`  📋 Using cached translation for text hash: ${textHash.substring(0, 8)}...`);
            return this.translationCache.get(cacheKey);
        }

        // 检查文本是否过长（百度翻译API限制）
        if (text.length > 6000) {
            console.warn(`  ⚠️ Text too long (${text.length} chars), truncating to 6000 chars`);
            text = text.substring(0, 6000);
        }

        try {
            const salt = this.generateSalt();
            const sign = this.generateSign(text, salt);

            const params = new URLSearchParams({
                q: text,
                from: from,
                to: to,
                appid: this.appid,
                salt: salt,
                sign: sign
            });

            console.log(`  🌐 Translating text (${text.length} chars): ${text.substring(0, 50)}...`);
            
            const response = await axios.get(`${this.apiUrl}?${params}`, {
                timeout: 10000
            });

            if (response.data.error_code) {
                throw new Error(`Translation API Error ${response.data.error_code}: ${response.data.error_msg}`);
            }

            const translatedText = response.data.trans_result[0].dst;
            
            // 缓存翻译结果 - 使用哈希键
            this.translationCache.set(cacheKey, translatedText);
            console.log(`  ✅ Translation cached with key: ${textHash.substring(0, 8)}...`);
            
            // 添加延迟避免API频率限制
            await new Promise(resolve => setTimeout(resolve, 200));
            
            return translatedText;
        } catch (error) {
            console.error(`  ❌ Translation failed for "${text.substring(0, 50)}...":`, error.message);
            return text; // 翻译失败时返回原文
        }
    }

    /**
     * 批量翻译文本数组
     * @param {string[]} texts - 待翻译文本数组
     * @param {string} from - 源语言
     * @param {string} to - 目标语言
     * @returns {Promise<string[]>} - 翻译结果数组
     */
    async translateBatch(texts, from = 'auto', to = 'en') {
        const results = [];
        for (const text of texts) {
            const translated = await this.translate(text, from, to);
            results.push(translated);
        }
        return results;
    }

    /**
     * 翻译对象中的所有字符串值
     * @param {Object} obj - 待翻译的对象
     * @param {string[]} fieldsToTranslate - 需要翻译的字段名数组
     * @param {string} from - 源语言
     * @param {string} to - 目标语言
     * @returns {Promise<Object>} - 翻译后的对象
     */
    async translateObject(obj, fieldsToTranslate, from = 'auto', to = 'en') {
        const result = { ...obj };
        
        for (const field of fieldsToTranslate) {
            if (result[field] && typeof result[field] === 'string') {
                result[field] = await this.translate(result[field], from, to);
            }
        }
        
        return result;
    }
}

/**
 * 多语言内容管理器
 */
class MultiLanguageManager {
    constructor() {
        this.translator = new BaiduTranslator(BAIDU_TRANSLATE_APPID, BAIDU_TRANSLATE_SECRET);
        this.supportedLanguages = {
            'zh': 'zh',      // 中文（简体）
            'en': 'en',      // 英语
            'ja': 'jp',      // 日语
            'ko': 'kor',     // 韩语
            'fr': 'fra',     // 法语
            'de': 'de',      // 德语
            'es': 'spa',     // 西班牙语
            'ru': 'ru',      // 俄语
            'pt': 'pt',      // 葡萄牙语
            'it': 'it',      // 意大利语
        };
        
        // 存储翻译后的内容
        this.translations = {};
        this.loadTranslations();
    }

    /**
     * 加载已有的翻译内容
     */
    loadTranslations() {
        const translationsDir = path.join(__dirname, '../docs/translations');
        if (!fs.existsSync(translationsDir)) {
            fs.mkdirSync(translationsDir, { recursive: true });
        }

        for (const lang of Object.keys(this.supportedLanguages)) {
            const filePath = path.join(translationsDir, `${lang}.json`);
            try {
                if (fs.existsSync(filePath)) {
                    this.translations[lang] = JSON.parse(fs.readFileSync(filePath, 'utf8'));
                } else {
                    this.translations[lang] = {};
                }
            } catch (error) {
                console.warn(`Failed to load translations for ${lang}:`, error.message);
                this.translations[lang] = {};
            }
        }
    }

    /**
     * 保存翻译内容到文件
     */
    saveTranslations() {
        const translationsDir = path.join(__dirname, '../docs/translations');
        
        for (const [lang, content] of Object.entries(this.translations)) {
            const filePath = path.join(translationsDir, `${lang}.json`);
            try {
                fs.writeFileSync(filePath, JSON.stringify(content, null, 2), 'utf8');
            } catch (error) {
                console.error(`Failed to save translations for ${lang}:`, error.message);
            }
        }
    }

    /**
     * 检查内容是否需要翻译（内容是否有变更）
     * @param {string} key - 内容键值
     * @param {string} content - 当前内容
     * @param {string} lang - 目标语言
     * @returns {boolean} - 是否需要翻译
     */
    needsTranslation(key, content, lang) {
        if (!this.translations[lang] || !this.translations[lang][key]) {
            return true;
        }
        
        // 比较原始内容是否有变化
        const stored = this.translations[lang][key];
        return stored.original !== content;
    }

    /**
     * 翻译文档内容
     * @param {string} content - 原始内容
     * @param {string} targetLang - 目标语言
     * @returns {Promise<string>} - 翻译后的内容
     */
    async translateDocument(content, targetLang = 'en') {
        if (targetLang === 'zh') {
            return content; // 中文是原始语言，无需翻译
        }

        const baiduLangCode = this.supportedLanguages[targetLang];
        if (!baiduLangCode) {
            throw new Error(`Unsupported language: ${targetLang}`);
        }

        // 分段翻译，避免一次性翻译过长的内容
        const paragraphs = content.split('\n\n');
        const translatedParagraphs = [];

        for (const paragraph of paragraphs) {
            if (paragraph.trim() === '') {
                translatedParagraphs.push(paragraph);
                continue;
            }

            // 检查是否为代码块或特殊格式，不进行翻译
            if (paragraph.startsWith('```') || 
                paragraph.startsWith('---') ||
                paragraph.startsWith('<script') ||
                paragraph.includes('</script>') ||
                paragraph.includes('<template') ||
                paragraph.includes('</template>')) {
                translatedParagraphs.push(paragraph);
                continue;
            }

            const translated = await this.translator.translate(paragraph, 'zh', baiduLangCode);
            translatedParagraphs.push(translated);
        }

        return translatedParagraphs.join('\n\n');
    }

    /**
     * 翻译模板文件并生成多语言版本
     * @param {string} templatePath - 模板文件路径
     * @param {string} outputDir - 输出目录
     * @param {string[]} targetLanguages - 目标语言列表
     */
    async translateTemplate(templatePath, outputDir, targetLanguages = ['en']) {
        const templateContent = fs.readFileSync(templatePath, 'utf8');
        const templateName = path.basename(templatePath, path.extname(templatePath));

        // 确保输出目录存在
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        for (const lang of targetLanguages) {
            const contentKey = `${templateName}_${lang}`;
            
            // 检查是否需要翻译
            if (!this.needsTranslation(contentKey, templateContent, lang)) {
                console.log(`Skipping translation for ${templateName} (${lang}) - no changes detected`);
                continue;
            }

            console.log(`Translating ${templateName} to ${lang}...`);
            
            try {
                const translatedContent = await this.translateDocument(templateContent, lang);
                const outputPath = path.join(outputDir, `${templateName}.${lang}.md`);
                
                fs.writeFileSync(outputPath, translatedContent, 'utf8');
                
                // 保存翻译记录
                if (!this.translations[lang]) {
                    this.translations[lang] = {};
                }
                this.translations[lang][contentKey] = {
                    original: templateContent,
                    translated: translatedContent,
                    lastUpdated: new Date().toISOString()
                };
                
                console.log(`Translation completed: ${outputPath}`);
            } catch (error) {
                console.error(`Failed to translate ${templateName} to ${lang}:`, error.message);
            }
        }

        // 保存翻译缓存
        this.saveTranslations();
        this.translator.saveCache();
    }
}

module.exports = {
    BaiduTranslator,
    MultiLanguageManager
};
