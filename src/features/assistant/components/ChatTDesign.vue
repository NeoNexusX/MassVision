<template>
  <div class="flex flex-col h-full min-h-0">
    <!-- 上下文徽标 + 清空（放在消息区顶部，归属异步 chat 体） -->
    <ChatToolbar :has-context="hasContext" :message-count="messages.length" @clear="clear" />

    <!-- OPFS 里有更早的完整历史（UI 上限裁掉的部分）→ 手动取回 -->
    <div v-if="earlierAvailable && messages.length > 0" class="shrink-0 px-3 py-1">
      <button
        class="btn btn-ghost btn-xs kawaru-text-68 text-base-content/50 hover:text-primary w-full"
        :disabled="loadingEarlier"
        @click="onLoadEarlier"
      >
        <span v-if="loadingEarlier" class="loading loading-dots loading-xs"></span>
        {{ $t('common.assistant.loadEarlier') }}
      </button>
    </div>

    <!-- Messages：ChatList（layout=both 让 user 右对齐 / assistant 左对齐；
         auto-scroll + 滚动到底按钮由 ChatList 内部处理，滚动交给它） -->
    <div class="flex-1 min-h-0 overflow-hidden">
      <ChatList
        class="h-full"
        layout="both"
        :clear-history="false"
        :show-scroll-button="true"
        :auto-scroll="true"
        default-scroll-to="bottom"
      >
        <template #default>
          <!-- AI Welcome -->
          <div class="px-2 pt-2">
            <ChatItem role="assistant" variant="base" :content="$t('common.assistant.welcome')">
              <template #avatar>
                <AssistantAvatar />
              </template>
            </ChatItem>
          </div>

          <!-- Skill buttons + quick prompts -->
          <QuickPrompts
            v-if="messages.length === 0"
            class="pt-1 pl-11 pb-1"
            :skills="skillButtons"
            :skill-labels="skillLabels"
            :prompts="quickPrompts"
            :labels="quickLabels"
            @ask="askQuick"
            @skill="askQuick"
          />

          <!-- 对话消息（group 供消息内 hover 复制按钮显隐） -->
          <ChatItem
            v-for="m in messages"
            :key="m.id"
            class="group"
            :role="m.role === 'user' ? 'user' : 'assistant'"
            variant="base"
            animation="moving"
            :status="m.error ? 'error' : ''"
            :text-loading="isAssistantTyping(m)"
            :reasoning="m.reasoning ? reasoningPanel(m) : undefined"
            :reasoning-loading="m.reasoningActive"
          >
            <template v-if="m.role === 'assistant'" #avatar>
              <AssistantAvatar />
            </template>

            <template v-if="m.role === 'assistant'" #content>
              <ToolCallCards :message="m" />

              <!-- 正文：TDesign ChatContent（marked + sanitize + 代码高亮/复制） -->
              <ChatContent v-if="m.content" role="assistant" :content="m.content" />
              <span
                v-if="m.pending && m.content"
                class="inline-block w-1.5 h-3.5 bg-primary align-middle animate-pulse ml-0.5"
              ></span>
              <MessageStatus :message="m" @retry="retry" />

              <!-- 思考中但还没开始出正文：显式提示（reasoning 面板头部由 TDesign 渲染） -->
              <div
                v-if="m.reasoningActive && !m.content"
                class="text-base-content/50 kawaru-text-75 flex items-center gap-1"
              >
                <span class="loading loading-dots loading-xs"></span>
                {{ $t('common.assistant.thinking') }}
              </div>
            </template>

            <template v-else #content>
              <div class="kawaru-text-87 whitespace-pre-wrap">{{ m.content }}</div>
              <div v-if="m.content" class="flex justify-end pt-0.5">
                <MessageCopyButton :text="m.content" />
              </div>
            </template>

            <!-- 整条消息复制（actions 区只对 assistant 角色渲染；user 消息的
                 复制按钮在上方 content 槽尾部，见 v-else 分支） -->
            <template v-if="m.role === 'assistant'" #actions>
              <MessageCopyButton v-if="m.content" :text="m.content" />
            </template>
          </ChatItem>
        </template>
      </ChatList>
    </div>

    <!-- Input area：TDesign ChatSender（textarea 自适应 + 发送/停止切换） -->
    <div class="chat-input-area shrink-0 px-3 pb-2 pt-1 border-t border-base-300">
      <ChatSender
        v-model="inputValue"
        :placeholder="$t('common.assistant.placeholder')"
        :loading="streaming"
        :send-btn-disabled="!inputValue.trim()"
        @send="onSend"
        @stop="stop"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, h, watch, onMounted, onUnmounted } from 'vue'
// 按需从子路径导入（避免整包引入 chat-engine/chatbot 等未用模块）
import ChatList from '@tdesign-vue-next/chat/es/chat-list'
import ChatItem from '@tdesign-vue-next/chat/es/chat-item'
import ChatContent from '@tdesign-vue-next/chat/es/chat-content'
import ChatSender from '@tdesign-vue-next/chat/es/chat-sender'
import '@tdesign-vue-next/chat/es/style/index.css'
import 'tdesign-web-components/lib/style/index.css'
import type { TdChatReasoning } from '@tdesign-vue-next/chat/es/type'
import { useI18n } from 'vue-i18n'
import ToolCallCards from './ToolCallCards.vue'
import AssistantAvatar from './shared/AssistantAvatar.vue'
import ChatToolbar from './shared/ChatToolbar.vue'
import QuickPrompts from './shared/QuickPrompts.vue'
import MessageStatus from './shared/MessageStatus.vue'
import MessageCopyButton from './shared/MessageCopyButton.vue'
import { useAssistant } from '../composables/useAssistant'
import { isAssistantTyping } from '../utils/chatItem'
import { useChatThemeMode } from '../composables/useChatThemeMode'
import type { UiChatItem } from '../agenttypes/assistant'

const { t } = useI18n()

const {
  messages,
  streaming,
  hasContext,
  quickPrompts,
  quickLabels,
  skillButtons,
  skillLabels,
  earlierAvailable,
  loadEarlier,
  send: sendMessage,
  stop,
  clear,
  retry,
} = useAssistant()

const loadingEarlier = ref(false)

async function onLoadEarlier() {
  if (loadingEarlier.value) return
  loadingEarlier.value = true
  try {
    await loadEarlier()
  } finally {
    loadingEarlier.value = false
  }
}

const inputValue = ref('')

/**
 * 思考面板（TDesign ChatItem 的 object 形态 reasoning）：
 * header 标题随思考态切换；content 为思考全文（纯文本、灰显）。
 */
function reasoningPanel(m: UiChatItem): TdChatReasoning {
  return {
    expandIconPlacement: 'right',
    collapsePanelProps: {
      header: m.reasoningActive
        ? t('common.assistant.thinking')
        : t('common.assistant.thought'),
      content: h(
        'div',
        {
          class:
            'kawaru-text-75 text-base-content/70 whitespace-pre-wrap break-words max-h-40 overflow-y-auto',
        },
        m.reasoning,
      ),
    },
  }
}

// ---- TDesign 暗色模式同步：其变量挂在 html[theme-mode] 上（引用计数管理） ----
useChatThemeMode()

function askQuick(promptText: string) {
  if (streaming.value) return
  sendMessage(promptText)
}

function onSend(value: string) {
  const text = (value ?? inputValue.value).trim()
  if (!text || streaming.value) return
  inputValue.value = ''
  sendMessage(text)
}
</script>
