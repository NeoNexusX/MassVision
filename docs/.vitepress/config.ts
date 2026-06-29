import { defineConfig } from 'vitepress'

// ============================================================
// VitePress 文档站配置（i18n）
//   - 与前端 SPA 共用同一仓库 / 同一 nginx
//   - 产物为纯静态文件，构建输出到项目根 dist-docs/，
//     由 docker/Dockerfile 拷贝到 nginx 的 /docs 路径下
//   - base 必须与 docker/nginx.conf.template 的 location /docs/ 对齐
//
//   层级：语言（最高） → 分类（dev / ...） → 文档
//     docs/en/dev/*.md  → 默认语言 English，URL 去掉 /en 前缀
//     docs/zh/dev/*.md  → 简体中文，URL 带 /zh 前缀
// ============================================================

const REPO = 'https://github.com/NeoNexusX/MassVision'
const YEAR = new Date().getFullYear()

const en = {
  nav: [
    { text: 'Guide', link: '/guide/getting-started' },
    { text: 'Development', link: '/dev/tech-stack' },
  ],
  sidebar: {
    '/guide/': [
      {
        text: 'Guide',
        items: [
          { text: 'Getting Started', link: '/guide/getting-started' },
          { text: 'Uploading Data', link: '/guide/upload-data' },
          { text: 'Viewing Data', link: '/guide/view-data' },
        ],
      },
    ],
    '/dev/': [
      {
        text: 'Development',
        items: [
          { text: 'Tech Stack', link: '/dev/tech-stack' },
          { text: 'Frontend Architecture', link: '/dev/frontend-architecture' },
          { text: 'Icon Guidelines', link: '/dev/icon-guidelines' },
          { text: 'Documentation Maintenance', link: '/dev/doc-maintenance' },
        ],
      },
    ],
  },
  // 「在 GitHub 上编辑此页」链接（:path 会替换成源文件相对路径）
  editLink: {
    pattern: `${REPO}/edit/main/docs/:path`,
    text: 'Edit this page on GitHub',
  },
  lastUpdated: { text: 'Last Updated' },
  footer: { copyright: `Copyright © ${YEAR} @Bionet Team` },
}

const zh = {
  nav: [
    { text: '指南', link: '/zh/guide/getting-started' },
    { text: '开发', link: '/zh/dev/技术栈' },
  ],
  sidebar: {
    '/zh/guide/': [
      {
        text: '指南',
        items: [
          { text: '快速开始', link: '/zh/guide/getting-started' },
          { text: '上传数据', link: '/zh/guide/upload-data' },
          { text: '查看数据', link: '/zh/guide/view-data' },
        ],
      },
    ],
    '/zh/dev/': [
      {
        text: '开发',
        items: [
          { text: '技术栈', link: '/zh/dev/技术栈' },
          { text: '前端架构边界', link: '/zh/dev/前端架构边界' },
          { text: '图标使用规范', link: '/zh/dev/图标使用规范' },
          { text: '文档维护', link: '/zh/dev/文档维护' },
        ],
      },
    ],
  },
  editLink: {
    pattern: `${REPO}/edit/main/docs/:path`,
    text: '在 GitHub 上编辑此页',
  },
  lastUpdated: { text: '最后更新于' },
  docFooter: { prev: '上一页', next: '下一页' },
  footer: { copyright: `版权所有 © ${YEAR} @Bionet Team` },
}

export default defineConfig({
  base: '/docs/',          // 部署在站点的 /docs/ 子路径下
  outDir: '../dist-docs',  // 输出到项目根 dist-docs（供 Dockerfile 拷贝）
  title: 'SpatialXomics',
  description: 'SpatialXomics 项目文档',
  // English 为默认语言：源文件放 en/，URL 去掉 /en 前缀（服务于 /docs/）
  rewrites: { 'en/:rest*': ':rest*' },
  // ignoreDeadLinks 保持默认 false：死链即构建失败，靠修链接保证文档质量
  lastUpdated: true,       // 启用「最后更新时间」（读取 git 提交时间）
  markdown: {
    math: true,            // 数学公式（需依赖 markdown-it-mathjax3）
    // 提示容器(::: tip/warning/danger/details)、代码导入(<<< @/path)、
    // emoji(:tada:)、目录([[toc]]) 均为 VitePress 默认开启，无需额外配置
  },
  // 站点级共享主题配置（各 locale 的 themeConfig 会在此基础上合并）
  themeConfig: {
    search: { provider: 'local' }, // 站内全文搜索：纯前端，无需后端服务
    socialLinks: [{ icon: 'github', link: REPO }],
  },
  locales: {
    root: { label: 'English', lang: 'en', themeConfig: en },
    zh: { label: '简体中文', lang: 'zh-CN', link: '/zh/', themeConfig: zh },
  },
})
