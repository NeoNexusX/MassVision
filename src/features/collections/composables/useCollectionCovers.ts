import { reactive, watch, type Ref } from 'vue'
import { getCollection } from '../api/collectionApi'
import type { CollectionSummary } from '../types/collection'

/**
 * 列表卡片封面用的成员 id。
 *
 * 列表接口（GET /collections/all、GET /collections）只返回集合本身，不带 members，
 * 而 OSS 预览图是按成员 file_id 取的（images/file_{id}/preview.jpg）。所以这里
 * 按集合 id 逐卡拉一次详情（GET /collections/{id}）并把成员 id 缓存下来：
 * 同一 id 只请求一次、并发不重发；后端将来若在列表里带上 members，则直接采用、不发请求。
 */
export function useCollectionCovers(collections: Ref<CollectionSummary[]>) {
  /** 集合 id → 有序的成员 file_id */
  const memberIds = reactive<Record<number, number[]>>({})
  /** 集合 id → 封面是否仍在拉取（卡片据此显示骨架而不是占位图） */
  const loading = reactive<Record<number, boolean>>({})
  const inFlight = new Set<number>()

  function load(collection: CollectionSummary) {
    const id = collection.id
    if (memberIds[id] || inFlight.has(id)) return

    if (collection.members) {
      memberIds[id] = collection.members.map((m) => m.id)
      return
    }

    inFlight.add(id)
    loading[id] = true
    getCollection(id)
      .then((detail) => {
        memberIds[id] = detail.members.map((m) => m.id)
      })
      .catch(() => {
        // 封面拉取失败不该影响整个列表：留空，卡片回退占位图
        memberIds[id] = []
      })
      .finally(() => {
        inFlight.delete(id)
        loading[id] = false
      })
  }

  watch(collections, (list) => list.forEach(load), { immediate: true })

  return { memberIds, loading }
}
