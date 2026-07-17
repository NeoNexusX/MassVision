# 上传数据

本页介绍如何将质谱成像（MSI）数据上传至 SpatialXomics 平台。

## 1. 支持的格式

- **imzML 数据对**：`.imzML`（元数据 / 谱图索引）与 `.ibd`（二进制谱图数据）需成对上传，且两个文件必须**主文件名相同**（仅扩展名不同），否则无法完成配对识别。

## 2. 操作步骤

#### 1.点击右侧按钮，登录个人账号

![image-20260703113729368](https://neonexus-picture.oss-ap-southeast-1.aliyuncs.com/test/image-20260703113729368.png)

#### 2.进入个人数据集页面，点击 **上传** 按钮，打开上传弹窗。

![image-20260703113834009](https://neonexus-picture.oss-ap-southeast-1.aliyuncs.com/test/image-20260703113834009.png)

#### 3.选择本地的 `.imzML` 与 `.ibd` 文件对（支持点击选择或拖拽上传），并补全数据集元信息（如分析仪类型、离子源、像素尺寸等）。

![image-20260703114021254](https://neonexus-picture.oss-ap-southeast-1.aliyuncs.com/test/image-20260703114021254.png)

#### 4.填写数据集元信息：系统会优先从文件中自动解析并填充已有字段，对于文件中未提供的元数据，需手动补充。

<img src="https://neonexus-picture.oss-ap-southeast-1.aliyuncs.com/test/image-20260703114430946.png" alt="image-20260703114430946" style="zoom: 50%;" />

**如需将数据集发布为公开数据集，请勾选对应选项：**

<img src="https://neonexus-picture.oss-ap-southeast-1.aliyuncs.com/test/image-20260703115054607.png" alt="image-20260703115054607" style="zoom:67%;" />

**填写溶剂信息后，请点击右侧加号添加至列表，以确认该项已加入：**

<img src="https://neonexus-picture.oss-ap-southeast-1.aliyuncs.com/test/image-20260703120422329.png" alt="image-20260703120422329" style="zoom:50%;" />

若无法确定具体溶剂，建议选择 `100% Water` 作为默认项；如已知溶剂组成，请选择对应的选项。

确认信息无误后，点击 **确认** 即可提交上传任务：

<img src="https://neonexus-picture.oss-ap-southeast-1.aliyuncs.com/test/image-20260703115249346.png" alt="image-20260703115249346" style="zoom: 50%;" />

<img src="https://neonexus-picture.oss-ap-southeast-1.aliyuncs.com/test/image-20260703115800703.png" alt="image-20260703115800703" style="zoom:50%;" />

上传过程中，系统会计算数据哈希并与全量数据库进行比对：若已有其他用户上传过相同数据，后台将自动复用既有副本，无需重复上传。

## 3. 续传与重试

- 上传过程中的分片状态（`uploadId`、已完成分片、凭证有效期等）会持久化至本地存储。若上传过程中关闭页面或网络中断，再次打开上传弹窗时将出现 **续传提示**，点击即可从上次断点继续，无需重新压缩或重新计算哈希。

<img src="https://neonexus-picture.oss-ap-southeast-1.aliyuncs.com/test/image-20260703115821860.png" alt="image-20260703115821860" style="zoom:50%;" />

- 单个分片上传失败时，系统将自动发起重试；仅在重试仍失败的情况下，才会提示用户介入处理。

## 4. 小贴士

- 上传前请确认 `.imzML` 与 `.ibd` 的主文件名（不含扩展名）完全一致。
- 大文件的哈希计算与压缩在后台异步执行，期间可正常浏览其他页面。
- 若上传失败，建议优先检查文件名是否匹配、网络是否稳定，再使用续传功能重新发起上传。