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

// 简单 sleep 工具
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
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

    // 从配置中获取支持的版本，如果没有配置则使用默认版本
    const supportedVersions = item.versions || { "10.11": { title: "默认版本", description: "标准插件版本" } };
    const versions = Object.keys(supportedVersions);

    // 封装一次真正的处理尝试
    const attemptProcess = async () => {
        const manifestsByVersion = {};
        
        for (const version of versions) {
            try {
                const headers = { 'User-Agent': `Jellyfin-Server/${version}` };
                const response = await axios.get(item.repositoryUrl, { headers });
                manifestsByVersion[version] = response.data;
                console.log(`[${item.name}] 成功获取 Jellyfin ${version} 版本的 manifest`);
            } catch (error) {
                console.warn(`[${item.name}] 获取 Jellyfin ${version} manifest 失败:`, error.message);
                // 如果某个版本失败，使用默认请求
                try {
                    const response = await axios.get(item.repositoryUrl);
                    manifestsByVersion[version] = response.data;
                    console.log(`[${item.name}] 使用默认请求获取 Jellyfin ${version} 的 manifest`);
                } catch (fallbackError) {
                    console.error(`[${item.name}] 默认请求也失败:`, fallbackError.message);
                    throw fallbackError;
                }
            }
        }
        
        // 处理每个版本的 manifest
        const downloadDirPath = path.join(downloadDir, itemName);
        ensureDir(downloadDirPath);
        
        for (const [version, projects] of Object.entries(manifestsByVersion)) {
            const versionInfo = supportedVersions[version];
            console.log(`[${item.name}] 处理版本: ${version} - ${versionInfo.title}`);
            
            const resultProjects = [];
            
            for (const project of projects) {
                const recentVersions = project.versions
                    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
                    .slice(0, 3);
                const resultVersions = [];
                for (const projectVersion of recentVersions) {
                    const fileName = path.basename(projectVersion.sourceUrl);
                    const localFilePath = path.join(downloadDir, itemName, fileName);
                    await downloadFile(projectVersion.sourceUrl, localFilePath);
                    const ossKey = `plugins/${itemName}/${fileName}`;
                    await uploadFileToOSS(localFilePath, ossKey);
                    resultVersions.push({
                        ...projectVersion,
                        sourceUrl: `https://${OSS_BUCKET_NAME}.${OSS_ENDPOINT}.aliyuncs.com/${ossKey}`
                    });
                }
                resultProjects.push({
                    ...project,
                    versions: resultVersions
                });
            }
            
            // 为每个 Jellyfin 版本保存不同的 manifest 文件
            const originalProjects = JSON.parse(JSON.stringify(resultProjects));
            const translatedProjects = await translateProjectData(resultProjects);
            
            // 原始版本文件
            const originalFilePath = path.join(downloadDir, itemName, `manifest-original-${version}.json`);
            const originalOssKey = `plugins/${itemName}/manifest-original-${version}.json`;
            fs.writeFileSync(originalFilePath, JSON.stringify(originalProjects, null, 2));
            await uploadFileToOSS(originalFilePath, originalOssKey);
            
            // 翻译版本文件
            const translatedFilePath = path.join(downloadDir, itemName, `manifest-${version}.json`);
            const translatedOssKey = `plugins/${itemName}/manifest-${version}.json`;
            fs.writeFileSync(translatedFilePath, JSON.stringify(translatedProjects, null, 2));
            await uploadFileToOSS(translatedFilePath, translatedOssKey);
        }
        
        // 获取默认版本
        const defaultVersion = versions.includes('10.11') ? '10.11' : versions[0];
        
        // 默认使用配置的首选版本作为主要访问地址
        result.repositoryUrl = `https://${OSS_BUCKET_NAME}.${OSS_ENDPOINT}.aliyuncs.com/plugins/${itemName}/manifest-${defaultVersion}.json`;
        result.originalRepositoryUrl = `https://${OSS_BUCKET_NAME}.${OSS_ENDPOINT}.aliyuncs.com/plugins/${itemName}/manifest-original-${defaultVersion}.json`;
        
        // 保存版本信息，包含版本配置
        result.versionUrls = {};
        for (const version of versions) {
            const versionInfo = supportedVersions[version];
            result.versionUrls[version] = {
                translated: `https://${OSS_BUCKET_NAME}.${OSS_ENDPOINT}.aliyuncs.com/plugins/${itemName}/manifest-${version}.json`,
                original: `https://${OSS_BUCKET_NAME}.${OSS_ENDPOINT}.aliyuncs.com/plugins/${itemName}/manifest-original-${version}.json`,
                title: versionInfo.title,
                description: versionInfo.description
            };
        }
        
        result.status = 'success';
    };

    const firstRetryDelays = [30000, 60000, 120000]; // 30s / 60s / 120s
    const finalRetryDelays = [30000, 60000, 120000]; // 最后再 3 次

    let lastError = null;

    const buildFriendlyMessage = (error) => {
        if (!error) return '';
        if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
            return '网络连接失败，无法访问目标地址';
        } else if (error.response?.status === 404) {
            return '目标文件不存在 (404)';
        } else if (error.response?.status === 403) {
            return '访问被拒绝 (403)';
        } else if (error.response?.status === 500) {
            return '服务器内部错误 (500)';
        } else if (error.response?.status >= 400 && error.response?.status < 500) {
            return `客户端错误 (${error.response.status})`;
        } else if (error.response?.status >= 500) {
            return `服务器错误 (${error.response.status})`;
        } else if (error.message?.includes('timeout')) {
            return '请求超时，网络连接不稳定';
        } else if (error.message?.includes('JSON')) {
            return '响应数据格式错误，无法解析';
        } else if (error.message?.includes('certificate')) {
            return 'SSL证书验证失败';
        } else {
            return `未知错误: ${error.message}`;
        }
    };

    const runAttempt = async (phase, idx, total) => {
        try {
            console.log(`[${item.name}] 尝试(${phase}) ${idx+1}/${total}`);
            await attemptProcess();
            console.log(`[${item.name}] 成功 (${phase}) 尝试 ${idx+1}`);
            return true;
        } catch (err) {
            lastError = err;
            console.warn(`[${item.name}] 失败 (${phase}) 尝试 ${idx+1}: ${err.message}`);
            return false;
        }
    };

    // 初始尝试
    let success = await runAttempt('初始', 0, 1);

    // 第一组重试
    if (!success) {
        for (let i = 0; i < firstRetryDelays.length && !success; i++) {
            const delay = firstRetryDelays[i];
            console.log(`[${item.name}] ${delay/1000}s 后进行第 ${i+1} 次重试`);
            await sleep(delay);
            success = await runAttempt('第一组重试', i+1, firstRetryDelays.length);
        }
    }

    // 最后一组重试
    if (!success) {
        console.log(`[${item.name}] 第一组全部失败，进入最后一组重试`);
        for (let i = 0; i < finalRetryDelays.length && !success; i++) {
            const delay = finalRetryDelays[i];
            console.log(`[${item.name}] 最终重试：${delay/1000}s 后进行第 ${i+1} 次尝试`);
            await sleep(delay);
            success = await runAttempt('最后一组重试', i+1, finalRetryDelays.length);
        }
    }

    if (!success) {
        const friendlyErrorMessage = buildFriendlyMessage(lastError || {});
        result.errorMessage = friendlyErrorMessage;
        result.status = 'error';
        console.error(`Error processing ${item.name}: ${friendlyErrorMessage}`);
    }

    // 只记录一次最终结果
    const statusRecord = {
        timestamp: result.timestamp,
        status: result.status,
        error: result.status === 'error' ? result.errorMessage : null
    };
    result.statusHistory.unshift(statusRecord);
    if (result.statusHistory.length > 60) {
        result.statusHistory = result.statusHistory.slice(0, 60);
    }
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
        versionUrls: item.versionUrls || {},
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
  versionUrls="${escapeString(JSON.stringify(repo.versionUrls || {}))}"
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
  versionUrls="${escapeString(JSON.stringify(repo.versionUrls || {}))}"
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
                        // 直接替换 description 字段：翻译文本 + 原文（使用 <br> 换行）
                        project.description = `${translated}<br><br>原文: ${originalDescription}`;
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
                                // 直接替换 changelog 字段：翻译文本 + 原文（使用 <br> 换行）
                                version.changelog = `${translated}<br><br>原文: ${originalChangelog}`;
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
