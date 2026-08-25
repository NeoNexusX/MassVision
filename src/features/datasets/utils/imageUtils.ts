const OSS_BASE = 'https://kawaru-oss.oss-cn-hangzhou.aliyuncs.com'
const OSS_STYLE = '_preview'

/**
 * 直连 OSS 预览图 URL。该路径已放开公共读权限，无需再调后端接口换下载 URL。
 * 拼接规则见 public/oss-direct-url.md：
 *   https://kawaru-oss.oss-cn-hangzhou.aliyuncs.com/images/file_{id}/preview.jpg
 * 预览图尚未生成时返回 404，由调用方 <img @error> 兜底占位图。
 */
export function buildPreviewImageUrl(fileId: string | number): string {
  return `${OSS_BASE}/images/file_${fileId}/preview.jpg${OSS_STYLE}`
}

/**
 * 固定返回 3 张预览图 URL：preview.jpg / preview_2.jpg / preview_3.jpg
 * 用于 DatasetPreviewGallery 的 hover-gallery 展示。
 */
export function buildPreviewImageUrls(fileId: string | number): [string, string, string] {
  return [
    `${OSS_BASE}/images/file_${fileId}/preview.jpg${OSS_STYLE}`,
    `${OSS_BASE}/images/file_${fileId}/preview_2.jpg${OSS_STYLE}`,
    `${OSS_BASE}/images/file_${fileId}/preview_3.jpg${OSS_STYLE}`,
  ]
}
