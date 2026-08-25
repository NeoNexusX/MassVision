# 查看数据

结果页支持两条入口：数据集卡片上的一键 **Explore / Visualize**，以及 Workspace 中自定义分析任务的 **View**。

## 创建或打开结果

### Explore / Direct conversion

1. 在 Public Datasets 或 My Datasets 找到目标卡片。
2. **Explore** 表示还没有默认可视化任务。点击后在 **Prepare Visualization** 对话框中选择 **Generate**。
3. 后端创建 `/processes/raw-convert` 任务。如果当前用户是任务所有者，页面跳转到 Workspace；如果已有其他用户创建的共享默认任务，卡片稍后会变为 **Visualize**。
4. **Visualize** 表示卡片已有 `defaultRunId`，点击会直接带着任务上下文打开结果页。

### Workspace 分析结果

分析任务完成后，在 Workspace 的结果表点击 **View**。`processing` 状态不提供 View；`failed` 结果可以查看错误并删除。

结果页路由是 `/workspace/results`，但任务 ID、数据集名称和方法通过浏览器 history state 传入。直接打开或刷新裸地址可能显示 **No result selected**，应从 Workspace 或数据集卡片重新进入。

## 页面布局

桌面端由四部分组成：

- 左侧可折叠 **Annotations** 面板。
- 中间上方 **Image View** 和下方 **Spectrum View**。
- 右侧信息、显示范围、统计、Visualization、聚类和 ROI 控件。
- 主可视化下方可折叠的 **Compare regions / Comparison results**。

小屏幕会把这些区域改为纵向排列。`public/config.json` 的 `resultFeatures.annotation` 和 `resultFeatures.compare` 可以分别关闭注释或区域比较，因此不同部署可能看不到对应面板。

## Continuous 与 Processed

| 模式 | 图像 | 谱图 | 可用高级功能 |
|---|---|---|---|
| Continuous | 指定 m/z 的离子强度图 | 平均谱，点击后切换 m/z | UMAP、KMeans；Centroid 时可做注释和区域比较 |
| Processed | TIC 图 | 点击像素后读取逐像素谱 | 可绘制 ROI；Centroid 时可用两个以上 ROI 做区域比较 |

数据模式由 Zarr 的 `row_axis` 与 `encoding` 自动判断，不需要用户切换。

## Image View

### 导航和像素信息

- 鼠标滚轮以指针位置为中心缩放；大于 1× 时按住左键拖动平移。
- 右下角的 `− / 倍率 / +` 控件可缩放，放大后出现重置按钮。
- 悬停显示 1-based 像素坐标和强度。
- Processed 模式点击像素后，工具栏显示像素坐标并在 Spectrum View 加载其谱。

### 工具栏

| 控件 | 行为 |
|---|---|
| m/z | Continuous 模式显示当前值 |
| Tolerance ± | Continuous 模式的 m/z 容差，范围钳位到 `0.001–1`，默认 `0.05` |
| Colormap | Viridis、Inferno、Magma、Hot、Gray |
| Intensity scale | Linear、Log；Continuous 且 Zarr 有 `stats/tic` 时还提供 TIC norm |
| Reset | 恢复容差 `0.05`、Inferno、Linear、Gamma `1.0` 和自动显示范围 |
| PNG | 导出当前图像和可见覆盖层，背景透明 |

TIC norm 使用预计算的 `stats/tic` 对每个像素归一化。读取失败时保留原图，并在控件提示错误。

### 显示范围和 Gamma

- 首次加载默认范围是 `0` 到非零强度的 P95，真实最大值仍显示在强度条顶部。
- 拖动图像右侧强度条的 Min/Max 手柄，或在右侧 **Display range** 直接输入数值。
- 强度条顶部的重置按钮恢复自动范围。
- **Gamma** 范围为 `0.5–1.5`，默认 `1.0`。
- **Statistic** 显示直方图、Dimensions、Non-zero 和 TIC；**Info** 显示采集/模式元数据；**Preprocessing** 列出本任务的方法。

## Spectrum View

Continuous 模式显示整个结果的平均谱：

- 点击谱图选择最接近的 m/z，并刷新 Image View。
- 当前 m/z 用选择线标识；注释表和区域比较表选择同一 m/z 时也会联动。
- Centroid 数据以柱状峰显示，Profile 数据以连续线显示。

