# ============================================================
# 本地复现 .github/workflows/test.yml 的测试流程
#
# 对齐 CI 的两个 job：
#   check : type-check + lint + unit test   (npm run check)
#   e2e   : build (VITE_API_BASE=/api) + Playwright (CI 模式)
#
# 用法（在仓库任意目录执行均可）：
#   ./scripts/test-ci.ps1            只跑 check + build —— 无需浏览器，最快，日常用
#   ./scripts/test-ci.ps1 -E2E       额外跑 Playwright e2e —— 首次会下载 chromium/firefox/webkit
#   ./scripts/test-ci.ps1 -Install   先 npm ci 干净安装依赖，最贴近 CI 全流程
# ============================================================

param(
  [switch]$E2E,      # 是否跑 e2e（需要浏览器）
  [switch]$Install   # 是否先 npm ci（干净安装，对齐 CI）
)

$ErrorActionPreference = 'Stop'

# 切到仓库根目录（本脚本位于 <root>/scripts/）
$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot

function Step($name) { Write-Host "`n=== $name ===" -ForegroundColor Cyan }
function Fail($name) { Write-Host "`n[X] $name 失败 (exit $LASTEXITCODE)" -ForegroundColor Red; exit 1 }

# ---- 可选：干净安装依赖（CI 第一步是 npm ci）----
if ($Install) {
  Step 'npm ci (干净安装依赖，对齐 CI)'
  npm ci
  if ($LASTEXITCODE -ne 0) { Fail 'npm ci' }
}

# ---- Job 1: check —— type-check + lint + unit test ----
Step 'check: type-check + lint + unit test'
npm run check
if ($LASTEXITCODE -ne 0) { Fail 'check' }

# ---- Job 2 (part 1): build —— test 环境变量 ----
Step 'build (VITE_API_BASE=/api)'
$env:VITE_API_BASE = '/api'
npm run build
if ($LASTEXITCODE -ne 0) { Fail 'build' }

# ---- Job 2 (part 2): e2e —— Playwright CI 模式（preview 4173, headless, retry）----
if ($E2E) {
  Step 'e2e: 确保浏览器已安装 (chromium/firefox/webkit)'
  npx playwright install
  if ($LASTEXITCODE -ne 0) { Fail 'playwright install' }

  Step 'e2e: npm run test:e2e (CI=true)'
  $env:CI = 'true'
  npm run test:e2e
  if ($LASTEXITCODE -ne 0) { Fail 'e2e' }
} else {
  Write-Host "`n(已跳过 e2e —— 加 -E2E 参数可本地跑 Playwright，首次会下载浏览器约数百 MB)" -ForegroundColor Yellow
}

Write-Host "`n[OK] 全部通过" -ForegroundColor Green
