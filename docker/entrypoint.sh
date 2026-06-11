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

envsubst '${BACKEND_HOST} ${BACKEND_PORT}' \
  < /etc/nginx/conf.d/default.conf.template \
  > /etc/nginx/conf.d/default.conf

exec nginx -g 'daemon off;'
