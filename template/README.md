# sync-jellyfin-plugins

## 项目简介

`sync-jellyfin-plugins` 是一个专门为 Jellyfin 用户设计的插件同步仓库项目，**仅适用于中国大陆地区**。该项目旨在提供一个稳定、高效的插件同步服务，确保用户能够及时获取到最新的插件版本。


## 上游

镜像的基础上游同步地址是 [Plugins | Jellyfin](https://jellyfin.org/docs/general/server/plugins/#official-jellyfin-plugin-repositories) 获取的 `manifest.json` 中的地址，也有一些常用的例如 `Metashark` 等选取了官方仓库作为上游同步仓库。

## 主要功能

- **每晚 24 点同步镜像仓库**：项目会在每天晚上 24 点自动同步 Jellyfin 插件仓库，确保插件库始终保持最新。
  
- **保留最新的 3 个版本**：为了节省存储空间并保持简洁，项目只保留每个插件的最新 3 个版本。

- **插件自动更新推荐时间**：建议将插件的自动更新时间调整为**晚上 2 点之后**，以避免与同步任务冲突，并确保插件更新时的网络稳定性。

## 如何添加其他同步内容

如果你需要同步其他插件仓库，可以通过合并代码到 `original-manifest-list.json` 文件来实现。该文件定义了需要同步的插件仓库列表。

### 示例

以下是一个 `original-manifest-list.json` 文件的示例，展示了如何添加一个名为 "IntroSkipper's Repo" 的插件仓库：

```json
[
    {
      "name": "IntroSkipper's Repo",
      "repositoryUrl": "https://manifest.intro-skipper.org/manifest.json"
    }
]
```

你可以根据需要添加更多的插件仓库到该列表中。

## 使用说明

### 1. 克隆仓库
首先，克隆本项目到本地。

```bash
git clone https://github.com/Eeymoo/sync-jellyfin-plugins.git
```

### 2. 添加自定义仓库
如果需要同步其他插件仓库，编辑 `original-manifest-list.json` 文件，添加相应的仓库信息。

### 3. 自动同步
项目会每晚 24 点自动同步插件仓库，并保留最新的 3 个版本。

### 4. 调整插件更新时间
建议将 Jellyfin 的插件自动更新时间调整为晚上 2 点之后，以避免与同步任务冲突。

### 5. 支持 Repo 内容
本仓库支持多种插件 Repo 的同步，以下是一些推荐的插件仓库及其 URL。你可以将以下 URL 添加到 Jellyfin 的插件仓库设置中，以使用这些 Repo 的插件：

###########
Repo List
###########

根据需要，你可以添加更多支持的 Repo 到 Jellyfin 的插件仓库设置中。

## 贡献

欢迎提交 Pull Request 来改进本项目。如果你有任何问题或建议，请通过 Issues 页面进行反馈。

## 许可证

本项目采用 [MIT 许可证](LICENSE)。