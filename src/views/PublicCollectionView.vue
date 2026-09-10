<template>
  <div class="min-h-screen bg-base-200">
    <div class="max-w-[1680px] mx-auto p-4 md:p-8 page-type">
      <!-- Loading -->
      <div v-if="loading" class="animate-pulse flex flex-col gap-6">
        <div class="h-16 bg-base-100 dark:bg-slate-800 rounded-xl border border-base-300"></div>
        <div class="h-40 bg-base-100 dark:bg-slate-800 rounded-xl border border-base-300"></div>
        <div class="h-64 bg-base-100 dark:bg-slate-800 rounded-xl border border-base-300"></div>
      </div>

      <!-- 错误态：链接无效 / 集合不存在（后端对非公开集合也返回 404，不暴露存在性） -->
      <div
        v-else-if="error"
        class="p-12 bg-base-100 dark:bg-slate-800 rounded-xl border border-base-300 text-center"
      >
        <SvgIcon type="circle_stack" class="h-12 w-12 mx-auto text-base-content/30 mb-4" />
        <h3 class="text-[1.15em] font-bold text-base-content">Collection not found</h3>
        <p class="mt-2 text-base-content/60">
          This collection does not exist or is no longer public.
        </p>
        <router-link to="/" class="btn btn-primary mt-6 text-[1em]">Back to Home</router-link>
      </div>

      <template v-else-if="detail">
        <!-- 页头：公开标识 + 名称/标题 + 所有者 -->
        <div class="mb-6">
          <span
            class="inline-flex items-center gap-1.5 badge badge-sm font-medium
              border border-success/30 bg-success/10 text-success mb-2"
          >
            <SvgIcon type="region" class="w-[0.9em] h-[0.9em]" />
            Public Collection
          </span>
          <h1 class="page-title font-bold text-base-content truncate" :title="detail.name">
            {{ detail.name }}
          </h1>
          <p v-if="detail.title" class="text-base-content/70 mt-0.5 truncate">
            {{ detail.title }}
          </p>
        </div>

        <!-- 统计条 -->
        <div
          class="flex flex-wrap items-center gap-x-6 gap-y-2 bg-base-100 dark:bg-slate-800
            rounded-xl shadow-sm border border-base-300 px-4 py-3 mb-6
            text-[0.9em] text-base-content/70"
        >
          <span class="inline-flex items-center gap-1.5">
            <SvgIcon type="queue_list" class="w-[1.1em] h-[1.1em]" />
            <span class="font-semibold text-base-content">{{ detail.memberCount }}</span>
            {{ detail.memberCount === 1 ? 'dataset' : 'datasets' }}
          </span>
          <span class="inline-flex items-center gap-1.5">
            <SvgIcon type="folder" class="w-[1.1em] h-[1.1em]" />
            {{ formatBytes(detail.totalSize) }}
          </span>
          <span class="inline-flex items-center gap-1.5" :title="`Owner: ${detail.ownerUsername}`">
            <SvgIcon type="user" class="w-[1.1em] h-[1.1em]" />
            {{ detail.ownerUsername }}
          </span>
          <span v-if="updatedDate" class="ml-auto whitespace-nowrap">
            Updated {{ updatedDate }}
          </span>
        </div>

        <CollectionMetadataPanel :metadata="detail.metadata" />

        <!-- 成员列表：只读模式（无选择/拖拽/管理工具条） -->
        <CollectionMemberList
          class="mt-6"
          :members="detail.members"
          :manage-mode="false"
          @download="downloadMember"
        />
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import CollectionMetadataPanel from '@/features/collections/components/CollectionMetadataPanel.vue'
import CollectionMemberList from '@/features/collections/components/CollectionMemberList.vue'
import { collectionErrorMessage, getPublicCollection } from '@/features/collections/api/collectionApi'
import type { CollectionDetail, CollectionMember } from '@/features/collections/types/collection'
import { useDownloadProgress } from '@/features/datasets/composables/useDownloadProgress'
import { formatBytes } from '@/shared/utils/format'

const route = useRoute()

const detail = ref<CollectionDetail | null>(null)
const loading = ref(false)
const error = ref('')

const publicId = computed(() => String(route.params.publicId))

async function fetch() {
  loading.value = true
  error.value = ''
  try {
    detail.value = await getPublicCollection(publicId.value)
  } catch (err: any) {
    error.value = collectionErrorMessage(err, 'Collection not found')
  } finally {
    loading.value = false
  }
}

const updatedDate = computed(() =>
  detail.value?.updatedAt ? new Date(detail.value.updatedAt).toLocaleDateString() : '',
)

// 公开页下载走 noauth 端点（后端仅对 is_public 文件放行）
const { handleDownloadPublicRaw } = useDownloadProgress()

function downloadMember(member: CollectionMember) {
  handleDownloadPublicRaw(String(member.id))
}

watch(publicId, fetch)
onMounted(fetch)
</script>

<style scoped>
/* Layout handled by Tailwind classes */
</style>
