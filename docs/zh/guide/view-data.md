# 查看数据

SpatialXomics 提供两种方式将质谱成像数据转为可交互的可视化结果：

## 1. 两种可视化方式

### 一键可视化（Explore / Raw-Convert）

无需配置任何预处理参数，从数据集列表页直接发起，后端自动完成所有转换步骤。

**适用场景**：快速浏览数据、初次查看数据集内容、无需自定义预处理流程。

**操作步骤：**

1. 在 **公开数据集** 或 **我的数据集** 列表中，找到目标数据集卡片。
2. 若卡片按钮显示 **Explore**，说明该数据集尚未转换过，点击即可发起一键可视化。
3. 系统弹出确认框，标题为「Prepare Visualization」，点击 **Generate** 确认。
4. 提示「Task is in progress」后，页面自动跳转到工作区（Workspace），可在任务列表中跟踪转换进度。若未发生跳转，说明该任务已存在于他人工作区，只需稍作等待，按钮变为Visualize即可查看。
5. 任务状态变为 `completed` 后，点击 **View** 进入结果页查看。

![view-1](https://official-oss.oss-cn-hongkong.aliyuncs.com/docs/view-1.png)

![view-2](https://official-oss.oss-cn-hongkong.aliyuncs.com/docs/view-2.png)

**再次查看**：转换完成后，数据集卡片按钮会变为 **Visualize**，点击直接进入结果页，无需重复转换。

![view-3](https://official-oss.oss-cn-hongkong.aliyuncs.com/docs/view-3.png)

### 预处理分析（Workspace Analysis）

在 Workspace 中手动创建分析任务，自行选择去噪、基线校正、归一化、峰检测、峰对齐等预处理算法和参数。

**适用场景**：需要精细控制预处理流程、对比不同算法效果、复现分析过程。

具体的创建步骤（选择数据源、配置预处理管线、提交任务等）请参阅 [创建分析](/zh/guide/create-analysis) 一文。任务完成后，在 Workspace 任务列表中点击 **View** 即可进入结果页。

> 无论哪种方式，最终的交互式可视化界面（离子图像、质谱图、ROI 等）是相同的。下文各节介绍结果页的统一操作方式。

---

## 2. 如何进入结果页

通过以上任一方式生成可视化任务后，在 **工作区（Workspace）** 的任务列表中，状态为 `completed` 的任务会显示 **View** 按钮，点击即可进入结果页。

![view-5](https://official-oss.oss-cn-hongkong.aliyuncs.com/docs/view-5.png)

> 结果页路径为 `/workspace/results`，需要登录才可访问。任务状态为 `processing` 时暂时无法查看结果；`failed` 的任务点击后可查看错误原因。

## 3. 页面布局

结果页采用两栏布局：

- **左侧主区域**：上方为离子图像或TIC图像（含工具栏和 Zoom 控件），下方为质谱图（含底部统计信息）。
- **右侧面板**：包含显示范围调节、统计直方图、数据集元信息、预处理方法，以及 ROI 叠加控制。

![view-6](https://official-oss.oss-cn-hongkong.aliyuncs.com/docs/view-6.png)

---

## 4. 数据模式

结果页支持两种数据查看模式，由数据集本身的存储模式决定：

| 模式 | 说明 | 可以做什么 |
|---|---|---|
| **Continuous** | 以某个 m/z 的离子强度分布渲染图像 | 切换 m/z、查看平均质谱、点击峰联动 |
| **Processed** | 以 TIC（Total Ion Current）渲染图像 | 查看 TIC 图、点击像素查看该像素的质谱 |

两种模式下的交互有所差异，下文各节会分别说明。

---

## 5. 离子图像

### 基本操作

- **缩放**：鼠标滚轮缩放，以鼠标位置为中心。
- **平移**：缩放超过 1× 后，可拖拽平移图像。
- **Zoom 控件**：图像右下角提供 − / + 按钮和当前倍率显示，点击 Reset 可恢复 1:1。
- **像素悬停**：鼠标悬停在图像上时，显示浮窗信息——像素坐标 (col, row) 与强度值。

![view-7](https://official-oss.oss-cn-hongkong.aliyuncs.com/docs/view-7.png)

### 工具栏

图像顶部工具栏提供以下控件：

| 控件 | 说明 | 适用模式 |
|---|---|---|
| 标题 | 显示当前模式名称（Ion Image / TIC Image） | 通用 |
| m/z 值 | 显示当前选的 m/z 值 | Continuous |
| 容差（Tolerance） | 调节 m/z 匹配容差（最小 0.001） | Continuous |
| 配色方案（Colormap） | 切换 Viridis / Inferno / Plasma / Gray 四种配色 | 通用 |
| 强度刻度（Scale） | 切换 Linear（线性）或 Log（对数） | 通用 |
| Reset | 一键重置所有图像参数（容差、配色、刻度、Gamma、显示范围） | 通用 |

> **关于容差**：容差定义了 m/z 匹配时允许的误差范围——例如，当容差设为 0.01、选中 m/z 为 889.58 时，m/z 在 889.57 ~ 889.59 范围内的信号都会被视为同一离子。容差越小匹配越严格，越大则匹配范围越宽。

![view-8](https://official-oss.oss-cn-hongkong.aliyuncs.com/docs/view-8.png)

### 显示范围调节

离子图像中的每个像素颜色由该位置的离子强度值决定：**低强度→深色端，高强度→亮色端**，中间值按当前配色方案（Colormap）进行渐变映射。

图像右侧的垂直强度条（Gradient Strip）直观展示了这一映射关系，自上而下为当前配色对应的完整强度梯度，并支持手动调节显示范围：

- 拖动 Min / Max 手柄调整范围上下限。
- 点击手柄之间的强度条可快速移动到对应位置。
- 点击 ↺ 按钮恢复自动范围（P1 ~ P95）。

### Gamma 调节

右侧面板的 **Visualization** 区域提供 Gamma 滑块，范围 0.5 ~ 1.5。增大 Gamma 使低强度区域更亮，减小 Gamma 则增强高亮区域对比度。

**Gamma = 1.0（默认）：**

![view-9](https://official-oss.oss-cn-hongkong.aliyuncs.com/docs/view-9.png)

**Gamma = 0.5：**

![view-10](https://official-oss.oss-cn-hongkong.aliyuncs.com/docs/view-10.png)

### Processed 模式下的像素点击

在 Processed / TIC 模式下，点击图像中的像素会加载该像素的质谱图（见下文质谱图部分）。

![view-11](https://official-oss.oss-cn-hongkong.aliyuncs.com/docs/view-11.png)

---

## 6. 质谱图

质谱图位于离子图像下方。

### 谱图模式

根据数据特性，质谱图有两种呈现方式：

| 模式 | 显示 | 对应数据模式 |
|---|---|---|
| **Centroid（质心谱）** | 中灰色柱状图，每根柱子代表一个检测到的峰 | Continuous / Processed|
| **Profile（轮廓谱）** | 深灰色连续折线图，展示完整谱图轮廓 | Continuous / Processed |

**Centroid（质心谱）：**

![view-12](https://official-oss.oss-cn-hongkong.aliyuncs.com/docs/view-12.png)

**Profile（轮廓谱）：**

![view-13](https://official-oss.oss-cn-hongkong.aliyuncs.com/docs/view-13.png)

### Continuous 模式下的交互

- **平均质谱**：显示整个数据集所有像素点的平均质谱。
- **点击选峰**：点击谱图中任意位置，离子图像会自动切换到对应的 m/z 值。
- **红色选择线**：当前选中 m/z 处显示红色竖线，随缩放保持同步。
- **联动高亮**：离子图像上选点 → 谱图高亮位置更新；谱图点击峰 → 离子图像切换 m/z。双向联动。

例如，在谱图中点击 m/z 889.5810 处的峰，离子图像将自动切换到该 m/z 值的离子强度分布图。

![view-14](https://official-oss.oss-cn-hongkong.aliyuncs.com/docs/view-14.png)

### Processed 模式下的交互

- **像素质谱**：点击 TIC 图像中的像素后，谱图切换为该像素的质谱，标题显示 "Spectrum — Pixel (66, 66)"。

![view-15](https://official-oss.oss-cn-hongkong.aliyuncs.com/docs/view-15.png)

### 缩放与浏览

- **内置缩放**：支持鼠标框选区域放大。
- **底部滑块**：拖拽滑块两端调整 X 轴（m/z）显示范围。

### 底部统计信息

谱图下方显示当前数据的统计摘要：

| 统计项 | Continuous 模式 | Processed 模式 |
|---|---|---|
| Peaks 数 | 检测到的峰数量 | 该像素的峰数量 |
| Intensity 范围 | 最小 / 最大强度值 | 最小 / 最大强度值 |
| Selected m/z | 当前选中的 m/z 值 + 容差 | — |
| Pixel 坐标 | — | 当前选中像素的 (x, y) |

### 重试

谱图加载失败时，显示错误提示与 **Retry** 按钮，点击可重新加载。

---

## 7. 右侧面板

### 显示范围（Display Range）

- 显示当前 Min / Max 强度值及其对应百分位。

### 统计直方图（Statistic）

- 强度分布直方图。
- 红色标记线指示当前 displayMin / displayMax 在分布中的位置。
- 文本统计：**Dimensions**（总像素数）、**Non-zero**（非零像素比例）、**TIC**（总离子流值）。

### 元信息（Info）

显示数据集的采集与分析参数：

| 字段 | 说明 |
|---|---|
| Polarity | 极性（positive / negative） |
| Analyzer | 分析仪类型（如 Q-TOF） |
| Ionisation Source | 离子源（如 ESI、MALDI） |
| Pixel Size | 像素大小（μm） |
| Spectrum Mode | 谱图模式（centroid / profile） |
| Storage Mode | 存储模式（continuous / processed） |

### 预处理方法（Preprocessing）

展示该数据集在分析过程中应用过的预处理方法列表。

![view-16](https://official-oss.oss-cn-hongkong.aliyuncs.com/docs/view-16.png)

---

## 8. ROI 区域分析

在离子图像上绘制感兴趣区域（Region of Interest），聚焦特定组织区域进行统计或对比分析。

### 绘制工具

右侧面板的 **Region of interest** 区域提供两种绘制模式：

| 工具 | 操作方式 | 显示样式 |
|---|---|---|
| **Rectangle（矩形）** | 在图像上按住拖拽绘制矩形，四角手柄可调整大小，点击内部可移动 | 红色半透明填充 + 红色描边 |
| **Lasso（自由形状）** | 在图像上逐点点击绘制多边形，系统自动闭合路径（至少 5 个点） | 蓝色描边 |

### 确认与管理

- 绘制完成后点击 **Confirm** 确认 ROI，系统自动计算该区域的统计信息（像素数、均值、标准差、最小值、最大值、总和）。
- 点击 **Cancel** 清除当前草稿。
- 确认后的 ROI 会显示在列表中，每个 ROI 有其颜色标签，可单独删除或一键 **Clear All**。
- 最多分配 6 种颜色，循环使用。

**绘制 ROI：**

![view-17](https://official-oss.oss-cn-hongkong.aliyuncs.com/docs/view-17.png)

**确认 ROI：**

![view-18](https://official-oss.oss-cn-hongkong.aliyuncs.com/docs/view-18.png)

### Viewing ROI 模式

确认 ROI 后，图像自动切换为 **Viewing ROI** 模式——仅显示 ROI 区域内的像素，其余像素隐藏，便于聚焦分析。

**多次选择**：可依次绘制并确认多个 ROI，系统会对所有已确认的 ROI 取并集显示——即属于任一 ROI 的像素均会保留，其余区域继续隐藏。点击 **Reset** 可恢复到完整图像。

> 如需在新的区域继续绘制 ROI，请先点击 **Reset** 恢复完整图像，否则 Viewing ROI 模式下仅显示已有 ROI 范围内的像素。

![view-19](https://official-oss.oss-cn-hongkong.aliyuncs.com/docs/view-19.png)

---

## 9. 使用提示

- 离子图像与谱图的选择是双向联动的，便于快速定位感兴趣的 m/z。
- 滚轮缩放时鼠标所在位置即为缩放中心，可以精准放大关注区域。
- 谱图底部的滑块适合快速定位 m/z 区间，尤其适用于宽质量范围的质谱数据。
- 首次加载可能需要几秒钟，期间请耐心等待。
