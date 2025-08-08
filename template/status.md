# 仓库状态监控

这个页面展示了所有 Jellyfin 插件仓库的实时状态，包括成功率、标签分类和历史记录。

## 仓库列表

###########
Repo List
###########

<script setup>
import RepositoryItem from './.vitepress/components/RepositoryItem.vue'
</script>

## 功能说明

### 状态指示器
- ✅ **成功**: 仓库可正常访问并同步
- ❌ **失败**: 仓库访问或同步过程中出现问题

### 标签系统
- **official**: Jellyfin 官方维护的仓库
- **official-community**: 官方认可的社区仓库
- **third-party**: 第三方开发者维护
- **stable**: 稳定版本
- **beta/unstable**: 测试版本

### 历史记录
每个仓库都会记录最近 60 次的同步状态，通过颜色块展示：
- 🟢 绿色: 同步成功
- 🔴 红色: 同步失败

将鼠标悬停在颜色块上可以查看具体的时间戳和错误信息。

### 使用方法
1. 点击仓库名称可以跳转到原始仓库地址
2. 点击"复制"按钮可以复制镜像地址到剪贴板
3. 成功率统计帮助你了解仓库的稳定性
