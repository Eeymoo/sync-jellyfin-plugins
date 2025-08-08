require('dotenv').config();
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const OSS = require('ali-oss');
const cliProgress = require('cli-progress');
const { MultiLanguageManager } = require('./translator');

const { OSS_ACCESS_KEY_ID, OSS_ACCESS_KEY_SECRET, OSS_ENDPOINT, OSS_BUCKET_NAME } = process.env;

const bucket = new OSS({
    accessKeyId: OSS_ACCESS_KEY_ID,
    accessKeySecret: OSS_ACCESS_KEY_SECRET,
    region: OSS_ENDPOINT,
    authorizationV4: true,
    bucket: OSS_BUCKET_NAME,
});

const originalManifest = JSON.parse(fs.readFileSync('./original-manifest-list.json', 'utf8'));
const downloadDir = path.join(__dirname, '../download');

/**
 * Ensures that the download directory exists.
 * If the directory does not exist, it will be created.
 *
 * @function ensureDownloadDir
 * @returns {void}
 */
function ensureDir(downloadDir) {
    if (!fs.existsSync(downloadDir)) {
        fs.mkdirSync(downloadDir);
    }
}

/**
 * Downloads a file from a given URL and saves it to the specified path.
 * Displays a progress bar during the download process.
 *
 * @function downloadFile
 * @param {string} url - The URL of the file to download.
 * @param {string} filePath - The local file path where the file will be saved.
 * @returns {Promise<void>} - A promise that resolves when the file is successfully downloaded.
 */
async function downloadFile(url, filePath) {
    const downloadProgressBar = new cliProgress.SingleBar({
        format: `Downloading ${path.basename(filePath)} |{bar}| {percentage}% | {value}/{total} bytes`,
        barCompleteChar: '\u2588',
        barIncompleteChar: '\u2591',
        hideCursor: true,
    });

    const response = await axios.get(url, {
        responseType: 'stream',
        onDownloadProgress: (progressEvent) => {
            const totalBytes = progressEvent.total;
            const downloadedBytes = progressEvent.loaded;
            if (totalBytes) {
                if (!downloadProgressBar.getTotal()) {
                    downloadProgressBar.start(totalBytes, downloadedBytes);
                }
                downloadProgressBar.update(downloadedBytes);
            }
        },
    });

    const writer = fs.createWriteStream(filePath);
    response.data.pipe(writer);

    await new Promise((resolve, reject) => {
        writer.on('finish', () => {
            downloadProgressBar.stop();
            resolve();
        });
        writer.on('error', (err) => {
            downloadProgressBar.stop();
            console.log(err);
            reject(err);
        });
    });
}

/**
 * Uploads a file to Alibaba Cloud OSS.
 * Displays a progress bar during the upload process.
 *
 * @function uploadFileToOSS
 * @param {string} filePath - The local file path of the file to upload.
 * @param {string} ossKey - The key (path) under which the file will be stored in OSS.
 * @returns {Promise<void>} - A promise that resolves when the file is successfully uploaded.
 */
async function uploadFileToOSS(filePath, ossKey) {
    const uploadProgressBar = new cliProgress.SingleBar({
        format: `Uploading ${path.basename(filePath)} |{bar}| {percentage}% | {value}/{total} bytes`,
        barCompleteChar: '\u2588',
        barIncompleteChar: '\u2591',
        hideCursor: true,
    });

    const fileStream = fs.createReadStream(filePath);
    const fileStats = fs.statSync(filePath);

    await bucket.put(ossKey, fileStream, {
        progress: (p) => {
            const uploadedBytes = Math.round(p * fileStats.size);
            if (!uploadProgressBar.getTotal()) {
                uploadProgressBar.start(fileStats.size, uploadedBytes);
            }
            uploadProgressBar.update(uploadedBytes);
        },
    });

    uploadProgressBar.stop();
}

