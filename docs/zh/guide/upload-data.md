# 上传数据

本页介绍如何将质谱成像（MSI）数据上传至 SpatialXomics 平台。

## 1. 支持格式

平台支持 **imzML 数据对**上传，即 `.imzML`（元数据 / 谱图索引）与 `.ibd`（二进制谱图数据）两个文件需成对上传，且主文件名必须完全一致（仅扩展名不同）。

## 2. 操作步骤

### 2.1 进入上传页面

登录后，通过导航栏进入 **我的数据集（My Datasets）** 页面，点击 **Upload New Dataset** 按钮，打开上传弹窗。

![进入上传](https://official-oss.oss-cn-hongkong.aliyuncs.com/docs/1.png)

### 2.2 选择文件

点击 **Choose Files** 按钮，同时选中本地的 `.imzML` 和 `.ibd` 文件。系统会自动校验两个文件是否配对（主文件名一致），并在下方显示文件名与总大小。

![选择文件](https://official-oss.oss-cn-hongkong.aliyuncs.com/docs/2.png)

### 2.3 填写元数据

文件选择后，系统会自动解析 imzML 文件中的元数据，并预填以下字段（如 Polarity、Ionisation Source、Analyzer、Pixel Size 等）。对于文件中未包含的元数据，需手动补充。

![填写元数据](https://official-oss.oss-cn-hongkong.aliyuncs.com/docs/3.png)

![填写元数据](https://official-oss.oss-cn-hongkong.aliyuncs.com/docs/4.png)

元数据分为两组：

**采集信息（Acquisition Information）**

| 字段 | 说明 |
|------|------|
| Polarity | 极性（正离子 / 负离子模式） |
| Ionisation Source | 离子源类型 |
| Analyzer | 分析仪类型 |
| Pixel Size X / Y | 像素尺寸（μm），范围 1–200 |
| Spectrum Mode | 质谱模式（Profile / Centroid） |
| Storage Mode | 存储模式（Continuous / Processed） |
| Solvent | 溶剂组成（见下方"添加溶剂"说明） |
| MALDI Matrix | MALDI 基质（当离子源为 MALDI 时需填写） |
| MALDI Matrix Application | 基质施加方式（当离子源为 MALDI 时需填写） |
| Detector Resolving Power | 检测器分辨率（m/z 与 Resolving Power，选填） |

**样本信息（Sample Metadata）**

| 字段 | 说明 |
|------|------|
| Organism | 生物体种类 |
| Organism Part | 组织部位 |
| Condition | 样本状态 |
| Sample Stabilization | 样本稳定化方式 |
| Sample Growth Conditions | 培养条件（选填） |
| Tissue Modification | 组织修饰（选填） |

> 带 \* 号的字段为必填项。

#### 添加溶剂

溶剂通过 **Solvent Picker** 组件添加：在百分比输入框中输入数值（1–100），在下拉框中选择溶剂类型，点击右侧 **+** 按钮即可添加至列表。支持添加多种溶剂组合。若无法确定具体溶剂，保留默认的 `100% Water` 即可。

![添加溶剂](https://neonexus-picture.oss-ap-southeast-1.aliyuncs.com/test/image-20260703120422329.png)

### 2.4 设置公开/私有

勾选 **Make dataset public (visible to others)** 复选框可将数据集发布为公开数据集，所有用户均可查看。不勾选则仅自己可见。

![公开选项](https://neonexus-picture.oss-ap-southeast-1.aliyuncs.com/test/image-20260703115054607.png)

> 若选择公开，点击确认提交后会弹出二次确认对话框，确认后数据集将对所有用户可见。

### 2.5 提交上传

确认信息无误后，点击 **Confirm & Upload** 按钮提交上传。

![确认提交](https://neonexus-picture.oss-ap-southeast-1.aliyuncs.com/test/image-20260703115249346.png)

系统随后进入上传进度界面，显示当前进度百分比、上传速度和预计剩余时间。如需取消，可点击 **Abort Upload** 按钮。

![上传进度](https://neonexus-picture.oss-ap-southeast-1.aliyuncs.com/test/image-20260703115800703.png)

上传过程中，系统会自动检测数据是否与服务器已有数据重复：若已有其他用户上传过相同数据，后台将直接复用既有副本，无需重复上传，大幅节省时间。

## 3. 续传与重试

### 断点续传

上传过程中若关闭页面或网络中断，再次打开上传弹窗时会出现 **续传提示**，点击 **Resume** 即可从上次断点继续，无需重新选择文件或填写元数据。

![续传提示](https://neonexus-picture.oss-ap-southeast-1.aliyuncs.com/test/image-20260703115821860.png)

点击 **Discard** 则会清除续传状态，下次需重新上传。

### 自动重试

单个分片上传失败时，系统会自动发起重试；仅在多次重试仍失败的情况下，才会提示用户介入处理。

## 4. 小贴士

- 上传前请确认 `.imzML` 与 `.ibd` 的主文件名（不含扩展名）完全一致。
- 大文件的哈希计算与压缩在后台异步执行，期间可正常浏览其他页面。
- 若上传失败，建议优先检查文件名是否匹配、网络是否稳定，再使用续传功能重新发起上传。