Processed 模式在点击 TIC 图像像素前显示操作提示，点击后加载该像素的谱。谱图标题始终是 **Spectrum View**，底部统计会按模式显示 Peaks、Intensity、Selected/Tolerance 或 Pixel。失败时可点击 **Retry**。

## UMAP 与 KMeans

这组控件只在 Continuous 模式显示。

1. 打开 **Enable UMAP / KMeans**。首次启用会确认并调用 `POST /processes/{run_id}/clustering` 创建/取得后端 UMAP 任务。
2. 未完成时前端每 5 秒检查状态，也可以点击 **Refresh**；失败后停止自动轮询，由用户决定是否重试。
3. 完成后从当前 run 的 Zarr `analysis/umap` 读取 `coordinates` 和 `scaled_embedding`，在浏览器中栅格化为 UMAP 覆盖层。
4. 点击 **KMeans**，选择 `2–20` 的 k。KMeans 使用 `ml-kmeans` 在浏览器内对 UMAP embedding 计算，不读取后端 KMeans 数组。

UMAP 和 KMeans 覆盖层互斥，一次只显示一种。可调透明度、导出透明 PNG；KMeans 还可以勾选单个 cluster、All/Clear，以及用不同 k 重新计算。清除所有 cluster 时覆盖层隐藏，导出也只包含当前选中 cluster。

## ROI

右侧 **Region of interest** 支持：

- **Rect**：在图像上拖出矩形；完成后可移动或拖拽手柄调整。
- **Lasso**：按住并绘制自由形状；完成后可在内部拖动。

草稿完成后选择 **Confirm** 或 **Cancel**。确认后生成带独立颜色的 ROI，并显示 Pixels、Mean、Std、Min 和 Max；图像自动切换到 **ROI only**，多个 ROI 取并集。使用 **ROI only / Show all** 切换过滤视图，可逐个删除或 **Clear all**。

ROI 统计基于当前 m/z/当前 TIC 图，因此切换 m/z 后已显示的统计不会自动代表新 m/z；区域比较会直接使用 ROI 的像素掩码重新扫描谱数据。

## 区域比较

区域比较只对 **Centroid** 数据开放。候选区域来自：

- Continuous 结果中本地 KMeans 产生的 clusters。
- 当前结果中已确认的 ROIs。

至少需要两个区域。A、B 各自可以多选，组内成员先取并集，同一区域不能同时属于 A 和 B。

可调参数：

- **Min detection rate**：`1–50%`。
- **Intensity threshold**：按强度百分位设置，`0–20%`。

点击 **Compare** 后前端按 Zarr 分块流式扫描谱数据；可以取消。结果表包含 m/z、Mean A/B、A/B、Det A/B 和 Category，并可按 `A only`、`B only`、`A enriched`、`B enriched`、`Shared` 过滤。点击结果行会切换 Image View 的 m/z，并与注释表同步选择。

## 注释 CSV

注释匹配只在 **Continuous + Centroid** 且平均谱已加载时可用。

### 文件格式

- UTF-8 与 UTF-8 BOM 均可；自动识别逗号、分号、Tab 或 `|` 分隔符。
- 必须有可识别的 m/z 列，例如 `Exp. m/z`、`Tar. m/z`、`mz`、`m/z`、`experimental_mz`、`mass`。
- 名称可来自 `Candidate_1` 到任意 `Candidate_N`，也支持单列 `Candidate`。
- 可选列：`formula_ion` / `formula`、`Ion type` / `adduct`。

### 使用

点击 **Import CSV** 或把文件拖到面板。解析和匹配在 Web Worker 中执行，大表使用虚拟滚动。

- 容差支持 ppm 或 Da。
- 可按匹配状态筛选，按名称、分子式或 m/z 搜索并排序。
- 与结果极性相反或超出谱 m/z 范围的明确记录会在匹配前过滤，并显示数量。
- 点击匹配行会切换 Image View；悬停卡片显示 matched m/z、mass difference、平均强度和候选名。
- **PubChem** 查询候选化合物；下载按钮导出已匹配行，垃圾桶清空导入。

## 性能与错误提示

- Zarr 数据通过 OSS STS 凭证按块读取；凭证接近过期或收到 403 时会重新请求一次凭证。
- 切换 m/z 时保留上一张成功图，加载超过 250 ms 才显示遮罩，失败则保留旧图并提示。
- 区域比较使用独立 spectra LRU 缓存和可配置并发数；相关参数位于 `public/config.json` 的 `zarr` 块。
