# Jellyfin 插件镜像同步

## 项目简介

为中国大陆地区的 Jellyfin 用户提供的插件镜像同步服务。本项目自动同步多个主流 Jellyfin 插件仓库，解决国内用户访问官方插件仓库速度慢或无法访问的问题。

## 特性

- 🔄 **自动同步**：每日 24:00 自动同步所有上游插件仓库
- 📦 **版本管理**：保留每个插件的最新 3 个版本，确保稳定性
- 🚀 **快速访问**：国内 CDN 加速，下载速度显著提升
- 📊 **状态监控**：实时监控同步状态和成功率
- 🛡️ **可靠性**：多仓库支持，降低单点故障风险

## 快速开始

### 在 Jellyfin 中添加插件仓库

1. 登录 Jellyfin 管理员界面
2. 导航至 **控制台** → **插件** → **存储库**
3. 点击 **添加** 按钮
4. 输入仓库地址（从下方获取）
5. 点击 **确定** 保存

### 获取镜像地址

访问状态页面获取最新的镜像地址：

**🔗 [查看仓库状态和复制镜像链接](https://jellyfin-cn.eeymoo.com/status.html)**

状态页面提供：
- 📈 实时同步状态和成功率
- 📋 一键复制镜像链接
- 🔍 详细的错误信息和历史记录
- 📊 仓库健康度监控

## 开发者指南

### 添加新的同步仓库

如需添加新的插件仓库到同步列表，请编辑 `original-manifest-list.json` 文件：

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
```

## 支持的仓库

本项目同步的上游仓库包括：
- [Jellyfin 官方稳定版](https://jellyfin.org/docs/general/server/plugins/#official-jellyfin-plugin-repositories)
- [Jellyfin 官方开发版](https://jellyfin.org/docs/general/server/plugins/#official-jellyfin-plugin-repositories)
- 多个社区维护的第三方插件仓库

完整列表和实时状态请查看[状态页面](https://jellyfin-cn.eeymoo.com/status.html)。

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

### 提交 Issue
如果你遇到任何问题或有建议，请在 [Issues 页面](https://github.com/Eeymoo/sync-jellyfin-plugins/issues) 反馈。

## 许可证

本项目采用 [MIT 许可证](LICENSE)。