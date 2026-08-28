#!/bin/sh
# ============================================================
# Docker 容器入口脚本
# 在 nginx 启动前，用环境变量替换 nginx.conf.template 中的
# ${BACKEND_HOST} / ${BACKEND_PORT}，生成最终配置。
#
# 用法：docker run -e BACKEND_HOST=... -e BACKEND_PORT=... image
# 默认值：host.docker.internal:8000
# ============================================================
set -e

BACKEND_HOST="${BACKEND_HOST:-host.docker.internal}"
BACKEND_PORT="${BACKEND_PORT:-8000}"

echo "[entrypoint] Backend: ${BACKEND_HOST}:${BACKEND_PORT}"

# Alpine 的 nginx 站点配置目录是 http.d/（官方 nginx 镜像是 conf.d/），见 Dockerfile 注释
CONF_DIR=/etc/nginx/http.d

envsubst '${BACKEND_HOST} ${BACKEND_PORT}' \
  < "${CONF_DIR}/default.conf.template" \
  > "${CONF_DIR}/default.conf"

# brotli_static 是 ngx_brotli 模块提供的指令，模块不在时它是「未知指令」，
# 会让 nginx 直接启动失败。这里先探测：缺模块就摘掉相关指令，降级为纯 gzip_static，
# 服务照常可用。这样即便日后换回官方 nginx:alpine 基础镜像，容器也不会起不来。
if [ ! -f /etc/nginx/modules/10_http_brotli.conf ]; then
  echo "[entrypoint] ngx_brotli module not found — disabling brotli_static (falling back to gzip_static)"
  sed -i '/brotli_static/d' "${CONF_DIR}/default.conf"
else
  echo "[entrypoint] ngx_brotli module present — brotli_static enabled"
fi

# 配置有问题就立刻失败并打印原因，而不是留下一个起不来的容器
nginx -t

exec nginx -g 'daemon off;'
