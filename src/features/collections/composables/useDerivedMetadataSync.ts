import { computed, ref, watch, type Ref } from 'vue'
import type { File } from '@/features/datasets/types/dataset'
import {
  DERIVED_METADATA_KEYS,
  deriveCollectionMetadata,
  type DerivedMetadataKey,
} from '../utils/deriveCollectionMetadata'

/**
 * 「选中数据集 → 集合元数据 list 字段」的自动预填 + 用户接管。
 *
 * 规则：选中集合变化时就地刷新这些字段；一旦用户手改了某个字段，该字段即被
 * 接管（记入 lockedKeys），之后选择怎么变都不再覆盖它，直到显式 reset。
 *
 * 手改的判定靠比对 autoApplied（最近一次程序写入值）：草稿由表驱动表单直接
 * v-model 绑定，没有逐字段的编辑事件，只能这样区分「程序填的」和「用户改的」。
 */
export function useDerivedMetadataSync(
  files: Ref<readonly File[]>,
  draft: Record<string, string[]>,
) {
  const detected = computed(() => deriveCollectionMetadata(files.value))
  /** 已被用户手改、停止自动同步的字段键 */
  const lockedKeys = ref<string[]>([])
  /** 最近一次程序写入的值，用于区分自动填充和用户手改 */
  const autoApplied = new Map<string, string[]>()

  watch(
    detected,
    (values) => {
      for (const key of DERIVED_METADATA_KEYS) {
        if (lockedKeys.value.includes(key)) continue
        const next = values[key]
        // 先记账再写入：下面的 sync watcher 会在同一次赋值里比对 autoApplied
        autoApplied.set(key, next)
        draft[key] = next
      }
    },
    { immediate: true, deep: true },
  )

  // flush: 'sync' 是必需的——自动填充的赋值发生在同一个 tick 内，
  // 若异步比对，会把程序写入误判成用户手改、导致字段被无故锁定。
  watch(
    () => DERIVED_METADATA_KEYS.map((key) => JSON.stringify(draft[key])).join('|'),
    () => {
      for (const key of DERIVED_METADATA_KEYS) {
        if (lockedKeys.value.includes(key)) continue
        if (JSON.stringify(draft[key]) !== JSON.stringify(autoApplied.get(key) ?? [])) {
          lockedKeys.value = [...lockedKeys.value, key]
        }
      }
    },
    { flush: 'sync' },
  )

  /** 交回自动推导：解锁该字段并立即用当前选中数据集的值重填 */
  function resetDerivedField(key: string) {
    lockedKeys.value = lockedKeys.value.filter((k) => k !== key)
    const next = detected.value[key as DerivedMetadataKey] ?? []
    autoApplied.set(key, next)
    draft[key] = next
  }

  return { detected, lockedKeys, resetDerivedField }
}
