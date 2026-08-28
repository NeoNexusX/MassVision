/**
 * 直连 OSS 预览图 URL。该路径已放开公共读权限，无需再调后端接口换下载 URL。
 * 拼接规则见 public/oss-direct-url.md：
 *   https://kawaru-oss.oss-cn-hangzhou.aliyuncs.com/images/file_{id}/preview.jpg
 * 预览图尚未生成时返回 404，由调用方 <img @error> 兜底占位图。
 */
export function buildPreviewImageUrl(fileId: string | number): string {
  return `https://kawaru-oss.oss-cn-hangzhou.aliyuncs.com/images/file_${fileId}/preview.jpg`
}