/**
 * Processes a single manifest item by downloading and uploading its files.
 *
 * @function processManifestItem
 * @param {Object} item - The manifest item to process.
 * @param {string} item.name - The name of the item.
 * @param {string} item.repositoryUrl - The URL of the repository containing the item's files.
 * @param {Array} item.tags - Tags associated with the repository.
 * @param {Object} existingItem - The existing item data for maintaining history.
 * @returns {Promise<Object>} - A promise that resolves to an object containing the processing result.
 * @property {string} name - The name of the item.
 * @property {string} originalUrl - The original repository URL.
 * @property {string} repositoryUrl - The new OSS URL for the item's files.
 * @property {string} timestamp - The timestamp of the processing.
 * @property {string} status - The status of the processing ('success' or 'error').
 * @property {Array} tags - Tags associated with the repository.
 * @property {Array} statusHistory - The last 60 status records.
 */
async function processManifestItem(item, existingItem = null) {
    const result = {
        name: item.name,
        originalUrl: item.repositoryUrl,
        repositoryUrl: '',
        timestamp: new Date().toISOString(), // 直接使用 UTC 时间戳
        status: 'error',
        tags: item.tags || [],
        statusHistory: existingItem?.statusHistory || [],
    };

    const itemName = formatName(item.name);

    try {
        const response = await axios.get(item.repositoryUrl);
        const projects = response.data;
        const resultProjects = [];
        const downloadDirPath = path.join(downloadDir, itemName);

        ensureDir(downloadDirPath);

        for (const project of projects) {
            const recentVersions = project.versions
                .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
                .slice(0, 3);
            const resultVersions = [];
            for (const version of recentVersions) {
                const fileName = path.basename(version.sourceUrl);
                const localFilePath = path.join(downloadDir, itemName, fileName);

                await downloadFile(version.sourceUrl, localFilePath);

                const ossKey = `plugins/${itemName}/${fileName}`;
                await uploadFileToOSS(localFilePath, ossKey);
                resultVersions.push({
                    ...version,
                    sourceUrl: `https://${OSS_BUCKET_NAME}.${OSS_ENDPOINT}.aliyuncs.com/${ossKey}`
                })
            }
            resultProjects.push({
                ...project,
                versions: resultVersions
            })
        }

        // 保存原始版本（未翻译）
        const originalProjects = JSON.parse(JSON.stringify(resultProjects));
        
        // 翻译插件数据
        const translatedProjects = await translateProjectData(resultProjects);

        // 上传原始版本
        const originalFilePath = path.join(downloadDir, itemName, 'manifest-original.json');
        const originalOssKey = `plugins/${itemName}/manifest-original.json`;
        fs.writeFileSync(originalFilePath, JSON.stringify(originalProjects, null, 2));
        await uploadFileToOSS(originalFilePath, originalOssKey);
        
        // 上传翻译版本
        const translatedFilePath = path.join(downloadDir, itemName, 'manifest.json');
        const translatedOssKey = `plugins/${itemName}/manifest.json`;
        fs.writeFileSync(translatedFilePath, JSON.stringify(translatedProjects, null, 2));
        await uploadFileToOSS(translatedFilePath, translatedOssKey);
        
        result.repositoryUrl = `https://${OSS_BUCKET_NAME}.${OSS_ENDPOINT}.aliyuncs.com/${translatedOssKey}`;
        result.originalRepositoryUrl = `https://${OSS_BUCKET_NAME}.${OSS_ENDPOINT}.aliyuncs.com/${originalOssKey}`;
        result.status = 'success';

    } catch (error) {
        console.error(`Error processing ${item.name}:`, error.message);
        
        // 生成更友好的错误信息
        let friendlyErrorMessage = '';
        if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
            friendlyErrorMessage = '网络连接失败，无法访问目标地址';
        } else if (error.response?.status === 404) {
            friendlyErrorMessage = '目标文件不存在 (404)';
        } else if (error.response?.status === 403) {
            friendlyErrorMessage = '访问被拒绝 (403)';
        } else if (error.response?.status === 500) {
            friendlyErrorMessage = '服务器内部错误 (500)';
        } else if (error.response?.status >= 400 && error.response?.status < 500) {
            friendlyErrorMessage = `客户端错误 (${error.response.status})`;
        } else if (error.response?.status >= 500) {
            friendlyErrorMessage = `服务器错误 (${error.response.status})`;
        } else if (error.message.includes('timeout')) {
            friendlyErrorMessage = '请求超时，网络连接不稳定';
        } else if (error.message.includes('JSON')) {
            friendlyErrorMessage = '响应数据格式错误，无法解析';
        } else if (error.message.includes('certificate')) {
            friendlyErrorMessage = 'SSL证书验证失败';
        } else {
            friendlyErrorMessage = `未知错误: ${error.message}`;
        }
        
        result.errorMessage = friendlyErrorMessage;
    }

    // Update status history - keep last 60 records
    const statusRecord = {
        timestamp: result.timestamp,
        status: result.status,
        error: result.status === 'error' ? result.errorMessage : null
    };
    
    result.statusHistory.unshift(statusRecord);
    if (result.statusHistory.length > 60) {
        result.statusHistory = result.statusHistory.slice(0, 60);
    }

    // Remove temporary error message from result
    delete result.errorMessage;

    return result;
}

