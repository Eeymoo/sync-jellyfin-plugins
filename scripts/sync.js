require('dotenv').config();
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const OSS = require('ali-oss');
const cliProgress = require('cli-progress');

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
        timestamp: getNewBeijingDate().toISOString(),
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


        const localFilePath = path.join(downloadDir, itemName, 'manifest.json');
        const ossKey = `plugins/${itemName}/manifest.json`;
        fs.writeFileSync(localFilePath, JSON.stringify(resultProjects, null, 2));
        await uploadFileToOSS(localFilePath, ossKey);
        result.repositoryUrl = `https://${OSS_BUCKET_NAME}.${OSS_ENDPOINT}.aliyuncs.com/${ossKey}`;
        result.status = 'success';

    } catch (error) {
        console.error(`Error processing ${item.name}:`, error.message);
        result.errorMessage = error.message;
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

    const templateFilePath = './template/README.md';
    const filePath = './README.md';
    const oldContent = `###########
Repo List
###########`;
    const newContent = newManifest.map(item => `
- **[${item.name}](${item.originalUrl})** ${item.timestamp}
  - **标签**: ${item.tags?.length ? item.tags.map(tag => `\`${tag}\``).join(', ') : '无'}
  - **状态**: ${item.status === 'success' ? '✅ 成功' : '❌ 失败'}
  - **成功率**: ${item.statusHistory?.length ? calculateSuccessRate(item.statusHistory) : 0}%

\`\`\`
${item.repositoryUrl || item.originalUrl}
\`\`\`
`).join('\n');

    replaceFileContentSync(templateFilePath, filePath, oldContent, newContent);

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
    const UTC = new Date().getTime();
    const offsetMS = 8 * 60 * 60 * 1000;
    const newBeijingDate = new Date(UTC + offsetMS);
    return newBeijingDate
}

processManifest();
