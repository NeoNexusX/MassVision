import { reactive, watch, type Ref } from 'vue'
import { getPublicCollection } from '../api/collectionApi'
import type { CollectionSummary } from '../types/collection'

/**
 * 列表卡片封面用的成员预览目录。
 *
 * 列表接口（POST /collections/list_all、POST /collections/list）只返回集合本身，不带 members，
 * 而预览图 URL 由成员的 image_path 决定（后端确认 OSS 目录非空才写入）。详情读取
 * 走免登录公开接口（GET /collections/public/{public_id}，认证版
 * GET /collections/{id} 暂不使用），所以这里按列表行携带的 public_id 逐卡拉一次
 * 详情并把成员 imagePath 缓存下来：同一集合只请求一次、并发不重发；行上没有
 * public_id 时不发请求（封面回退占位图）；后端将来若在列表里带上 members，
 * 则直接采用。
 */
export function useCollectionCovers(collections: Ref<CollectionSummary[]>) {
  /** 集合 id → 有序的成员 imagePath（null = 该成员预览未生成，槽位走占位图） */
  const memberImagePaths = reactive<Record<number, (string | null)[]>>({})
  /** 集合 id → 封面是否仍在拉取（卡片据此显示骨架而不是占位图） */
  const loading = reactive<Record<number, boolean>>({})
  const inFlight = new Set<number>()

  function load(collection: CollectionSummary) {
    const id = collection.id
    if (memberImagePaths[id] || inFlight.has(id)) return

    if (collection.members) {
      memberImagePaths[id] = collection.members.map((m) => m.imagePath)
      return
    }

    // 行上没有 public_id（后端列表未携带）就无键可查：留空，卡片回退占位图
    if (!collection.publicId) {
      memberImagePaths[id] = []
      return
    }

    inFlight.add(id)
    loading[id] = true
    getPublicCollection(collection.publicId)
      .then((detail) => {
        memberImagePaths[id] = detail.members.map((m) => m.imagePath)
      })
      .catch(() => {
        // 封面拉取失败不该影响整个列表：留空，卡片回退占位图
        memberImagePaths[id] = []
      })
      .finally(() => {
        inFlight.delete(id)
        loading[id] = false
      })
  }

  watch(collections, (list) => list.forEach(load), { immediate: true })

  return { memberImagePaths, loading }
}
