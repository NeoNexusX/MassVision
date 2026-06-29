import { addCollection, type IconifyJSON } from '@iconify/vue'
import rawBundle from './iconBundle.generated.json'

const bundle = rawBundle as unknown as IconifyJSON[]

/**
 * 全部图标统一走 Iconify，但默认的 <Icon icon="prefix:name"/> 会在运行时向
 * api.iconify.design 拉取数据。这里改为启动时把构建期生成的图标子集
 * （见 scripts/build-icon-bundle.mjs）addCollection() 注册进缓存，使应用完全离线可用。
 *
 * 新增图标用法时，先把图标名加进 scripts/iconNames.mjs，再跑 `npm run icons:bundle`
 * 重新生成 iconBundle.generated.json，否则运行时会因为本地缓存没有这个图标而
 * 回退去请求公共 API。
 */
for (const collection of bundle) {
  addCollection(collection)
}
