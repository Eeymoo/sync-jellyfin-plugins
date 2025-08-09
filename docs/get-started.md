## 镜像列表

<RepoItem
  name="Jellyfin"
  originalUrl="https://repo.jellyfin.org/files/plugin/manifest.json"
  repositoryUrl="https://repo.jellyfin.org/files/plugin/manifest.json"
  timestamp="2025-08-09T16:14:13.323Z"
  status="error"
  :successRate="29"
/>
<RepoItem
  name="Jellyfin Unstable"
  originalUrl="https://repo.jellyfin.org/files/plugin-unstable/manifest.json"
  repositoryUrl="https://jellyfin-mirror.oss-cn-wuhan-lr.aliyuncs.com/plugins/Jellyfin_Unstable/manifest.json"
  timestamp="2025-08-09T16:14:13.343Z"
  status="success"
  :successRate="71"
/>
<RepoItem
  name="Ani-Sync Repo"
  originalUrl="https://raw.githubusercontent.com/vosmiic/jellyfin-ani-sync/master/manifest.json"
  repositoryUrl="https://jellyfin-mirror.oss-cn-wuhan-lr.aliyuncs.com/plugins/AniSync_Repo/manifest.json"
  timestamp="2025-08-09T16:14:13.345Z"
  status="success"
  :successRate="100"
/>
<RepoItem
  name="dkanada's Repo"
  originalUrl="https://raw.githubusercontent.com/dkanada/jellyfin-plugin-intros/master/manifest.json"
  repositoryUrl="https://jellyfin-mirror.oss-cn-wuhan-lr.aliyuncs.com/plugins/dkanadas_Repo/manifest.json"
  timestamp="2025-08-09T16:14:13.347Z"
  status="success"
  :successRate="100"
/>
<RepoItem
  name="ShokoAnime's Repo"
  originalUrl="https://raw.githubusercontent.com/ShokoAnime/Shokofin/metadata/stable/manifest.json"
  repositoryUrl="https://jellyfin-mirror.oss-cn-wuhan-lr.aliyuncs.com/plugins/ShokoAnimes_Repo/manifest.json"
  timestamp="2025-08-09T16:14:13.350Z"
  status="success"
  :successRate="100"
/>
<RepoItem
  name="TubeArchivist's Repo"
  originalUrl="https://raw.githubusercontent.com/tubearchivist/tubearchivist-jf-plugin/master/manifest.json"
  repositoryUrl="https://jellyfin-mirror.oss-cn-wuhan-lr.aliyuncs.com/plugins/TubeArchivists_Repo/manifest.json"
  timestamp="2025-08-09T16:14:13.351Z"
  status="success"
  :successRate="100"
/>
<RepoItem
  name="IntroSkipper's Repo"
  originalUrl="https://manifest.intro-skipper.org/manifest.json"
  repositoryUrl="https://manifest.intro-skipper.org/manifest.json"
  timestamp="2025-08-09T16:14:13.351Z"
  status="error"
  :successRate="0"
/>
<RepoItem
  name="9p4's Single-Sign-On (SSO) Repo"
  originalUrl="https://raw.githubusercontent.com/9p4/jellyfin-plugin-sso/manifest-release/manifest.json"
  repositoryUrl="https://jellyfin-mirror.oss-cn-wuhan-lr.aliyuncs.com/plugins/9p4s_SingleSignOn_SSO_Repo/manifest.json"
  timestamp="2025-08-09T16:14:13.344Z"
  status="success"
  :successRate="100"
/>
<RepoItem
  name="danieladov's Repo"
  originalUrl="https://raw.githubusercontent.com/danieladov/JellyfinPluginManifest/master/manifest.json"
  repositoryUrl="https://jellyfin-mirror.oss-cn-wuhan-lr.aliyuncs.com/plugins/danieladovs_Repo/manifest.json"
  timestamp="2025-08-09T16:14:13.346Z"
  status="success"
  :successRate="100"
/>
<RepoItem
  name="k-matti's Repo"
  originalUrl="https://raw.githubusercontent.com/k-matti/jellyfin-plugin-repository/master/manifest.json"
  repositoryUrl="https://jellyfin-mirror.oss-cn-wuhan-lr.aliyuncs.com/plugins/kmattis_Repo/manifest.json"
  timestamp="2025-08-09T16:14:13.347Z"
  status="success"
  :successRate="100"
/>
<RepoItem
  name="LinFor's Repo"
  originalUrl="https://raw.githubusercontent.com/LinFor/jellyfin-plugin-kinopoisk/master/dist/manifest.json"
  repositoryUrl="https://jellyfin-mirror.oss-cn-wuhan-lr.aliyuncs.com/plugins/LinFors_Repo/manifest.json"
  timestamp="2025-08-09T16:14:13.348Z"
  status="success"
  :successRate="100"
/>
<RepoItem
  name="LizardByte's Repo"
  originalUrl="https://app.lizardbyte.dev/jellyfin-plugin-repo/manifest.json"
  repositoryUrl="https://jellyfin-mirror.oss-cn-wuhan-lr.aliyuncs.com/plugins/LizardBytes_Repo/manifest.json"
  timestamp="2025-08-09T16:14:13.349Z"
  status="success"
  :successRate="100"
/>
<RepoItem
  name="Metashark' Repo"
  originalUrl="https://github.com/cxfksword/jellyfin-plugin-metashark/releases/download/manifest/manifest_cn.json"
  repositoryUrl="https://jellyfin-mirror.oss-cn-wuhan-lr.aliyuncs.com/plugins/Metashark_Repo/manifest.json"
  timestamp="2025-08-09T16:14:13.352Z"
  status="success"
  :successRate="100"
/>
<RepoItem
  name="AudioMuse-AI's Repo"
  originalUrl="https://raw.githubusercontent.com/neptunehub/audiomuse-ai-plugin/master/manifest.json"
  repositoryUrl="https://jellyfin-mirror.oss-cn-wuhan-lr.aliyuncs.com/plugins/AudioMuseAIs_Repo/manifest.json"
  timestamp="2025-08-09T16:14:13.352Z"
  status="success"
  :successRate="100"
/>

<script setup>
import RepoItem from './.vitepress/components/RepoItem.vue'
</script>

## 使用方法

### 步骤一：打开 Jellyfin 插件管理

1. 登录 Jellyfin 管理后台。
2. 左侧导航栏选择 **插件**。
3. 点选页面右上角的 **存储库** 或 **Repositories**。

### 步骤二：添加镜像源

在"插件存储库"页面，点击"添加"按钮。  
在弹出的对话框中填写仓库地址。

### 步骤三：保存并刷新

点击"确定"或"保存"，存储库将会添加到列表中。  
稍等片刻，插件列表会自动刷新为最新的镜像源内容。

### 常见问题

- **无法访问镜像源？**  
  请确认你的 Jellyfin 服务器可以连接互联网，或稍后重试。
- **插件列表未刷新？**  
  可尝试重启 Jellyfin 服务或手动刷新页面。
