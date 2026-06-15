import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import OSS from 'ali-oss';
import cliProgress from 'cli-progress';
import { BaiduTranslator } from './translator.js';

const { OSS_ACCESS_KEY_ID, OSS_ACCESS_KEY_SECRET, OSS_ENDPOINT, OSS_BUCKET_NAME } = process.env;

const bucket = new OSS({
    accessKeyId: OSS_ACCESS_KEY_ID,
    accessKeySecret: OSS_ACCESS_KEY_SECRET,
    region: OSS_ENDPOINT,
    authorizationV4: true,
    bucket: OSS_BUCKET_NAME,
});

const originalManifest = JSON.parse(fs.readFileSync('./original-manifest-list.json', 'utf8'));
const downloadDir = path.join(import.meta.dir, '../download');

// OSS 中保存同步状态的 key，用于增量对比、避免重复推送
const SYNC_STATE_KEY = 'plugins/_sync-state.json';

// 内存中的同步状态表
let syncState = {};
let syncStateChanged = false;

/**
 * 确保目录存在，不存在则创建
 * @param {string} dir
 */
function ensureDir(dir) {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function md5hex(text) {
    return crypto.createHash('md5').update(text).digest('hex');
}

/**
 * 从 OSS 加载上一次的同步状态
 * 状态表记录每个 ossKey 对应的源文件元信息（etag/lastModified/size/contentMd5），
 * 用于本次运行时判断是否需要重新下载 / 上传。
 */
async function loadSyncState() {
    try {
        const result = await bucket.get(SYNC_STATE_KEY);
        const text = await new Response(result.content).text();
        syncState = JSON.parse(text);
        console.log(`Loaded sync state: ${Object.keys(syncState).length} entries`);
    } catch (err) {
        if (err.code === 'NoSuchKey' || err.status === 404) {
            console.log('No existing sync state, starting fresh');
        } else {
            console.warn('Could not load sync state from OSS:', err.message);
        }
        syncState = {};
    }
}

/**
 * 保存同步状态到 OSS（仅当发生变化时）
 */
async function saveSyncState() {
    if (!syncStateChanged) {
        console.log('Sync state unchanged, skipping save');
        return;
    }
    const content = JSON.stringify(syncState, null, 2);
    try {
        await bucket.put(SYNC_STATE_KEY, Buffer.from(content));
        console.log(`Saved sync state: ${Object.keys(syncState).length} entries`);
    } catch (err) {
        console.warn('Failed to save sync state:', err.message);
    }
}

/**
 * 通过 HEAD 请求获取上游文件元信息，用于判断是否有更新
 * @param {string} url
 * @returns {Promise<{etag?: string, lastModified?: string, contentLength?: string} | null>}
 */
async function fetchUpstreamMeta(url) {
    try {
        const response = await fetch(url, { method: 'HEAD' });
        if (!response.ok) return null;
        return {
            etag: response.headers.get('etag') || null,
            lastModified: response.headers.get('last-modified') || null,
            contentLength: response.headers.get('content-length') || null,
        };
    } catch (err) {
        console.warn(`  ⚠ HEAD 请求失败 ${url}: ${err.message}`);
        return null;
    }
}

/**
 * 判断上游文件是否相对上次同步发生变化
 * 优先比较 ETag，其次 Last-Modified，最后 Content-Length
 * @param {Object|null} stored - syncState 中保存的元信息
 * @param {Object|null} current - 当前上游 HEAD 返回的元信息
 * @returns {boolean} - true 表示有变化需要重新下载
 */
function upstreamMetaChanged(stored, current) {
    if (!stored || !current) return true;

    if (current.etag && stored.etag) {
        return current.etag !== stored.etag;
    }
    if (current.lastModified && stored.lastModified) {
        return current.lastModified !== stored.lastModified;
    }
    if (current.contentLength && stored.contentLength) {
        return current.contentLength !== stored.contentLength;
    }
    // 没有可对比的元信息，保险起见重新下载
    return true;
}

/**
 * 使用 Bun 原生 fetch 下载文件到本地
 * 文件通常较小，直接整体写入，省去进度条带来的 CI 日志噪音
 * @param {string} url
 * @param {string} filePath
 */
async function downloadFile(url, filePath) {
    console.log(`  ↓ Downloading ${path.basename(filePath)} ...`);
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`下载失败 HTTP ${response.status}: ${url}`);
    }
    ensureDir(path.dirname(filePath));
    await Bun.write(filePath, response);
}

