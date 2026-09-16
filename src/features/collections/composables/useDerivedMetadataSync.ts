import { computed, shallowRef, watch, type Ref } from 'vue'
import type { File } from '@/features/datasets/types/dataset'
import {
  DERIVED_METADATA_KEYS,
  deriveCollectionMetadata,
  type DerivedMetadataKey,
} from '../utils/deriveCollectionMetadata'

/** 两个取值列表是否等价：忽略顺序与大小写（TagInput 本身也按忽略大小写去重） */
function sameValues(a: readonly string[] = [], b: readonly string[] = []): boolean {
  const normalize = (list: readonly string[]) =>
    [...new Set(list.map((v) => String(v).trim().toLowerCase()))].sort()
  return JSON.stringify(normalize(a)) === JSON.stringify(normalize(b))
}

/**
 * 「选中数据集 → 集合元数据 list 字段」的自动预填 + 用户接管。
 *
 * 判定规则：字段值与当前识别值等价 = 未手改（跟随选择自动刷新）；不等价 = 已手改
 * （记入 lockedKeys，选择再怎么变都不覆盖）。所以改回识别值、只调顺序，或选择变化后
 * 识别值恰好等于手填值，都会自动解除接管；reset 就是把识别值写回去。
 *
 * 草稿由表驱动表单直接 v-model 绑定，没有逐字段的编辑事件，只能监听草稿变化来判定；
 * 程序写入期间（applying）暂停判定——逐字段写入时，尚未写到的字段与新识别值不一致，
 * 若照常判定会被误锁。
 */
export function useDerivedMetadataSync(
  files: Ref<readonly File[]>,
  draft: Record<string, string[]>,
) {
  const detected = computed(() => deriveCollectionMetadata(files.value))
  /** 与识别值不一致、停止自动同步的字段键 */
  const lockedKeys = shallowRef<string[]>([])
  let applying = false

  function setLocked(key: string, locked: boolean) {
    const has = lockedKeys.value.includes(key)
    if (locked && !has) lockedKeys.value = [...lockedKeys.value, key]
    else if (!locked && has) lockedKeys.value = lockedKeys.value.filter((k) => k !== key)
  }

  watch(
    detected,
    (values) => {
      applying = true
      try {
        for (const key of DERIVED_METADATA_KEYS) {
          // 不共享识别结果数组：草稿是可编辑的，原地修改不能反向污染 detected 快照。
          if (!lockedKeys.value.includes(key)) draft[key] = [...values[key]]
          else if (sameValues(draft[key], values[key])) setLocked(key, false)
        }
      } finally {
        applying = false
      }
    },
    { immediate: true, deep: true },
  )

  // flush: 'sync' 是必需的——applying 标记只在自动填充的同步调用期间有效，
  // 异步判定时标记早已复位，会把程序写入误判成用户手改。
  watch(
    () => DERIVED_METADATA_KEYS.map((key) => JSON.stringify(draft[key])).join('|'),
    () => {
      if (applying) return
      for (const key of DERIVED_METADATA_KEYS) {
        setLocked(key, !sameValues(draft[key], detected.value[key]))
      }
    },
    { flush: 'sync' },
  )

  /**
   * 供界面提示「已手动修改 / 恢复为自动识别值」的字段键。
   * 还没选数据集时没有可识别的来源，恢复只会清空用户刚填的内容，所以不提示；
   * 但锁仍然生效，之后选了数据集也不会覆盖用户先填的值。
   */
  const editedKeys = computed(() => (files.value.length ? lockedKeys.value : []))

  /** 交回自动推导：用当前识别值重填（与识别值一致即解锁） */
  function resetDerivedField(key: string) {
    draft[key] = [...(detected.value[key as DerivedMetadataKey] ?? [])]
    setLocked(key, false)
  }

  return { detected, lockedKeys, editedKeys, resetDerivedField }
}
