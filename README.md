# MassVision

MassVision 是一个基于 Vue 3 + TypeScript + Vite + daisy ui构建的现代前端项目。项目集成了 Pinia 状态管理、Vue Router 路由、Tailwind CSS 样式库以及完整的测试工具链。

## 🛠 技术栈

- **核心框架**: [Vue 3](https://vuejs.org/)
- **构建工具**: [Vite](https://vitejs.dev/)
- **编程语言**: [TypeScript](https://www.typescriptlang.org/)
- **状态管理**: [Pinia](https://pinia.vuejs.org/)
- **路由管理**: [Vue Router](https://router.vuejs.org/)
- **UI 样式**: [Tailwind CSS](https://tailwindcss.com/) + [DaisyUI](https://daisyui.com/)
- **HTTP 请求**: [Axios](https://axios-http.com/)
- **工具库**: [Crypto-JS](https://github.com/brix/crypto-js) (用于加密)
- **测试**: [Vitest](https://vitest.dev/) (单元测试) + [Playwright](https://playwright.dev/) (E2E 测试)
- **代码规范**: ESLint + Prettier

## 📂 项目结构

```
MassVision/
├── public/              # 静态资源
├── src/
│   ├── assets/          # 资源文件 (CSS, 图片等)
│   ├── components/      # 公共组件 (AuthInput, Navbar, SvgIcon 等)
│   ├── router/          # 路由配置
│   ├── stores/          # Pinia 状态管理
│   ├── utils/           # 工具函数 (auth, http)
│   ├── views/           # 页面视图 (Login, Register, Dashboard)
│   ├── App.vue          # 根组件
│   └── main.ts          # 入口文件
├── docs/                # 项目文档
├── e2e/                 # E2E 测试文件
├── index.html           # 入口 HTML
├── package.json         # 项目依赖与脚本
├── vite.config.ts       # Vite 配置
└── ...
```

## 🚀 快速开始

### 环境要求

- Node.js ^20.19.0 或 >=22.12.0

### 安装依赖

```bash
npm install
```

### 开发模式运行

启动本地开发服务器：

```bash
npm run dev
```

### 构建生产版本

进行类型检查并构建生产环境代码：

```bash
npm run build
```

### 代码格式化与检查

```bash
# 运行 ESLint 检查并修复
npm run lint

# 运行 Prettier 格式化代码
npm run format
```

## 🧪 测试

### 单元测试

使用 Vitest 运行单元测试：

```bash
npm run test:unit
```

### 端到端 (E2E) 测试

使用 Playwright 运行 E2E 测试：

```bash
npm run test:e2e
```

## ✨ 功能特性

- **用户认证**: 包含登录 (Login) 和注册 (Register) 页面，以及相关的输入组件。
- **安全**: 使用 `crypto-js` 进行密码哈希处理。
- **网络请求**: 封装了 Axios 实例，支持 API 基础路径配置。
- **响应式布局**: 基于 Tailwind CSS 和 DaisyUI 构建的现代化 UI。
