/**
 * 助手内部工具：OPFS 存档读取。
 *
 * agentLoop 把超过截断线（TOOL_RESULT_CHARS）的工具结果全文写入
 * utils/opfsStore 的存档区；历史预算吃紧时旧结果被替换为存根
 * （"…[truncated — call read_archived_result(id)]"）。本工具按 id 取回
 * 全文，模型在需要深挖旧数据时自取，不需要时零成本。
 */

import type { Context, Plugin } from 'cordis'
import { defineTool } from './defineTool'
import { readArchive } from '../utils/opfsStore'

export const archiveTools: Plugin.Function<void> = (ctx: Context) => {
  ctx.tools.register(
    defineTool({
      name: 'read_archived_result',
      category: 'system',
      description:
        'Read the full text of a previously truncated tool result from the assistant archive. ' +
        'History truncation stubs mention an archive id — pass it here to recover the complete ' +
        'output (e.g. the untruncated annotation listing or database result).',
      parameters: {
        archiveId: {
          type: 'string',
          required: true,
          description: 'Archive id from the truncation stub (the tool_call_id)',
        },
      },
      async execute(args) {
        const text = await readArchive(args.archiveId!)
        if (text == null) {
          return `No archived result for id "${args.archiveId}" (archive expired, OPFS unavailable, or the id is wrong).`
        }
        return text
      },
    }),
  )
}

// cordis 4：fiber 内访问兄弟服务（ctx.tools）必须声明 inject。
archiveTools.inject = ['tools']