/**
 * 上传本地文件到 OSS
 * @param {string} filePath
 * @param {string} ossKey
 */
async function uploadFileToOSS(filePath, ossKey) {
    console.log(`  ↑ Uploading ${path.basename(filePath)} -> ${ossKey}`);
    const fileBuffer = fs.readFileSync(filePath);
    await bucket.put(ossKey, fileBuffer);
}

/**
 * 直接将字符串内容上传到 OSS（用于本地生成的 manifest 文件）
 * @param {string} content
 * @param {string} ossKey
 */
async function uploadBufferToOSS(content, ossKey) {
    console.log(`  ↑ Uploading -> ${ossKey}`);
    await bucket.put(ossKey, Buffer.from(content));
}

/**
 * 处理单个 manifest 条目：下载并上传插件文件
 * 核心优化：先与 OSS 已同步状态做差异对比，未变化的文件直接跳过
 *
 * @param {Object} item
 * @param {Object|null} existingItem
 * @returns {Promise<Object>}
 */
async function processManifestItem(item, existingItem = null) {
    const result = {
        name: item.name,
        originalUrl: item.repositoryUrl,
        repositoryUrl: '',
        timestamp: new Date().toISOString(),
        status: 'error',
        tags: item.tags || [],
        statusHistory: existingItem?.statusHistory || [],
    };

    const itemName = formatName(item.name);

    const hasVersionConfig = item.versions && Object.keys(item.versions).length > 0;
    const supportedVersions = item.versions || {};
    const versions = Object.keys(supportedVersions);

    // 封装一次真正的处理尝试
    const attemptProcess = async () => {
        let manifestsByVersion = {};

        if (hasVersionConfig) {
            for (const version of versions) {
                const headers = { 'User-Agent': `Jellyfin-Server/${version}` };
                try {
                    const response = await fetch(item.repositoryUrl, { headers });
                    if (!response.ok) throw new Error(`HTTP ${response.status}`);
                    manifestsByVersion[version] = await response.json();
                    console.log(`[${item.name}] 成功获取 Jellyfin ${version} 版本的 manifest`);
                } catch (error) {
                    console.warn(`[${item.name}] 获取 Jellyfin ${version} manifest 失败: ${error.message}`);
                    // 某个版本失败时使用默认请求兜底
                    const response = await fetch(item.repositoryUrl);
                    if (!response.ok) throw new Error(`默认请求也失败 HTTP ${response.status}`);
                    manifestsByVersion[version] = await response.json();
                    console.log(`[${item.name}] 使用默认请求获取 Jellyfin ${version} 的 manifest`);
                }
            }
        } else {
            console.log(`[${item.name}] 没有版本配置，使用原始方式获取 manifest`);
            const response = await fetch(item.repositoryUrl);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            manifestsByVersion['default'] = await response.json();
        }

        const downloadDirPath = path.join(downloadDir, itemName);
        ensureDir(downloadDirPath);

        for (const [version, projects] of Object.entries(manifestsByVersion)) {
            if (hasVersionConfig) {
                const versionInfo = supportedVersions[version];
                console.log(`[${item.name}] 处理版本: ${version} - ${versionInfo.title}`);
            } else {
                console.log(`[${item.name}] 处理默认版本`);
            }

            const resultProjects = [];

            for (const project of projects) {
                const recentVersions = project.versions
                    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
                    .slice(0, 3);
                const resultVersions = [];

                for (const projectVersion of recentVersions) {
                    const fileName = path.basename(projectVersion.sourceUrl);
                    const localFilePath = path.join(downloadDirPath, fileName);
                    const ossKey = `plugins/${itemName}/${fileName}`;
                    const mirrorUrl = `https://${OSS_BUCKET_NAME}.${OSS_ENDPOINT}.aliyuncs.com/${ossKey}`;

                    // ===== 差异对比：HEAD 上游，若与已同步状态一致则跳过 =====
                    const currentMeta = await fetchUpstreamMeta(projectVersion.sourceUrl);
                    const storedMeta = syncState[ossKey];

                    if (
                        currentMeta &&
                        storedMeta &&
                        !upstreamMetaChanged(storedMeta, currentMeta)
                    ) {
                        console.log(`  ⏭ Skip unchanged: ${ossKey}`);
                        resultVersions.push({ ...projectVersion, sourceUrl: mirrorUrl });
                        continue;
                    }

                    // 有变化（或首次同步）：重新下载 + 上传
                    await downloadFile(projectVersion.sourceUrl, localFilePath);
                    await uploadFileToOSS(localFilePath, ossKey);

                    syncState[ossKey] = {
                        type: 'mirror',
                        sourceUrl: projectVersion.sourceUrl,
                        etag: currentMeta?.etag || null,
                        lastModified: currentMeta?.lastModified || null,
                        contentLength: currentMeta?.contentLength || null,
                        updatedAt: new Date().toISOString(),
                    };
                    syncStateChanged = true;

                    resultVersions.push({ ...projectVersion, sourceUrl: mirrorUrl });
                }

                resultProjects.push({ ...project, versions: resultVersions });
            }

            // 生成 manifest（原始 + 翻译）
            const originalProjects = JSON.parse(JSON.stringify(resultProjects));
            const translatedProjects = await translateProjectData(resultProjects);

            // 准备需要保存的文件列表（本地生成、通过 md5 判断是否需要上传）
            let filesToSave;
            if (hasVersionConfig) {
                filesToSave = [
                    {
                        ossKey: `plugins/${itemName}/manifest-original-${version}.json`,
                        content: JSON.stringify(originalProjects, null, 2),
                    },
                    {
                        ossKey: `plugins/${itemName}/manifest-${version}.json`,
                        content: JSON.stringify(translatedProjects, null, 2),
                    },
                ];
            } else {
                filesToSave = [
                    {
                        ossKey: `plugins/${itemName}/manifest-original.json`,
                        content: JSON.stringify(originalProjects, null, 2),
                    },
                    {
                        ossKey: `plugins/${itemName}/manifest.json`,
                        content: JSON.stringify(translatedProjects, null, 2),
                    },
                ];
            }

            for (const { ossKey, content } of filesToSave) {
                const md5 = md5hex(content);
                const stored = syncState[ossKey];

                if (stored && stored.contentMd5 === md5) {
                    console.log(`  ⏭ Skip unchanged manifest: ${ossKey}`);
                    continue;
                }

                const localPath = path.join(downloadDirPath, path.basename(ossKey));
                fs.writeFileSync(localPath, content);
                await uploadBufferToOSS(content, ossKey);

                syncState[ossKey] = {
                    type: 'generated',
                    contentMd5: md5,
                    updatedAt: new Date().toISOString(),
                };
                syncStateChanged = true;
            }
        }

        // 设置 result 的 URL 信息
        if (hasVersionConfig) {
            const defaultVersion = versions.includes('10.11') ? '10.11' : versions[0];
            result.repositoryUrl = `https://${OSS_BUCKET_NAME}.${OSS_ENDPOINT}.aliyuncs.com/plugins/${itemName}/manifest-${defaultVersion}.json`;
            result.originalRepositoryUrl = `https://${OSS_BUCKET_NAME}.${OSS_ENDPOINT}.aliyuncs.com/plugins/${itemName}/manifest-original-${defaultVersion}.json`;

            result.versionUrls = {};
            for (const version of versions) {
                const versionInfo = supportedVersions[version];
                result.versionUrls[version] = {
                    translated: `https://${OSS_BUCKET_NAME}.${OSS_ENDPOINT}.aliyuncs.com/plugins/${itemName}/manifest-${version}.json`,
                    original: `https://${OSS_BUCKET_NAME}.${OSS_ENDPOINT}.aliyuncs.com/plugins/${itemName}/manifest-original-${version}.json`,
                    title: versionInfo.title,
                    description: versionInfo.description,
                };
            }
        } else {
            result.repositoryUrl = `https://${OSS_BUCKET_NAME}.${OSS_ENDPOINT}.aliyuncs.com/plugins/${itemName}/manifest.json`;
            result.originalRepositoryUrl = `https://${OSS_BUCKET_NAME}.${OSS_ENDPOINT}.aliyuncs.com/plugins/${itemName}/manifest-original.json`;
            result.versionUrls = {};
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
        } else if (error.response?.status === 404 || error.status === 404) {
            return '目标文件不存在 (404)';
        } else if (error.response?.status === 403 || error.status === 403) {
            return '访问被拒绝 (403)';
        } else if (error.response?.status === 500 || error.status === 500) {
            return '服务器内部错误 (500)';
        } else if ((error.response?.status >= 400 && error.response?.status < 500) || (error.status >= 400 && error.status < 500)) {
            return `客户端错误 (${error.response?.status || error.status})`;
        } else if ((error.response?.status >= 500) || (error.status >= 500)) {
            return `服务器错误 (${error.response?.status || error.status})`;
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
            console.log(`[${item.name}] 尝试(${phase}) ${idx + 1}/${total}`);
            await attemptProcess();
            console.log(`[${item.name}] 成功 (${phase}) 尝试 ${idx + 1}`);
            return true;
        } catch (err) {
            lastError = err;
            console.warn(`[${item.name}] 失败 (${phase}) 尝试 ${idx + 1}: ${err.message}`);
            return false;
        }
    };

    let success = await runAttempt('初始', 0, 1);

    if (!success) {
        for (let i = 0; i < firstRetryDelays.length && !success; i++) {
            const delay = firstRetryDelays[i];
            console.log(`[${item.name}] ${delay / 1000}s 后进行第 ${i + 1} 次重试`);
            await sleep(delay);
            success = await runAttempt('第一组重试', i + 1, firstRetryDelays.length);
        }
    }

    if (!success) {
        console.log(`[${item.name}] 第一组全部失败，进入最后一组重试`);
        for (let i = 0; i < finalRetryDelays.length && !success; i++) {
            const delay = finalRetryDelays[i];
            console.log(`[${item.name}] 最终重试：${delay / 1000}s 后进行第 ${i + 1} 次尝试`);
            await sleep(delay);
            success = await runAttempt('最后一组重试', i + 1, finalRetryDelays.length);
        }
    }

    if (!success) {
        const friendlyErrorMessage = buildFriendlyMessage(lastError || {});
        result.errorMessage = friendlyErrorMessage;
        result.status = 'error';
        console.error(`Error processing ${item.name}: ${friendlyErrorMessage}`);
    }

    const statusRecord = {
        timestamp: result.timestamp,
        status: result.status,
        error: result.status === 'error' ? result.errorMessage : null,
    };
    result.statusHistory.unshift(statusRecord);
    if (result.statusHistory.length > 60) {
        result.statusHistory = result.statusHistory.slice(0, 60);
    }
    delete result.errorMessage;

    return result;
}

