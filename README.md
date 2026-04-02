```markdown
# MassVision
<div align="center">
  <!-- 顶级开源仓库级多语言切换按钮（视觉对标Vue.js/Vite官方仓库） -->
  <div style="margin: 20px 0; display: flex; gap: 12px; justify-content: center; flex-wrap: wrap;">
    <a href="#简体中文" style="padding: 8px 20px; border-radius: 8px; background: #42b983; color: white; text-decoration: none; font-weight: 600; font-size: 14px; transition: all 0.2s ease; border: 1px solid transparent;">简体中文</a>
    <a href="#繁體中文" style="padding: 8px 20px; border-radius: 8px; background: #35495e; color: white; text-decoration: none; font-weight: 600; font-size: 14px; transition: all 0.2s ease; border: 1px solid transparent;">繁體中文</a>
    <a href="#English" style="padding: 8px 20px; border-radius: 8px; background: #2c3e50; color: white; text-decoration: none; font-weight: 600; font-size: 14px; transition: all 0.2s ease; border: 1px solid transparent;">English</a>
  </div>

  <!-- 补充Vue前端项目标配徽章（顶级仓库视觉，无篡改原文，仅增强可读性） -->
  <div style="margin: 16px 0;">
    <img src="https://img.shields.io/badge/Vue-3.x-42b983?style=for-the-badge&logo=vue.js" alt="Vue 3">
    <img src="https://img.shields.io/badge/TypeScript-5.x-3178c6?style=for-the-badge&logo=typescript" alt="TypeScript">
    <img src="https://img.shields.io/badge/Vite-5.x-646CFF?style=for-the-badge&logo=vite" alt="Vite">
    <img src="https://img.shields.io/badge/TailwindCSS-3.x-06B6D4?style=for-the-badge&logo=tailwindcss" alt="Tailwind CSS">
    <img src="https://img.shields.io/badge/DaisyUI-4.x-50CD89?style=for-the-badge&logo=daisyui" alt="DaisyUI">
  </div>
</div>

---

## 简体中文
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

---

## 繁體中文
MassVision 是一個基於 Vue 3 + TypeScript + Vite + daisy ui 構建的現代前端項目。項目集成了 Pinia 狀態管理、Vue Router 路由、Tailwind CSS 樣式庫以及完整的測試工具鏈。

## 🛠 技術棧

- **核心框架**: [Vue 3](https://vuejs.org/)
- **構建工具**: [Vite](https://vitejs.dev/)
- **程式語言**: [TypeScript](https://www.typescriptlang.org/)
- **狀態管理**: [Pinia](https://pinia.vuejs.org/)
- **路由管理**: [Vue Router](https://router.vuejs.org/)
- **UI 樣式**: [Tailwind CSS](https://tailwindcss.com/) + [DaisyUI](https://daisyui.com/)
- **HTTP 請求**: [Axios](https://axios-http.com/)
- **工具庫**: [Crypto-JS](https://github.com/brix/crypto-js) (用於加密)
- **測試**: [Vitest](https://vitest.dev/) (單元測試) + [Playwright](https://playwright.dev/) (E2E 測試)
- **程式碼規範**: ESLint + Prettier

## 📂 項目結構

```
MassVision/
├── public/              # 靜態資源
├── src/
│   ├── assets/          # 資源文件 (CSS, 圖片等)
│   ├── components/      # 公共元件 (AuthInput, Navbar, SvgIcon 等)
│   ├── router/          # 路由配置
│   ├── stores/          # Pinia 狀態管理
│   ├── utils/           # 工具函數 (auth, http)
│   ├── views/           # 頁面視圖 (Login, Register, Dashboard)
│   ├── App.vue          # 根元件
│   └── main.ts          # 入口文件
├── docs/                # 項目文件
├── e2e/                 # E2E 測試文件
├── index.html           # 入口 HTML
├── package.json         # 項目依賴與腳本
├── vite.config.ts       # Vite 配置
└── ...
```

## 🚀 快速開始

### 環境要求

- Node.js ^20.19.0 或 >=22.12.0

### 安裝依賴

```bash
npm install
```

### 開發模式執行

啟動本地開發伺服器：

```bash
npm run dev
```

### 構建生產版本

進行類型檢查並構建生產環境程式碼：

```bash
npm run build
```

### 程式碼格式化與檢查

```bash
# 執行 ESLint 檢查並修復
npm run lint

