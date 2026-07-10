# 下载数据

本页介绍如何从 SpatialXomics 平台下载已上传的 MSI 原始数据（`.imzML` / `.ibd` 文件对）。

## 下载须知

- **需要登录**：下载操作需要登录账号；未登录状态下点击下载按钮，会自动跳转至登录页并提示需要登录。
- **下载的是原始文件对**：每次下载会同时获取该数据集对应的 `.imzML` 与 `.ibd` 两个文件。
- **频率限制**：两次下载操作之间需等待冷却时间(一分钟)，避免频繁请求。
- **次数配额**：每个账号存在下载次数上限，由管理员统一管理，超出后请联系管理员。

## 操作步骤

#### 1.从数据集列表页下载

无论是「公开数据集」（Public Datasets）还是「我的数据集」（My Datasets）列表页，每个数据集卡片上都提供下载按钮，点击即可发起下载。

![download-1](https://official-oss.oss-cn-hongkong.aliyuncs.com/docs/download-1.png)

#### 2.未登录时会跳转登录页

若未登录时点击下载，会弹出提示并自动跳转到登录页；登录成功后可返回列表页继续操作。

![download-2](https://official-oss.oss-cn-hongkong.aliyuncs.com/docs/download-2.png)

#### 3.从数据集详情页下载

点击数据集卡片进入详情（Overview）页，页面内同样提供下载按钮，点击即可下载当前数据集，同样需要登录。

![download-3](https://official-oss.oss-cn-hongkong.aliyuncs.com/docs/download-3.png)

#### 4.下载进行中的状态提示

点击下载后，页面顶部会显示下载状态提示（下载中 / 下载已开始）；浏览器会依次下载 `.imzML` 与 `.ibd` 两个文件。

![download-4](https://official-oss.oss-cn-hongkong.aliyuncs.com/docs/download-4.png)

![download-5](https://official-oss.oss-cn-hongkong.aliyuncs.com/docs/download-5.png)

## 下载限制

- **冷却时间**：两次下载之间需等待 60 秒冷却时间；冷却期内点击会提示「Download is limited. Please wait Xs.」。

![download-6](https://official-oss.oss-cn-hongkong.aliyuncs.com/docs/download-6.png)

- **次数配额**：每个账号有下载次数上限，超出后请联系管理员调整。

![download-7](https://official-oss.oss-cn-hongkong.aliyuncs.com/docs/download-7.jpg)

## 小贴士

- 若下载没有反应，请检查浏览器是否拦截了多文件下载弹窗，需在浏览器设置中允许该站点的下载权限。
- 下载失败时优先检查网络连接，稍后重新点击下载按钮重试。
- 若长期无法下载，可能是账号配额已用尽，请联系管理员核实。