/**
 * Processes all manifest items by downloading and uploading their files.
 * Generates a new manifest file with the results.
 *
 * @function processManifest
 * @returns {Promise<void>} - A promise that resolves when all manifest items are processed.
 */
async function processManifest() {
    ensureDir(downloadDir);

    // Load existing manifest data to preserve history
    let existingManifest = [];
    try {
        if (fs.existsSync('./manifest-list.json')) {
            existingManifest = JSON.parse(fs.readFileSync('./manifest-list.json', 'utf8'));
        }
    } catch (error) {
        console.warn('Could not load existing manifest-list.json:', error.message);
    }

    const mainProgressBar = new cliProgress.SingleBar({
        format: 'Main Progress |{bar}| {percentage}% | {value}/{total} | {name}',
        barCompleteChar: '\u2588',
        barIncompleteChar: '\u2591',
        hideCursor: true,
    });

    mainProgressBar.start(originalManifest.length, 0);

    const newManifest = await Promise.all(
        originalManifest.map(async (item, index) => {
            const existingItem = existingManifest.find(existing => existing.name === item.name);
            const result = await processManifestItem(item, existingItem);
            mainProgressBar.update(index + 1, { name: item.name });
            return result;
        })
    );

    mainProgressBar.stop();

    // 生成仓库状态数据供 Vue 组件使用
    const repositoryStatusData = newManifest.map(item => ({
        name: item.name,
        originalUrl: item.originalUrl,
        repositoryUrl: item.repositoryUrl || item.originalUrl,
        timestamp: item.timestamp,
        status: item.status,
        tags: item.tags || [],
        statusHistory: item.statusHistory || [],
        successRate: calculateSuccessRate(item.statusHistory),
        lastError: item.statusHistory && item.statusHistory.length > 0 && item.statusHistory[0].status === 'error' 
            ? item.statusHistory[0].error 
            : null
    }));
    
    // 按优先级排序：official > official-community > 其他
    repositoryStatusData.sort((a, b) => {
        const getPriority = (tags) => {
            if (tags.includes('official')) return 0;
            if (tags.includes('official-community')) return 1;
            return 2;
        };
        return getPriority(a.tags) - getPriority(b.tags);
    });

    // 为 docs/get-started.md 生成 Vue 组件内容（使用 RepoItem）
    const docsTemplateFilePath = './template/get-started.md';
    const docsFilePath = './docs/get-started.md';
    const oldContent = `###########
Repo List
###########`;
    
    // 生成简单的 RepoItem 组件内容
    const repoItemContent = generateRepoItemContent(repositoryStatusData);
    replaceFileContentSync(docsTemplateFilePath, docsFilePath, oldContent, repoItemContent);

    // 为 docs/status.md 生成 Vue 组件内容（使用 RepositoryItem）
    const statusTemplateFilePath = './template/status.md';
    const statusFilePath = './docs/status.md';
    
    // 生成详细的 RepositoryItem 组件内容
    const repositoryItemContent = generateRepositoryItemContent(repositoryStatusData);
    replaceFileContentSync(statusTemplateFilePath, statusFilePath, oldContent, repositoryItemContent);

    fs.writeFileSync('./manifest-list.json', JSON.stringify(newManifest, null, 2));
    
    // 确保 docs/public 目录存在
    const docsPublicDir = path.join(__dirname, '../docs/public');
    ensureDir(docsPublicDir);
    
    // 写入仓库状态数据文件
    fs.writeFileSync(path.join(docsPublicDir, 'repository-status.json'), JSON.stringify(repositoryStatusData, null, 2));
    
    console.log('./manifest-list.json:\n', JSON.stringify(newManifest, null, 2));
    console.log('New manifest-list.json generated successfully.');
    console.log('Repository status data generated at ./docs/public/repository-status.json');
}

