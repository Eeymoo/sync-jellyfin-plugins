export default {
  lang: "zh-CN",
  title: "Jellyfin 插件镜像站",
  description: "加速国内 Jellyfin 插件的下载和更新",
  icon: "/assets/icon.png",

  head: [
    // 网站图标
    ["link", { rel: "icon", href: "/assets/icon.png" }],
    ["link", { rel: "apple-touch-icon", href: "/assets/icon.png" }],
    [
      "meta",
      {
        name: "keywords",
        content: "Jellyfin, 插件, 镜像, 下载, 国内加速, 开源, 媒体服务器",
      },
    ],
    ["meta", { name: "author", content: "Eeymoo" }],
    ["meta", { property: "og:title", content: "Jellyfin 插件镜像站" }],
    ["meta", { property: "og:image", content: "/assets/icon.png" }],
    [
      "meta",
      {
        property: "og:description",
        content: "加速国内 Jellyfin 插件的下载和更新",
      },
    ],
    ["meta", { property: "og:type", content: "website" }],
    [
      "meta",
      {
        property: "og:url",
        content: "https://eeymoo.github.io/sync-jellyfin-plugins/",
      },
    ],
    ["meta", { property: "og:locale", content: "zh_CN" }],
  ],

  themeConfig: {
    logo: "/assets/icon.png",
    sidebar: [
      {
        text: "我们做了什么 ?",
        link: "/readme",
      },
      {
        text: "开始使用",
        link: "/get-started",
      },
      {
        text: "仓库状态监控",
        link: "/status",
      },
      {
        text: "贡献代码",
        link: "/contribute",
      },
      {
        text: "相关链接",
        link: "/links",
      },
      {
        items: [
          {
            text: "Github",
            link: "https://github.com/Eeymoo/sync-jellyfin-plugins",
            target: "_blank",
          },
          {
            text: "🏠 Jellyfin 官网",
            link: "https://jellyfin.org/",
            target: "_blank",
          },
          {
            text: "📚 VitePress 官网",
            link: "https://vitepress.dev/",
            target: "_blank",
          },
          {
            text: "🧩 Jellyfin 插件仓库",
            link: "https://github.com/jellyfin/jellyfin-plugin-repository",
            target: "_blank",
          },
        ],
      },
    ],
    footer: {
      message: "Released under the MIT License.",
      copyright: `Copyright © 2020-${new Date().getFullYear()} Jellyfin 插件中文镜像站`,
    },
  },
};
