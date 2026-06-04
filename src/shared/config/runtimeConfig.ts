/**
 * 运行时配置（人来编辑的 public/config.json）。
 *
 * - 文件位于 `public/config.json`，构建时原样拷贝到产物根目录；
 *   部署后运维/管理员可直接修改服务器上的该文件，**刷新页面即生效，无需重新构建**。
 * - 应用启动时（main.ts 的 bootstrap）先 `await loadConfig()`，再动态导入并挂载应用，
 *   因此任何模块（含模块顶层）都能安全地通过 `getConfig()` 读取配置。
 * - 注意：与「部署环境/构建工具链」相关的后端地址仍走 .env（见 env.ts），不在此文件中。
 */

/** 各类下拉选项表（与表单字段一一对应） */
export interface OptionLists {
  /** 职位 */
  position: string[]
  /** 研究领域 */
  researchField: string[]
  /** 实验类型 */
  experimentType: string[]
  /** 物种 */
  organism: string[]
  /** 取材部位 */
  organismPart: string[]
  /** 样本状态 / 条件 */
  condition: string[]
  /** 样本培养条件 */
  sampleGrowthCondition: string[]
  /** 样本稳定化处理 */
  sampleStabilization: string[]
  /** 组织修饰 */
  tissueModification: string[]
  /** MALDI 基质 */
  maldiMatrix: string[]
  /** 基质涂布方式 */
  maldiMatrixApplication: string[]
  /** 溶剂 */
  solvent: string[]
}

/**
 * 开发团队成员（数据存于 config.json 的 `team`，非技术同学可直接编辑、刷新即生效）。
 *
 * 字段说明（编辑 config.json 的 team 时参考）：
 * - name:     姓名
 * - role:     职位 / 角色
 * - degree:   学位，如 'Ph.D.' / 'M.Sc.' / 'B.Sc.'（可选，不需要时填 "" 或删除该键）
 * - school:   学校 / 机构（可选）
 * - avatar:   头像 URL（OSS 链接）；留空或加载失败时，卡片自动回退为
 *             「姓名首字母 + 渐变背景」头像
 * - homepage: 个人主页链接；填写后整张卡片可点击跳转（新标签页打开），
 *             留空则卡片不可点击
 */
export interface TeamMember {
  /** 姓名 */
  name: string
  /** 职位 / 角色 */
  role: string
  /** 学位，如 'Ph.D.' / 'M.Sc.' / 'B.Sc.' */
  degree?: string
  /** 学校 / 机构 */
  school?: string
  /** 头像 URL（OSS 链接）；可选 */
  avatar?: string
  /** 个人主页链接；填写后点击卡片跳转 */
  homepage?: string
}

/** config.json 的结构 */
export interface AppConfig {
  /** 应用名称 */
  appName: string
  /** 分页 */
  pagination: {
    /** 列表默认每页条数 */
    defaultPageSize: number
    /** 「每页条数」下拉可选项 */
    pageSizeOptions: number[]
  }
  /** 验证码 */
  verification: {
    /** 发送验证码后的倒计时秒数 */
    countdownSeconds: number
    /** 验证码最大尝试次数 */
    maxAttempts: number
  }
  /** 团队轮播（DeveloperCarousel 自动滚动） */
  carousel: {
    /** 自动逐张步进的间隔（ms）：每隔多久平滑翻过一张卡；设 0 禁用自动播放 */
    interval: number
    /** 滚到末尾后停留多久（ms）再平滑返回开头 */
    endPause: number
  }
  /** 开发团队成员 */
  team: TeamMember[]
  /** 联系方式 */
  contact?: {
    /** 实验室 / 项目官网 */
    website?: string
    /** 主联系邮箱 */
    email?: string
    /** 备用联系邮箱 */
    emailAlt?: string
    /** GitHub 组织主页 */
    github?: string
    /** 微信公众号 / 二维码页面链接 */
    wechat?: string
    /** 学术招募页面链接 */
    recruitment?: string
  }
  /** 表单下拉选项表 */
  options: OptionLists
}

let _config: AppConfig | null = null

/**
 * 加载 config.json。必须在挂载应用、以及导入任何依赖配置的模块之前 await 完成。
 * 加 no-cache 以便修改后刷新即可看到最新值。
 */
export async function loadConfig(): Promise<AppConfig> {
  const url = `${import.meta.env.BASE_URL}config.json`
  const res = await fetch(url, { cache: 'no-cache' })
  if (!res.ok) {
    throw new Error(`Failed to load ${url}: ${res.status} ${res.statusText}`)
  }
  _config = (await res.json()) as AppConfig
  return _config
}

/** 读取已加载的配置；若在 loadConfig 完成前调用会抛错（属编程错误，用以暴露时序问题）。 */
export function getConfig(): AppConfig {
  if (!_config) {
    throw new Error('App config not loaded yet. Ensure bootstrap awaits loadConfig() before use.')
  }
  return _config
}
