import { getConfig } from '@/shared/config/runtimeConfig'

/** OSS 图片样式后缀（缩略在 OSS 侧按样式名处理） */
const OSS_STYLE = '_preview'

/**
 * 直连 base：bucket/region 因部署环境而异（测试/正式服务器不同），取自
 * config.json 的 `oss.previewImageBase`；loadConfig 已保证缺省时兜底为
 * 测试环境域名，因此运行到这里必定有值。
 */
function previewBase(): string {
  return getConfig().oss!.previewImageBase!
}

/**
 * 直连 OSS 预览图 URL。该路径已放开公共读权限，无需再调后端接口换下载 URL。
 * 完整 URL 形如：
 *   https://{bucket}.oss-{region}.aliyuncs.com/images/file_{id}/preview.jpg_preview
 * 预览图尚未生成时返回 404，由调用方 <img @error> 兜底占位图。
 */
export function buildPreviewImageUrl(fileId: string | number): string {
  return `${previewBase()}/images/file_${fileId}/preview.jpg${OSS_STYLE}`
}

/**
 * 固定返回 3 张预览图 URL：preview.jpg / preview_2.jpg / preview_3.jpg
 * 用于 DatasetPreviewGallery 的 hover-gallery 展示。
 */
export function buildPreviewImageUrls(fileId: string | number): [string, string, string] {
  return [
    `${previewBase()}/images/file_${fileId}/preview.jpg${OSS_STYLE}`,
    `${previewBase()}/images/file_${fileId}/preview_2.jpg${OSS_STYLE}`,
    `${previewBase()}/images/file_${fileId}/preview_3.jpg${OSS_STYLE}`,
  ]
}
