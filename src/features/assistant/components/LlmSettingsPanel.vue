<template>
  <div class="flex flex-col h-full min-h-0">
    <!-- 标题行 -->
    <div class="flex items-center justify-between px-3 pt-3 shrink-0">
      <span class="font-semibold kawaru-text-87 text-base-content">{{
        t('common.assistant.settings.title')
      }}</span>
      <button
        class="btn btn-xs btn-ghost btn-square"
        :title="t('common.action.close')"
        @click="emit('done')"
      >
        <svg-icon type="close" class="w-3 h-3" />
      </button>
    </div>

    <!-- 当前凭据来源徽标 / 未配置告警 -->
    <div class="px-3 pt-2 shrink-0">
      <span v-if="hasCustom" class="badge badge-primary badge-sm gap-1 kawaru-text-50">
        <span class="w-1.5 h-1.5 rounded-full bg-primary-content"></span>
        {{ t('common.assistant.settings.usingCustom') }}
      </span>
      <span v-else-if="hasEnvDefault" class="badge badge-ghost badge-sm kawaru-text-50">
        {{ t('common.assistant.settings.usingDefault') }}
      </span>
      <div v-else class="alert alert-warning py-1.5 px-2.5 kawaru-text-75">
        {{ t('common.assistant.settings.notConfigured') }}
      </div>
    </div>

    <!-- 表单 -->
    <div class="flex-1 overflow-y-auto px-3 py-3 space-y-3">
      <p class="kawaru-text-75 text-base-content/60 leading-relaxed">
        {{ t('common.assistant.settings.hint') }}
      </p>

      <label class="form-control">
        <div class="label py-1">
          <span class="label-text kawaru-text-75">{{ t('common.assistant.settings.provider') }}</span>
        </div>
        <select v-model="form.provider" class="select select-sm select-bordered w-full kawaru-text-87">
          <option value="openai">{{ t('common.assistant.settings.providerOpenAi') }}</option>
          <option value="anthropic">{{ t('common.assistant.settings.providerAnthropic') }}</option>
        </select>
      </label>

      <label class="form-control">
        <div class="label py-1">
          <span class="label-text kawaru-text-75">{{ t('common.assistant.settings.baseUrl') }}</span>
        </div>
        <input
          v-model="form.baseUrl"
          type="text"
          class="input input-sm input-bordered w-full kawaru-text-87"
          :placeholder="baseUrlPlaceholder"
        />
      </label>

      <label class="form-control">
        <div class="label py-1">
          <span class="label-text kawaru-text-75">{{ t('common.assistant.settings.apiKey') }}</span>
        </div>
        <input
          v-model="form.apiKey"
          type="password"
          autocomplete="off"
          class="input input-sm input-bordered w-full kawaru-text-87"
          :placeholder="t('common.assistant.settings.apiKeyPlaceholder')"
        />
      </label>

      <label class="form-control">
        <div class="label py-1">
          <span class="label-text kawaru-text-75">{{ t('common.assistant.settings.model') }}</span>
        </div>
        <input
          v-model="form.model"
          type="text"
          class="input input-sm input-bordered w-full kawaru-text-87"
          :placeholder="modelPlaceholder"
        />
      </label>

      <p class="kawaru-text-75 text-base-content/50 leading-relaxed">
        {{ t('common.assistant.settings.corsNote') }}
      </p>

      <!-- 测试结果 -->
      <div v-if="testing" class="flex items-center gap-2 kawaru-text-75 text-base-content/60">
        <span class="loading loading-spinner loading-xs"></span>
        {{ t('common.assistant.settings.testing') }}
      </div>
      <div v-else-if="testResult === ''" class="kawaru-text-75 text-success flex items-center gap-1">
        <svg-icon type="success" class="w-3.5 h-3.5" />
        {{ t('common.assistant.settings.testOk') }}
      </div>
      <div
        v-else-if="testResult"
        class="kawaru-text-75 text-error break-all border border-error/30 bg-error/10 rounded-lg p-2"
      >
        {{ testResult }}
      </div>
    </div>

    <!-- 底部按钮 -->
    <div class="shrink-0 px-3 py-2 border-t border-base-300 flex items-center gap-2">
      <button
        class="btn btn-xs btn-outline"
        :disabled="testing || !form.baseUrl.trim() || !form.apiKey.trim()"
        @click="onTest"
      >
        <svg-icon v-if="!testing" type="bolt" class="w-3 h-3" />
        {{ t('common.assistant.settings.test') }}
      </button>
      <div class="flex-1"></div>
      <button
        v-if="hasCustom"
        class="btn btn-xs btn-ghost text-error"
        :title="t('common.assistant.settings.clearConfirm')"
        @click="onClear"
      >
        {{ clearArmed ? '✓' : '' }}
        {{ t('common.action.clear') }}
      </button>
      <button class="btn btn-xs btn-primary text-primary-content" @click="onSave">
        {{ t('common.action.save') }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * BYOK 设置面板：用户自配 接口类型 / API 地址 / 密钥 / 模型
 * （openai = OpenAI 兼容端点；anthropic = Claude 原生 /v1/messages）。
 * 悬浮窗容器层组件——五套聊天框架视图共用，不随框架切换重写。
 * 保存的值经 useLlmSettings → userLlmConfig 落 localStorage；
 * 实际请求时的解析优先级见两个适配器（openaiAdapter / anthropicAdapter）的注释。
 */
import { computed, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useLlmSettings, testLlmConnection } from '../composables/useLlmSettings'

const emit = defineEmits<{ (e: 'done'): void }>()
const { t } = useI18n()
const { config, hasCustom, hasEnvDefault, save, clear } = useLlmSettings()

// 打开面板时以已保存值为初值（保存/清除后同步回来）
const form = reactive({
  provider: config.value.provider,
  baseUrl: config.value.baseUrl,
  apiKey: config.value.apiKey,
  model: config.value.model,
})

// 占位符随接口类型切换（openai: deepseek 示例；anthropic: 官方端点/模型）
const baseUrlPlaceholder = computed(() =>
  form.provider === 'anthropic'
    ? t('common.assistant.settings.baseUrlPlaceholderAnthropic')
    : t('common.assistant.settings.baseUrlPlaceholder'),
)
const modelPlaceholder = computed(() =>
  form.provider === 'anthropic'
    ? t('common.assistant.settings.modelPlaceholderAnthropic')
    : t('common.assistant.settings.modelPlaceholder'),
)

const testing = ref(false)
/** '' = 成功；null = 未测试；其他 = 错误信息 */
const testResult = ref<string | null>(null)
/** 清除按钮两段式确认（首次点击亮起，3 秒内再点才执行） */
const clearArmed = ref(false)
let clearTimer: ReturnType<typeof setTimeout> | undefined

function onTest(): void {
  testing.value = true
  testResult.value = null
  testLlmConnection({ ...form })
    .then((err) => (testResult.value = err ?? ''))
    .finally(() => (testing.value = false))
}

function onSave(): void {
  save({ ...form })
  emit('done')
}

function onClear(): void {
  if (!clearArmed.value) {
    clearArmed.value = true
    clearTimeout(clearTimer)
    clearTimer = setTimeout(() => (clearArmed.value = false), 3000)
    return
  }
  clearTimeout(clearTimer)
  clearArmed.value = false
  clear()
  form.provider = 'openai'
  form.baseUrl = ''
  form.apiKey = ''
  form.model = ''
  testResult.value = null
}
</script>
