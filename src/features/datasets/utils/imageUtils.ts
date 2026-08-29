import { getConfig } from '@/shared/config/runtimeConfig'

/**
 * 直连 OSS 预览图 URL。该路径已放开公共读权限，无需再调后端接口换下载 URL。
 * base 域名因部署环境而异（测试/正式服务器 bucket 不同），取自 config.json 的
 * `oss.previewImageBase`（缺省回退测试环境域名），完整 URL 形如：
 *   https://{bucket}.oss-{region}.aliyuncs.com/images/file_{id}/preview.jpg
 * 预览图尚未生成时返回 404，由调用方 <img @error> 兜底占位图。
 */
export function buildPreviewImageUrl(fileId: string | number): string {
  return `${getConfig().oss!.previewImageBase}/images/file_${fileId}/preview.jpg`
}