function formatName(input) {
    let formatted = input.replace(/[^\w\s]/g, '');
    
    formatted = formatted.replace(/\s+/g, '_');
    
    return formatted;
}


/**
 * @param {string} filePath
 * @param {string} oldContent
 * @param {string} newContent
 * @returns {void}
 */
function replaceFileContentSync(templateFilePath, filePath, oldContent, newContent) {
    const absoluteTemplatePath = path.resolve(templateFilePath);
    const absolutePath = path.resolve(filePath);

    try {
        const data = fs.readFileSync(absoluteTemplatePath, 'utf8');

        const updatedContent = data.replace(oldContent, newContent);

        fs.writeFileSync(absolutePath, updatedContent, 'utf8');

        console.log('The file content has been successfully updated!');
    } catch (err) {
        throw new Error(`File operation failed: ${err.message}`);
    }
}

/**
 * Generate RepoItem component content for get-started.md
 * @param {Array} repositoryStatusData - Array of repository status data
 * @returns {string} - RepoItem component content
 */
function generateRepoItemContent(repositoryStatusData) {
    const repoItemsContent = repositoryStatusData.map(repo => {
        return `<RepoItem
  name="${escapeString(repo.name)}"
  originalUrl="${escapeString(repo.originalUrl)}"
  repositoryUrl="${escapeString(repo.repositoryUrl)}"
  timestamp="${escapeString(repo.timestamp)}"
  status="${escapeString(repo.status)}"
  :successRate="${repo.successRate || 0}"
/>`;
    }).join('\n');

    return repoItemsContent;
}

/**
 * Generate RepositoryItem component content for status.md
 * @param {Array} repositoryStatusData - Array of repository status data
 * @returns {string} - RepositoryItem component content
 */
function generateRepositoryItemContent(repositoryStatusData) {
    const repoItemsContent = repositoryStatusData.map(repo => {
        return `<RepositoryItem
  name="${escapeString(repo.name)}"
  originalUrl="${escapeString(repo.originalUrl)}"
  repositoryUrl="${escapeString(repo.repositoryUrl)}"
  timestamp="${escapeString(repo.timestamp)}"
  status="${escapeString(repo.status)}"
  :successRate="${repo.successRate || 0}"
  tags="${escapeString(JSON.stringify(repo.tags || []))}"
  statusHistory="${escapeString(JSON.stringify(repo.statusHistory || []))}"
  lastError="${escapeString(repo.lastError || '')}"
/>`;
    }).join('\n');

    return repoItemsContent;
}

/**
 * Escape string for Vue template
 * @param {string} str - String to escape
 * @returns {string} - Escaped string
 */