/**
 * 处理所有 manifest 条目并生成新的 manifest 文件、文档
 */
async function processManifest() {
    ensureDir(downloadDir);

    // 加载 OSS 同步状态，用于增量对比
    await loadSyncState();

    // 读取本地历史 manifest，保留状态历史
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

    // 处理完成后持久化同步状态
    await saveSyncState();

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
            : null,
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

    const docsTemplateFilePath = './template/get-started.md';
    const docsFilePath = './docs/get-started.md';
    const oldContent = `###########
Repo List
###########`;

    const repoItemContent = generateRepoItemContent(repositoryStatusData);
    replaceFileContentSync(docsTemplateFilePath, docsFilePath, oldContent, repoItemContent);

    const statusTemplateFilePath = './template/status.md';
    const statusFilePath = './docs/status.md';

    const repositoryItemContent = generateRepositoryItemContent(repositoryStatusData);
    replaceFileContentSync(statusTemplateFilePath, statusFilePath, oldContent, repositoryItemContent);

    fs.writeFileSync('./manifest-list.json', JSON.stringify(newManifest, null, 2));

    const docsPublicDir = path.join(import.meta.dir, '../docs/public');
    ensureDir(docsPublicDir);

    fs.writeFileSync(
        path.join(docsPublicDir, 'repository-status.json'),
        JSON.stringify(repositoryStatusData, null, 2)
    );

    console.log('New manifest-list.json generated successfully.');
    console.log('Repository status data generated at ./docs/public/repository-status.json');
}