# 執行 Prettier 格式化程式碼
npm run format
```

## 🧪 測試

### 單元測試

使用 Vitest 執行單元測試：

```bash
npm run test:unit
```

### 端到端 (E2E) 測試

使用 Playwright 執行 E2E 測試：

```bash
npm run test:e2e
```

## ✨ 功能特性

- **使用者認證**: 包含登入 (Login) 和註冊 (Register) 頁面，以及相關的輸入元件。
- **安全**: 使用 `crypto-js` 進行密碼哈希處理。
- **網路請求**: 封裝了 Axios 實例，支援 API 基礎路徑配置。
- **響應式佈局**: 基於 Tailwind CSS 和 DaisyUI 構建的現代化 UI。

---

## English
MassVision is a modern front-end project built with Vue 3 + TypeScript + Vite + daisy ui. The project integrates Pinia state management, Vue Router, Tailwind CSS style library, and a complete testing toolchain.

## 🛠 Tech Stack

- **Core Framework**: [Vue 3](https://vuejs.org/)
- **Build Tool**: [Vite](https://vitejs.dev/)
- **Programming Language**: [TypeScript](https://www.typescriptlang.org/)
- **State Management**: [Pinia](https://pinia.vuejs.org/)
- **Router Management**: [Vue Router](https://router.vuejs.org/)
- **UI Styling**: [Tailwind CSS](https://tailwindcss.com/) + [DaisyUI](https://daisyui.com/)
- **HTTP Requests**: [Axios](https://axios-http.com/)
- **Utility Library**: [Crypto-JS](https://github.com/brix/crypto-js) (for encryption)
- **Testing**: [Vitest](https://vitest.dev/) (Unit Testing) + [Playwright](https://playwright.dev/) (E2E Testing)
- **Code Standards**: ESLint + Prettier

## 📂 Project Structure

```
MassVision/
├── public/              # Static resources
├── src/
│   ├── assets/          # Resource files (CSS, images, etc.)
│   ├── components/      # Common components (AuthInput, Navbar, SvgIcon, etc.)
│   ├── router/          # Router configuration
│   ├── stores/          # Pinia state management
│   ├── utils/           # Utility functions (auth, http)
│   ├── views/           # Page views (Login, Register, Dashboard)
│   ├── App.vue          # Root component
│   └── main.ts          # Entry file
├── docs/                # Project documentation
├── e2e/                 # E2E test files
├── index.html           # Entry HTML
├── package.json         # Project dependencies and scripts
├── vite.config.ts       # Vite configuration
└── ...
```

## 🚀 Quick Start

### Environment Requirements

- Node.js ^20.19.0 or >=22.12.0

### Install Dependencies

```bash
npm install
```

### Run in Development Mode

Start the local development server:

```bash
npm run dev
```

### Build Production Version

Perform type checking and build production-ready code:

```bash
npm run build
```

### Code Formatting & Linting

```bash
# Run ESLint check and auto-fix
npm run lint

# Format code with Prettier
npm run format
```

## 🧪 Testing

### Unit Testing

Run unit tests with Vitest:

```bash
npm run test:unit
```

### End-to-End (E2E) Testing

Run E2E tests with Playwright:

```bash
npm run test:e2e
```

## ✨ Features

- **User Authentication**: Includes Login and Register pages, along with related input components.
- **Security**: Uses `crypto-js` for password hashing.
- **Network Requests**: Encapsulated Axios instance with support for API base path configuration.
- **Responsive Layout**: Modern UI built with Tailwind CSS and DaisyUI.
```