function escapeString(str) {
    return String(str || '').replace(/"/g, '&quot;');
}

/**
 * Calculate success rate from status history
 * @param {Array} history - Array of status records
 * @returns {number} - Success rate percentage
 */
function calculateSuccessRate(history) {
    if (!history || history.length === 0) return 0;
    const successCount = history.filter(record => record.status === 'success').length;
    return Math.round((successCount / history.length) * 100);
}

/**
 * get new Beijing Date
 * @returns new Beijing Date
 */
function getNewBeijingDate () {
    // 直接使用当前时间，后面在显示时转换为北京时间
    return new Date();
}

/**
 * 翻译项目数据中的指定字段
 * @param {Array} projects - 项目数据数组
 * @returns {Promise<Array>} - 翻译后的项目数据数组
 */
async function translateProjectData(projects) {
    // 检查是否配置了百度翻译API
    const { BAIDU_TRANSLATE_APPID, BAIDU_TRANSLATE_SECRET, TRANSLATION_TARGET_LANGUAGE, TRANSLATION_SOURCE_LANGUAGE } = process.env;
    if (!BAIDU_TRANSLATE_APPID || !BAIDU_TRANSLATE_SECRET) {
        console.log('Baidu Translation API not configured, skipping plugin data translation.');
        return projects;
    }

    try {
        const { BaiduTranslator } = require('./translator');
        const translator = new BaiduTranslator(BAIDU_TRANSLATE_APPID, BAIDU_TRANSLATE_SECRET);
        
        // 从环境变量读取翻译配置，默认为 auto -> zh (自动检测 -> 中文)
        const targetLang = TRANSLATION_TARGET_LANGUAGE || 'zh';
        const sourceLang = TRANSLATION_SOURCE_LANGUAGE || 'auto';
        
        console.log(`Translation config: ${sourceLang} -> ${targetLang}`);
        
        // 创建项目数据的深拷贝用于翻译
        const translatedProjects = JSON.parse(JSON.stringify(projects));
        
        // 翻译每个项目的字段
        for (const project of translatedProjects) {
            console.log(`Translating project: ${project.name || 'Unknown'}`);
            
            // 翻译 description - 直接替换原字段内容
            if (project.description) {
                if (shouldTranslateText(project.description)) {
                    try {
                        const originalDescription = project.description;
                        const translated = await translator.translate(originalDescription, sourceLang, targetLang);
                        // 直接替换 description 字段：翻译文本 + 原文
                        project.description = `${translated}\n\n原文: ${originalDescription}`;
                        console.log(`  ✓ Translated description to ${targetLang}`);
                    } catch (error) {
                        console.warn(`  ✗ Failed to translate description:`, error.message);
                    }
                } else {
                    console.log(`  ⏭️ Skipping description (already translated or empty)`);
                }
            }
            
            // 翻译版本信息中的 changelog - 直接替换原字段内容
            if (project.versions) {
                for (const version of project.versions) {
                    if (version.changelog) {
                        if (shouldTranslateText(version.changelog)) {
                            try {
                                const originalChangelog = version.changelog;
                                const translated = await translator.translate(originalChangelog, sourceLang, targetLang);
                                // 直接替换 changelog 字段：翻译文本 + 原文
                                version.changelog = `${translated}\n\n原文: ${originalChangelog}`;
                                console.log(`  ✓ Translated changelog (v${version.version}) to ${targetLang}`);
                            } catch (error) {
                                console.warn(`  ✗ Failed to translate changelog:`, error.message);
                            }
                        } else {
                            console.log(`  ⏭️ Skipping changelog (v${version.version}) (already translated or empty)`);
                        }
                    }
                }
            }
        }
        
        // 保存翻译缓存
        translator.saveCache();
        console.log('Project data translation completed.');
        
        return translatedProjects;
        
    } catch (error) {
        console.error('Project data translation failed:', error.message);
        return projects; // 翻译失败时返回原始数据
    }
}

/**
 * 判断文本是否需要翻译
 * @param {string} text - 要检查的文本
 * @returns {boolean} - 是否需要翻译
 */
function shouldTranslateText(text) {
    if (!text || typeof text !== 'string' || text.trim() === '') {
        return false;
    }
    
    // 检查是否已经包含翻译标记（更精确的检查）
    const translationPattern = /\n\n原文:\s/;
    if (translationPattern.test(text)) {
        return false;
    }
    
    // 检查是否是已翻译的格式（以"原文:"结尾的情况）
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

processManifest();
