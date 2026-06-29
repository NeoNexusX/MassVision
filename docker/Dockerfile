# ============================================================
# MassVision (SpatialXomics) — Docker 多阶段构建
# ============================================================

# ---- Stage 1: Build ----
FROM node:22-alpine AS builder
WORKDIR /app

# 利用 Docker 层缓存：先复制依赖描述文件
COPY package.json package-lock.json* ./

# 安装依赖（npm ci 比 npm install 更快更确定）
RUN npm ci

# 复制全部源码 + 配置文件
COPY . .

# 生产构建（读取 .env.production 中的 VITE_ 变量）
RUN npm run build

# 构建 VitePress 文档站 → /app/dist-docs（纯静态，无运行时依赖）
RUN npm run docs:build

# ---- Stage 2: Serve ----
FROM nginx:alpine

# 安装 envsubst（来自 gettext），用于容器启动时将模板中的环境变量替换为实际值
RUN apk add --no-cache gettext

# 复制构建产物
COPY --from=builder /app/dist /usr/share/nginx/html

# 复制文档站产物 → /docs 子路径（与 nginx.conf.template 的 base /docs/ 对齐）
COPY --from=builder /app/dist-docs /usr/share/nginx/html/docs

# 复制 nginx 配置模板（不是最终配置，占位符由 entrypoint.sh 在容器启动时替换）
COPY docker/nginx.conf.template /etc/nginx/conf.d/default.conf.template

# 入口脚本：替换模板中的 ${BACKEND_HOST}/${BACKEND_PORT} 为实际值，然后启动 nginx
COPY docker/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# nginx 默认暴露 80 端口
EXPOSE 80

ENTRYPOINT ["/entrypoint.sh"]