function formatName(input) {
    let formatted = input.replace(/[^\w\s]/g, '');
    formatted = formatted.replace(/\s+/g, '_');
    return formatted;
}

/**
 * 读取模板文件，将占位内容替换为新内容后写入目标文件
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
 * 生成 get-started.md 用的 RepoItem 组件内容
 */
function generateRepoItemContent(repositoryStatusData) {
    return repositoryStatusData.map(repo => {
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
}

/**
 * 生成 status.md 用的 RepositoryItem 组件内容
 */
function generateRepositoryItemContent(repositoryStatusData) {
    return repositoryStatusData.map(repo => {
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
}

function escapeString(str) {
    return String(str || '').replace(/"/g, '&quot;');
}

function calculateSuccessRate(history) {
    if (!history || history.length === 0) return 0;
    const successCount = history.filter(record => record.status === 'success').length;
    return Math.round((successCount / history.length) * 100);
}

/**
 * 翻译项目数据中的指定字段
 */
async function translateProjectData(projects) {
    const { BAIDU_TRANSLATE_APPID, BAIDU_TRANSLATE_SECRET, TRANSLATION_TARGET_LANGUAGE, TRANSLATION_SOURCE_LANGUAGE } = process.env;
    if (!BAIDU_TRANSLATE_APPID || !BAIDU_TRANSLATE_SECRET) {
        console.log('Baidu Translation API not configured, skipping plugin data translation.');
        return projects;
    }

    try {
        const translator = new BaiduTranslator(BAIDU_TRANSLATE_APPID, BAIDU_TRANSLATE_SECRET);

        const targetLang = TRANSLATION_TARGET_LANGUAGE || 'zh';
        const sourceLang = TRANSLATION_SOURCE_LANGUAGE || 'auto';

        console.log(`Translation config: ${sourceLang} -> ${targetLang}`);

        const translatedProjects = JSON.parse(JSON.stringify(projects));

        for (const project of translatedProjects) {
            console.log(`Translating project: ${project.name || 'Unknown'}`);

            if (project.description) {
                if (shouldTranslateText(project.description)) {
                    try {
                        const originalDescription = project.description;
                        const translated = await translator.translate(originalDescription, sourceLang, targetLang);
                        project.description = `${translated}<br><br>原文: ${originalDescription}`;
                        console.log(`  ✓ Translated description to ${targetLang}`);
                    } catch (error) {
                        console.warn(`  ✗ Failed to translate description:`, error.message);
                    }
                } else {
                    console.log(`  ⏭️ Skipping description (already translated or empty)`);
                }
            }

            if (project.versions) {
                for (const version of project.versions) {
                    if (version.changelog) {
                        if (shouldTranslateText(version.changelog)) {
                            try {
                                const originalChangelog = version.changelog;
                                const translated = await translator.translate(originalChangelog, sourceLang, targetLang);
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

        translator.saveCache();
        console.log('Project data translation completed.');

        return translatedProjects;
    } catch (error) {
        console.error('Project data translation failed:', error.message);
        return projects;
    }
}

function shouldTranslateText(text) {
    if (!text || typeof text !== 'string' || text.trim() === '') {
        return false;
    }

    const translationPattern = /<br><br>原文:\s/;
    if (translationPattern.test(text)) {
        return false;
    }

    if (text.includes('<br><br>原文: ')) {
        return false;
    }

    const oldTranslationPattern = /\n\n原文:\s/;
    if (oldTranslationPattern.test(text)) {
        return false;
    }

    if (text.includes('\n\n原文: ')) {
        return false;
    }

    if (text.trim().length < 3) {
        return false;
    }

    const nonTranslatablePattern = /^[\d\s\.\-_,;:!()\[\]{}\/\\@#$%^&*+=<>?|`~"']*$/;
    if (nonTranslatablePattern.test(text.trim())) {
        return false;
    }

    return true;
}

processManifest();
