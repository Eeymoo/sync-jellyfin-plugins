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
 * @returns {Promise<Object>} - A promise that resolves to an object containing the processing result.
 * @property {string} name - The name of the item.
 * @property {string} originalUrl - The original repository URL.
 * @property {string} repositoryUrl - The new OSS URL for the item's files.
 * @property {string} timestamp - The timestamp of the processing.
 * @property {string} status - The status of the processing ('success' or 'error').
 */
async function processManifestItem(item) {
    const result = {
        name: item.name,
        originalUrl: item.repositoryUrl,
        repositoryUrl: '',
        timestamp: new Date().toISOString(),
        status: 'error',
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
    }

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

    const mainProgressBar = new cliProgress.SingleBar({
        format: 'Main Progress |{bar}| {percentage}% | {value}/{total} | {name}',
        barCompleteChar: '\u2588',
        barIncompleteChar: '\u2591',
        hideCursor: true,
    });

    mainProgressBar.start(originalManifest.length, 0);

    const newManifest = await Promise.all(
        originalManifest.map(async (item, index) => {
            const result = await processManifestItem(item);
            mainProgressBar.update(index + 1, { name: item.name });
            return result;
        })
    );

    mainProgressBar.stop();

    fs.writeFileSync('./manifest-list.json', JSON.stringify(newManifest, null, 2));
    console.log('./manifest-list.json:\n', JSON.stringify(newManifest, null, 2));
    console.log('New manifest-list.json generated successfully.');
}

function formatName(input) {
    let formatted = input.replace(/[^\w\s]/g, '');
    
    formatted = formatted.replace(/\s+/g, '_');
    
    return formatted;
}
processManifest();
