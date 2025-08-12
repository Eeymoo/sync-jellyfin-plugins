# Jellyfin 插件镜像同步

## 项目简介

为中国大陆地区的 Jellyfin 用户提供的插件镜像同步服务。本项目自动同步多个主流 Jellyfin 插件仓库，解决国内用户访问官方插件仓库速度慢或无法访问的问题。

## 特性

- 🔄 **自动同步**：每日 0:00\\6:00\\12:00\\18:00 自动同步所有上游插件仓库
- 📦 **版本管理**：保留每个插件的最新 3 个版本，确保稳定性
- 🚀 **快速访问**：国内 CDN 加速，下载速度显著提升
- 📊 **状态监控**：实时监控同步状态和成功率
- 🛡️ **可靠性**：多仓库支持，降低单点故障风险
- 🌐 **智能翻译**：集成百度翻译 API，提供中文本地化

## 同步机制

### 上游仓库
项目同步的上游地址来源于：
- [Jellyfin 官方插件仓库](https://jellyfin.org/docs/general/server/plugins/#official-jellyfin-plugin-repositories)
- 社区维护的第三方插件仓库（如 Metashark 等）

### 同步策略
- **同步时间**：每晚 0:00\\6:00\\12:00\\18:00 自动执行
- **版本保留**：保留最新 3 个版本
- **重试机制**：网络失败时自动重试
- **状态记录**：记录每次同步的成功/失败状态

### 翻译服务
- **百度翻译 API**：[https://fanyi-api.baidu.com/](https://fanyi-api.baidu.com/)
- **免费额度**：每月 5 万字符
- **支持语言**：自动识别并翻译为中文
- **智能缓存**：避免重复翻译相同内容

## 快速开始

### 在 Jellyfin 中使用

详细配置步骤请参考：[快速开始指南](/get-started)

### 推荐更新时间
建议将 Jellyfin 插件自动更新时间设置为 **凌晨 2:00 之后**，避免与镜像同步任务冲突。

## 开发者指南

### 添加新仓库

编辑 `original-manifest-list.json` 文件添加新的同步仓库：

```json
[
    {
        "name": "示例插件仓库",
        "repositoryUrl": "https://example.com/manifest.json"
    }
]
```

### 本地部署

```bash
# 克隆项目
git clone https://github.com/Eeymoo/sync-jellyfin-plugins.git
cd sync-jellyfin-plugins

# 安装依赖
npm install

# 运行同步脚本
npm run sync

# 启动开发服务器
npm run dev
```

## 监控和状态

访问 [状态页面](/status) 查看：
- 📈 实时同步状态和成功率
- 📋 详细的错误信息和历史记录
- 🔍 仓库健康度监控
- 📊 性能统计信息

## 支持的仓库

本项目同步的上游仓库包括：
- [Jellyfin 官方稳定版](https://jellyfin.org/docs/general/server/plugins/#official-jellyfin-plugin-repositories)
- [Jellyfin 官方开发版](https://jellyfin.org/docs/general/server/plugins/#official-jellyfin-plugin-repositories)
- 多个社区维护的第三方插件仓库

完整列表和实时状态请查看 [状态页面](/status)。

## 常见问题

### 无法添加仓库地址？
- 确保 Jellyfin 服务器可以访问互联网
- 检查防火墙设置是否阻止了外部连接
- 尝试重启 Jellyfin 服务

### 插件列表为空或不更新？
- 等待几分钟让 Jellyfin 刷新插件列表
- 在插件页面手动点击刷新按钮
- 检查状态页面确认仓库同步正常

### 插件下载速度慢？
- 推荐使用本项目提供的镜像地址
- 可以同时添加多个镜像源作为备用

## 贡献

欢迎提交 Pull Request 来改进本项目！

### 如何贡献
- 🐛 报告 Bug 或提出功能建议
- 🔧 提交代码修复或新功能
- 📝 完善文档和使用指南
- 🚀 推荐优质的插件仓库

详细贡献指南请参考：[参与贡献](/contribute)

## 许可证

本项目采用 [MIT 许可证](LICENSE)。