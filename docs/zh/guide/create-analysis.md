# 创建分析

登录后进入 **Workspace → New Analysis**。页面左侧选择数据和预处理方法，右侧显示当前摘要并提交任务。

## 选择数据源

数据源分为两个选项卡：

- **My Datasets**：当前账号上传的数据。
- **Public Datasets**：平台公开数据。

搜索框按后端 `filename` 字段筛选，切换选项卡时会保留搜索词并重新请求对应列表。每行显示数据集名称、文件名/提交时间和大小；点击行或单选框选中。

页面右上角的 **Upload New Dataset** 会跳转到 My Datasets 并自动打开上传弹窗。

选中数据后，前端从元数据读取 Spectrum Mode、Storage Mode、Polarity、Ionisation Source、Analyzer 和 Pixel Size。Polarity 是提交的必填条件；其他信息主要用于摘要。

## 方法兼容性

页面只展示与数据模式兼容的方法组：

| Spectrum + Storage | 可用方法组 |
|---|---|
| Profile + Continuous | Noise Reduction、Baseline Correction、Normalization、Peak Picking；选中 Peak Picking 后显示 Peak Alignment |
| Profile + Processed | 与 Profile + Continuous 相同 |
| Centroid + Continuous | Normalization |
| Centroid + Processed | Normalization、Peak Alignment |

Centroid + Continuous 已共享一条 m/z 轴，因此不提供 Peak Alignment。Profile 数据必须先经过 Peak Picking，才有可供对齐的峰。

## 方法与参数

每个方法组内部单选，但整个方法组是可选的；再次点击已选方法可以取消。

### Noise Reduction

| 方法 | 参数与默认值 |
|---|---|
| Savitzky–Golay | Window `5`、Polyorder `3`、Derivative `0`、Delta `1.0` |
| Gaussian | Window `5`、Sigma `2.0` |
| Moving Average | Window `5` |

### Baseline Correction

- **SNIP**（`snip_numba`）
- **Local Minimum**（`locmin_numba`）

两者没有前端可调参数。

### Normalization

| 方法 | 参数与默认值 |
|---|---|
| TIC | Scale `1.0` |
| RMS | Scale `1.0` |
| REF | Scale `1.0`、Ref m/z 留空自动选择、Ref Tolerance `0.1` |

### Peak Picking

**Standard Peak Detection** 支持：

- Method：`diff`、`sd`、`mad` 或 `quantile`，默认 `diff`。
- SNR：默认 `2.0`。
- Return：`height` 或 `area`，默认 `height`。
- Width：默认 `5` 个数据点。

提交时前端固定使用 Python backend。

### Peak Alignment

**Python Backend** 支持：

- Bin Function：`median`、`mean`、`min` 或 `max`，默认 `min`。
- Min Frequency：默认 `0.01`，有效定义范围为 `0–1`。

提交载荷还会固定加入 `units: ppm` 和 `binratio: 2`。

## 提交条件

**Start Analysis** 在以下条件满足时启用：

1. 已选择数据集。
2. 至少选择了一个当前可用的预处理方法。
3. 数据集元数据中有可识别的 Polarity。

不要求把所有可见方法组都选满。右侧 `Ready / Incomplete` 徽章当前使用更严格的摘要规则：只有所有当前可见方法组都有选择时才显示 `Ready`；这不会阻止按上述三个实际条件提交。

## 提交后

前端把所选方法转换为后端 `algorithms` 载荷，调用 `POST /processes`。成功后显示 **Analysis started** 并跳转到 Workspace；任务完成后点击 **View** 进入结果页，失败任务可查看后端错误信息。

如果只想快速得到可视化结果，不需要自定义预处理，可在数据集卡片使用 **Explore** 创建 Direct conversion 任务。
