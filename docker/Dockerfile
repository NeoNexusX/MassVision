# ============================================================
# MassVision (SpatialXomics) — Docker 多阶段构建
# ============================================================

# ---- Stage 1: Build ----
FROM node:22-alpine AS builder
WORKDIR /app

# VitePress 的 lastUpdated 功能要在构建时对每个文档文件执行 `git log` 读最后提交时间，
# node:22-alpine 默认不带 git，装上（.git 目录由 .dockerignore 放行进入构建上下文）
RUN apk add --no-cache git

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
# 基础镜像从官方 nginx:alpine 换成 alpine + apk 装 nginx，原因是 brotli：
# nginx.conf.template 里的 brotli_static 需要 ngx_brotli 动态模块，而官方 nginx:alpine
# 的 nginx 来自 nginx.org 的 apk 源，其模块集只有 xslt/geoip/image-filter/njs/acme，不含 brotli；
# Alpine 社区源的 nginx-mod-http-brotli 又只匹配 Alpine 自己编译的 nginx，两者对不上。
# 从同一套 Alpine 源里装 nginx + 模块，是让 brotli_static 真正可用的组合。
# 注意 Alpine 的 nginx 站点配置目录是 /etc/nginx/http.d/（不是 conf.d/）。
FROM alpine:3.21

# nginx 本体 + brotli 动态模块（该包自带 /etc/nginx/modules/10_http_brotli.conf，
#   由 Alpine 默认 nginx.conf 的 include /etc/nginx/modules/*.conf 自动加载，无需手写 load_module）
# gettext 提供 envsubst，用于容器启动时替换配置模板里的变量
# 顺手删掉 Alpine 自带的默认站点，避免与我们的 server 块争抢 80 端口
RUN apk add --no-cache nginx nginx-mod-http-brotli gettext \
    && rm -f /etc/nginx/http.d/default.conf

# 复制构建产物（含 precompressAssets 插件生成的 .gz / .br，供 gzip_static / brotli_static 直接返回）
COPY --from=builder /app/dist /usr/share/nginx/html

# 复制文档站产物 → /docs 子路径（与 nginx.conf.template 的 base /docs/ 对齐）
COPY --from=builder /app/dist-docs /usr/share/nginx/html/docs

# 复制 nginx 配置模板（不是最终配置，占位符由 entrypoint.sh 在容器启动时替换）
COPY docker/nginx.conf.template /etc/nginx/http.d/default.conf.template

# 入口脚本：替换模板中的 ${BACKEND_HOST}/${BACKEND_PORT} 为实际值，然后启动 nginx
COPY docker/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# nginx 默认暴露 80 端口
EXPOSE 80

ENTRYPOINT ["/entrypoint.sh"]
