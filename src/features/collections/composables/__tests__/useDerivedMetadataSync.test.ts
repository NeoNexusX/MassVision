import { describe, expect, it } from 'vitest'
import { nextTick, reactive, ref } from 'vue'
import { useDerivedMetadataSync } from '../useDerivedMetadataSync'
import { DERIVED_METADATA_KEYS } from '../../utils/deriveCollectionMetadata'
import type { File } from '@/features/datasets/types/dataset'

const file = (over: Partial<File>): File =>
  ({ id: '1', name: '', submitTime: '', submitter: '', status: 'completed', isPublic: true, ...over }) as File

function setup() {
  const files = ref<File[]>([])
  const draft = reactive<Record<string, string[]>>(
    Object.fromEntries(DERIVED_METADATA_KEYS.map((key) => [key, []])),
  )
  const sync = useDerivedMetadataSync(files, draft)
  return { files, draft, ...sync }
}

describe('useDerivedMetadataSync', () => {
  it('leaves derived fields empty before anything is selected', () => {
    const { draft } = setup()

    expect(draft.organism).toEqual([])
  })

  it('fills on selection change and refreshes while the field is untouched', async () => {
    const { files, draft } = setup()

    files.value = [file({ organism: 'Mouse (Mus musculus)', polarity: 'Negative' })]
    await nextTick()

    expect(draft.organism).toEqual(['Mouse (Mus musculus)'])
    expect(draft.polarity).toEqual(['Negative'])

    // 选择变化 → 未接管的字段跟着刷新
    files.value = [
      ...files.value,
      file({ id: '2', organism: 'Human (Homo sapiens)', polarity: 'Negative' }),
    ]
    await nextTick()

    expect(draft.organism).toEqual(['Mouse (Mus musculus)', 'Human (Homo sapiens)'])
    expect(draft.polarity).toEqual(['Negative'])
  })

  it('stops syncing a field as soon as the user edits it', async () => {
    const { files, draft, lockedKeys } = setup()

    files.value = [file({ organism: 'Mouse (Mus musculus)' })]
    await nextTick()

    // 用户手改（表单是 v-model 直写草稿，没有编辑事件）
    draft.organism = ['My own label']

    expect(lockedKeys.value).toContain('organism')

    // 后续选择变化不再覆盖被接管的字段，但其他字段照常同步
    files.value = [file({ organism: 'Rat (Rattus norvegicus)', polarity: 'Positive' })]
    await nextTick()

    expect(draft.organism).toEqual(['My own label'])
    expect(draft.polarity).toEqual(['Positive'])
  })

  // 回归：自动填充本身是程序写草稿，若被误判成手改，字段会在首次预填后立刻锁死
  it('does not lock a field because of its own auto-fill', async () => {
    const { files, draft, lockedKeys } = setup()

    files.value = [file({ organism: 'Mouse (Mus musculus)' })]
    await nextTick()

    expect(draft.organism).toEqual(['Mouse (Mus musculus)'])
    expect(lockedKeys.value).toEqual([])
  })

  it('reset hands the field back to auto-detection', async () => {
    const { files, draft, lockedKeys, resetDerivedField } = setup()

    files.value = [file({ organism: 'Mouse (Mus musculus)' })]
    await nextTick()
    draft.organism = ['My own label']

    resetDerivedField('organism')

    expect(lockedKeys.value).not.toContain('organism')
    expect(draft.organism).toEqual(['Mouse (Mus musculus)'])

    // 解锁后重新跟随选择
    files.value = [file({ organism: 'Rat (Rattus norvegicus)' })]
    await nextTick()

    expect(draft.organism).toEqual(['Rat (Rattus norvegicus)'])
  })
})
