# 创建新分析

本文介绍如何在 **SpatialXomics** 工作区中创建新的分析任务，包括选择数据源与配置预处理管线。

## 1. 进入页面

登录后，通过导航栏进入 **Workspace（工作区）**，点击 **New Analysis（新建分析）** 按钮即可进入创建页面。

![创建新分析入口](https://official-oss.oss-cn-hongkong.aliyuncs.com/docs/Analysis_1.png)

创建新分析页面分为两个主要区域：左侧为配置步骤区，右侧为分析摘要面板。

![创建新分析页面](https://official-oss.oss-cn-hongkong.aliyuncs.com/docs/Analysis_2.png)

---

## 2. 步骤一：选择数据源

在此步骤中，你需要选择一个待分析的数据集。

![数据源选择](https://official-oss.oss-cn-hongkong.aliyuncs.com/docs/Analysis_3.png)

### 切换数据源

页面顶部有两个选项卡：

- **My Datasets（我的数据集）**：显示你已上传的私有数据集。
- **Public Datasets（公开数据集）**：显示平台上所有已公开的数据集。

### 搜索与浏览

- 在搜索框中输入关键词，可按名称筛选数据集。
- 列表展示每个数据集的**名称**与**文件大小**。
- 使用底部分页栏翻页浏览更多数据集。

### 选择数据集

![选择数据集](https://official-oss.oss-cn-hongkong.aliyuncs.com/docs/Analysis_7.png)

点击列表中的任意一行，或点击右侧单选按钮，即可选中该数据集。选中后，系统会自动：

- 识别数据集的**质谱模式**（Profile / Centroid）与**存储模式**（Continuous / Processed）。
- 从数据集元数据中自动填充仪器参数（如离子源、分析仪、像素尺寸等），便于后续步骤使用。

> **注意**：数据集的质谱模式与存储模式共同决定可用的预处理方法。例如，Profile 模式的数据需要先完成峰提取（Peak Picking）后才能进行峰对齐（Peak Alignment）；Centroid + Continuous 模式的数据由于所有像素已共享同一条 m/z 轴（等同于已对齐），不支持峰对齐。

---

## 3. 步骤二：配置预处理管线

选定数据集后，你需要为分析配置预处理管线。每个方法组内**只能选择一个方法**（单选），部分方法支持自定义参数。

![预处理管线配置](https://official-oss.oss-cn-hongkong.aliyuncs.com/docs/Analysis_4.png)

### 降噪（Noise Reduction）

减少信号噪声，同时尽可能保留质谱峰。

| 方法 | 说明 | 可调参数 |
|------|------|----------|
| **Savitzky–Golay** | Savitzky–Golay 平滑滤波 | Window（窗口大小）、Polyorder（多项式阶数）、Derivative（导数阶数）、Delta（采样间距） |
| **Gaussian** | 高斯平滑滤波 | Window（窗口大小）、Sigma（标准差） |
| **Moving Average** | 移动平均平滑 | Window（窗口大小） |

### 基线校正（Baseline Correction）

去除基线漂移，校正背景信号。

| 方法 | 说明 |
|------|------|
| **SNIP** | Statistics-sensitive Nonlinear Iterative Peak-clipping 算法 |
| **Local Minimum** | 局部最小值基线估计 |

两种方法均无需额外参数。

### 归一化（Normalization）

将不同谱图的强度缩放到可比较的范围。

| 方法 | 说明 | 可调参数 |
|------|------|----------|
| **TIC** | 总离子流归一化 | Scale（输出缩放因子） |
| **RMS** | 均方根归一化 | Scale（输出缩放因子） |
| **REF** | 参考峰归一化 | Scale（输出缩放因子）、Ref m/z（参考质荷比，留空自动选择）、Ref Tolerance（参考峰容差） |

### 峰提取（Peak Picking）

从谱图中检测并提取质谱峰。

| 方法 | 说明 | 可调参数 |
|------|------|----------|
| **Standard Peak Detection** | 标准峰检测 | Method（检测方法：Differential / Std Dev / MAD / Quantile）、SNR（信噪比阈值）、Return（返回值类型：Height / Area）、Width（峰宽数据点数） |

### 峰对齐（Peak Alignment）

将不同谱图中的峰对齐到公共 m/z 轴上。

| 方法 | 说明 | 可调参数 |
|------|------|----------|
| **Python Backend** | 基于 Python 后端的峰对齐 | Bin Function（分箱函数：Median / Mean / Min / Max）、Min Frequency（最小频率阈值） |

> **提示**：如果数据集为 **Profile 模式**，需要先选择峰提取（Peak Picking）方法后，峰对齐（Peak Alignment）选项才会出现。**Centroid + Processed** 模式的数据每个像素的峰各自存储在不同的 m/z 轴上，需要峰对齐来统一到公共轴；而 **Centroid + Continuous** 模式的数据所有像素本就共享同一条 m/z 轴，峰已等同于对齐过，因此不支持峰对齐。

### 模式提示

选定数据集后，系统会在预处理管线区域顶部显示一条蓝色提示信息，说明当前数据的质谱/存储模式，以及哪些方法可用或受限。

---

## 4. 分析摘要面板

页面右侧固定显示**分析摘要面板**，实时汇总当前配置。

![分析摘要面板](https://official-oss.oss-cn-hongkong.aliyuncs.com/docs/Analysis_5.png)

### 面板内容

- **状态标签**：显示 `Ready`（就绪，绿色）或 `Incomplete`（未完成，黄色），提示当前配置是否满足提交条件。
- **管线摘要**：列出每个方法组的选择情况，已选择的方法显示方法名称和 ✓ 标记。
- **数据集元数据**：展示从数据集中自动解析的元信息（如 Polarity、Ionisation Source、Analyzer、Pixel、Organism 等）。
- **已选数据集**：显示数据集名称与文件大小。
- **开始分析按钮**：点击 **Start Analysis** 提交分析任务。

### 提交条件

提交按钮仅在以下条件**全部满足**时可用：

1. 已选择数据集。
2. 每个方法组均已选择一种方法。
3. 已指定 Polarity（极性，正离子/负离子模式）。

条件不满足时，按钮呈灰色不可点击状态，并显示提示文字 *"Select dataset and configure pipeline first"*。

---

## 5. 提交分析

点击 **Start Analysis** 后，系统会将配置提交至后端并创建分析任务。提交成功后：

1. 页面顶部弹出成功提示。
2. 自动跳转至 **Workspace（工作区）** 页面，你可以在任务列表中查看新创建的分析任务及其执行状态。

![分析提交成功](https://official-oss.oss-cn-hongkong.aliyuncs.com/docs/Analysis_6.png)

---

## 6. 小贴士

- 选择数据集前，建议先在「我的数据集」页面上传所需数据，或确认「公开数据集」中已有目标数据。
- 预处理管线中各方法组为**单选**——每个组只能选择一种方法，但你可以随时切换选择。
- 如果不确定某个参数的含义，可以将鼠标悬停在参数标签上查看提示信息；保留默认值通常也能获得不错的效果。
- 分析任务的执行时间取决于数据大小与所选方法的复杂度，建议耐心等待。
