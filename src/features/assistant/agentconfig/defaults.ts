/**
 * assistant 模块的默认常量（token 预算、步数上限、历史条数等）。
 *
 * 与人类可编辑的运行时配置（public/config.json 的 llm 块）和部署环境变量
 * （env/ 的 VITE_LLM_*）职责不同：这里是「写死在代码里的工程常量」。
 */

/** localStorage 中保留的最近对话条数（不含 system/context）。
 *  完整历史（含工具调用/推理）持久化在 OPFS（utils/opfsStore.ts）。 */
export const MAX_HISTORY_MESSAGES = 20

/** 内存/UI 中保留的最大消息条数；更早的仍在 OPFS 会话文件中（loadEarlier 取回） */
export const MAX_UI_MESSAGES = 100

/** 回喂模型的历史字符预算：超出后从最旧开始把超长 tool 结果替换为
 *  OPFS 存根（read_archived_result 可取回全文） */
export const HISTORY_CHAR_BUDGET = 60_000

/** 单 turn 内 LLM step 上限（防工具回环死循环） */
export const MAX_AGENT_STEPS = 8

/** 单步空流（连接成功但无任何实质增量）的自动重试次数 */
export const MAX_EMPTY_STREAM_RETRIES = 2

/** 单个工具返回文本的最大字符数（超出截断） */
export const TOOL_RESULT_CHARS = 2000

/** 历史字符预算吃紧时，超长 tool 结果压缩成存根保留的前缀字符数；
 *  压缩前全文写入 OPFS 存档（read_archived_result 按 tool_call_id 取回） */
export const TOOL_STUB_KEEP = 500

/** 工具执行超时（ms） */
export const TOOL_TIMEOUT_MS = 15000

/** 大矩阵统计采样像素数（等距抽样后排序取分位数） */
export const STATS_SAMPLE_PIXELS = 10000

/** 平均谱 / 注释默认返回的 top 条目数 */
export const DEFAULT_TOP_N = 10
/** topN 参数上限 */
export const MAX_TOP_N = 20
