# 上传数据

本页说明当前 imzML 上传流程。上传入口位于登录后的 **My Datasets → Upload New Dataset**。

## 文件要求

- 必须同时选择一个 `.imzML` 和一个 `.ibd` 文件。
- 两个文件的主文件名必须完全一致，扩展名大小写不影响识别。
- 前端会检查 imzML 是否包含基本结构标签；解析失败时不会阻止你重新选择文件。
- 公开数据集的 `.ibd` 文件不得小于 **10 MB**；私有数据集没有这项前端限制。

## 填写元数据

选中文件后，前端会尝试从 imzML 自动读取极性、离子源、分析仪、像素尺寸、Spectrum Mode 和 Storage Mode。没有识别出的内容需要手动填写；手动修改已识别的 Spectrum/Storage Mode 时会出现二次确认。

以下字段始终必填：

| 分组 | 字段 |
|---|---|
| 采集信息 | Polarity、Ionisation Source、Analyzer、Pixel Size X/Y、Spectrum Mode、Storage Mode |
| 样本信息 | Organism、Organism Part、Condition、Sample Stabilization |

补充规则：

- Pixel Size X/Y 必须是 `1–200` 的整数。
- Sample Growth Conditions 和 Tissue Modification 可选。
- Detector resolving power 下的 m/z 与 Resolving Power 可选，合法数值会以数字提交。
- Solvent、MALDI Matrix 和 MALDI Matrix Application 是否必填由 `public/config.json` 中的离子源规则决定。表单默认带有 `100% Water`；MALDI 类离子源通常还要求基质及施加方式。
- 选择下拉框中的 **Other** 后必须填写自定义值，不能直接提交 `Other`。

## 公开与私有

**Make dataset public (visible to others)** 当前默认勾选：

- 保持勾选：上传前需要再次确认，完成后其他用户可见；`.ibd` 至少 10 MB。
- 取消勾选：数据集只在自己的 **My Datasets** 中可见。

现有私有数据集也可以在详情页通过 **Make Public** 公开；该操作在当前 UI 中不可逆。

## 实际上传流程

点击 **Confirm & Upload** 后，前端按以下顺序执行：

1. 在 Web Worker 中分块计算两个原始文件的组合 MD5。
2. 调用预检接口，用原始大小和 MD5 检查服务端是否已有相同数据。
3. 若服务端可复用，直接完成，不再压缩或上传。
4. 若不能复用，检查存储配额，并在浏览器 OPFS 中生成包含两个文件的 ZIP64 归档。
5. 从后端取得 OSS STS 临时凭证，使用 `ali-oss` 分片上传归档。
6. 上传完成后清除本地续传会话和 OPFS 临时 ZIP。

进度面板会显示当前阶段、百分比、速度和预计剩余时间。**Abort Upload** 会中止当前 OSS multipart upload，并保留已生成的本地归档，使后续可以重新发起上传。

## 断点续传

续传信息保存在当前站点的 `localStorage`，压缩后的 ZIP 保存在当前浏览器的 OPFS。因此：

- 只有在上传会话和本地 ZIP 已成功建立后，重新打开上传弹窗才会出现 **Resume / Discard**。
- 必须使用同一浏览器、同一站点来源和同一浏览器配置；清理站点数据会丢失续传文件。
- STS 会话过期后不能继续使用，前端会清理旧会话并要求重新上传。
- **Resume** 使用已保存的 multipart checkpoint；主动取消后的会话会从新的 multipart upload 开始，但复用本地 ZIP。
- **Discard** 删除会话和 OPFS 临时文件。

OSS 上传失败时会自动再尝试一次（最多两次尝试）。第二次仍失败会保留可恢复状态并显示错误。

## 常见问题

- **文件无法选择**：确认两个文件一次选中，且主文件名一致。
- **元数据无法提交**：检查所有星号字段、像素尺寸和离子源动态字段；`Other` 必须补充具体值。
- **公开上传被拒绝**：检查 `.ibd` 是否至少 10 MB。
- **没有 Resume**：压缩/凭证阶段可能尚未完成，或站点数据、OPFS 文件、STS 会话已经失效。
