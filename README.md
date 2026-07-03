# SpatialXomics

[English](README.en.md) | 简体中文

SpatialXomics 是一个基于 Vue 3 + TypeScript + Vite 构建的质谱成像（MSI）数据管理与分析平台，支持 imzML 数据集上传、浏览、可视化分析以及用户权限管理。

## 技术栈

- **核心框架**: [Vue 3](https://vuejs.org/) + [TypeScript](https://www.typescriptlang.org/)
- **构建工具**: [Vite](https://vitejs.dev/) + [Tailwind CSS v4](https://tailwindcss.com/)
- **状态管理**: [Pinia](https://pinia.vuejs.org/)
- **路由管理**: [Vue Router](https://router.vuejs.org/)
- **UI 组件**: [DaisyUI v5](https://daisyui.com/) + [Heroicons](https://heroicons.com/) + [Iconify](https://iconify.design/)
- **图表可视化**: [ECharts](https://echarts.apache.org/) + [vue3-calendar-heatmap](https://github.com/IhsenBouallegue/vue3-calendar-heatmap)（GitHub 提交热力图）
- **MSI 数据解析**: [zarrita](https://github.com/manzt/zarrita)（Zarr 格式读取）、@zip.js/zip.js（上传打包压缩）、zstddec（zstd 解压）、hash-wasm（WebAssembly 哈希）
- **对象存储**: [ali-oss](https://github.com/ali-sdk/ali-oss)（阿里云 OSS）
- **HTTP 请求**: [Axios](https://axios-http.com/) + [qs](https://github.com/ljharb/qs)
- **加密**: [Crypto-JS](https://github.com/brix/crypto-js)
- **地区数据**: [i18n-iso-countries](https://github.com/michaelwittig/node-i18n-iso-countries)（国家/地区列表）
- **测试**: [Vitest](https://vitest.dev/)（单元测试） + [Playwright](https://playwright.dev/)（E2E 测试）
- **代码规范**: ESLint + Prettier

## 项目结构

```
SpatialXomics/
├── public/                          # 静态资源 (config.json 运行时配置)
├── src/
│   ├── app/components/              # 应用级组件 (Navbar, NavDrawer)
│   ├── assets/                      # CSS 资源 (Tailwind/DaisyUI 主题)
│   ├── features/                    # 业务功能模块 (Feature-based 架构)
│   │   ├── assistant/               # 浮动 AI 助手
│   │   ├── auth/                    # 用户认证 (登录/注册/store/API)
│   │   ├── datasets/                # 数据集浏览与管理 (列表/详情/过滤/下载)
│   │   ├── home/                    # 首页 (Hero/Features/统计/提交热力图)
│   │   ├── upload/                  # imzML 上传 (文件选择/压缩/断点续传/OSS)
│   │   ├── users/                   # 用户管理 (管理员面板/用户列表/角色)
│   │   └── workspace/               # 工作区与分析
│   │       ├── analysis/            # 分析构建器 (数据源/预处理管线)
│   │       ├── dashboard/           # 工作区仪表盘 (任务/结果/活动)
│   │       └── results/             # 结果可视化 (离子图/光谱/ROI/UMAP)
│   ├── router/                      # Vue Router 路由配置 (含路由守卫)
│   ├── services/                    # 跨功能服务 (OSS 客户端、Zarr 远程访问)
│   ├── shared/                      # 共享模块
│   │   ├── api/                     # HTTP 客户端 (Axios 封装)
│   │   ├── components/              # 通用组件 (IconInput, PaginationBar, Toast, etc.)
│   │   ├── composables/             # 通用 composables
│   │   ├── config/                  # 应用配置
│   │   ├── constants/                # 常量
│   │   ├── directives/              # 自定义指令 (滚动显现等)
│   │   ├── types/                   # 类型声明
│   │   └── utils/                   # 工具函数
│   ├── views/                       # 页面视图
│   │   └── workspace/               # 工作区页面 (WorkspacePage, NewAnalysis, ResultDetail, TaskDetail)
│   ├── workers/                     # Web Workers (ZIP 压缩)
│   ├── App.vue                      # 根组件
│   ├── main.ts                      # 入口文件
│   └── style.css                    # 全局样式
├── env/                              # 多环境 .env 文件目录
├── docker/                           # Docker 部署配置 (Dockerfile/nginx/entrypoint)
├── docs/                             # 项目文档
├── e2e/                              # E2E 测试文件
├── index.html                       # 入口 HTML
├── package.json                     # 项目依赖与脚本
├── vite.config.ts                   # Vite 配置 (含 API 代理)
├── vitest.config.ts                 # Vitest 配置
└── playwright.config.ts             # Playwright 配置
```

## 快速开始

### 环境要求

- Node.js ^20.19.0 或 >=22.12.0

### 安装依赖

```bash
npm install
```

### 配置环境变量

在 `env/` 目录下创建对应模式的 `.env` 文件（如 `.env.development`），配置后端地址：

```bash
VITE_BACKEND_URL=http://localhost:8000
```

### 开发模式运行

```bash
npm run dev
```

开发服务器默认运行在 `http://localhost:5173`，`/api` 请求会自动代理至 `VITE_BACKEND_URL` 指向的后端。

### 构建生产版本

```bash
npm run build
```

## 测试

```bash
# 运行单元测试
npm run test:unit

# 运行 E2E 测试
npm run test:e2e
```

## 代码检查与格式化

```bash
# ESLint 检查并修复
npm run lint

# Prettier 格式化
npm run format
```

## 文档站

项目内置基于 [VitePress](https://vitepress.dev/) 的中英文文档站，源文件位于 `docs/`，与本仓库共用同一套部署流程：

```bash
npm run docs:dev      # 单独启动文档站，默认 http://localhost:5174/docs/
npm run docs:build    # 构建到根目录 dist-docs/
```

详见 [docs/zh/dev/文档维护.md](docs/zh/dev/文档维护.md)。

## 部署

项目内置 Docker 部署配置（`docker/Dockerfile`、`nginx.conf.template`、`entrypoint.sh`），并通过 GitHub Actions（`.github/workflows/`）实现测试与开发/生产环境的自动化部署。

## 功能特性

- **用户认证**: JWT 登录/注册，个人资料管理，路由守卫与权限控制
- **数据集管理**: 公开数据集浏览、个人数据集管理、数据集详情查看与下载
- **imzML 上传**: 支持 imzML 文件解析、前端压缩、断点续传、阿里云 OSS 分片上传
- **分析工作区**: 创建分析任务，配置数据源与预处理管线，查看任务执行状态
- **结果可视化**: 离子图像渲染、质谱图展示、ROI 区域分析、UMAP/k-means 聚类叠加
- **用户管理**: 管理员面板，用户列表、角色管理与状态统计
- **AI 助手**: 可拖拽悬浮窗，提供智能问答辅助
- **主题切换**: 支持亮色/暗色主题，跟随系统偏好
- **响应式布局**: 基于 Tailwind CSS + DaisyUI 的现代化 UI，适配移动端与桌面端
