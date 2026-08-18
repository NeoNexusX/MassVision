/**
 * 运行时配置（人来编辑的 public/config.json）。
 *
 * - 文件位于 `public/config.json`，构建时原样拷贝到产物根目录；
 *   部署后运维/管理员可直接修改服务器上的该文件，**刷新页面即生效，无需重新构建**。
 * - 应用启动时（main.ts 的 bootstrap）先 `await loadConfig()`，再动态导入并挂载应用，
 *   因此任何模块（含模块顶层）都能安全地通过 `getConfig()` 读取配置。
 * - 注意：与「部署环境/构建工具链」相关的后端地址仍走 env/ 目录的 .env 文件（见 env.ts），不在此文件中。
 */

/** 各类下拉选项表（与表单字段一一对应） */
export interface OptionLists {
  /** 职位 */
  position: string[]
  /** 研究领域 */
  researchField: string[]
  /** 极性 */
  polarity: string[]
  /** 离子源 */
  ionSource: string[]
  /** 分析器 */
  analyzer: string[]
  /** 谱图模式 */
  spectrumMode: string[]
  /** 存储模式 */
  storageMode: string[]
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

// ---- Ion Source 动态字段规则（config.json 的 ionSourceFieldRules） ----

/** 单个字段的规则片段（required 及展示文案） */
interface IonSourceFieldRuleConfig {
  required: boolean
  label: string
  placeholder?: string
}

/** 一个离子源家族的匹配规则 */
interface IonSourceFamilyConfig {
  /** 家族标识（如 "maldi"、"desi"） */
  key: string
  /** 归一化后用于匹配的关键词列表，命中任一即匹配该家族 */
  match: string[]
  /** 覆盖默认 solvent 规则 */
  solvent?: Partial<IonSourceFieldRuleConfig>
  /** 覆盖默认 MALDI Matrix 规则 */
  maldiMatrix?: Partial<IonSourceFieldRuleConfig>
  /** 覆盖默认 MALDI Matrix Application 规则 */
  maldiMatrixApplication?: Partial<IonSourceFieldRuleConfig>
}

/** ionSourceFieldRules 配置块 */
interface IonSourceRulesConfig {
  /** 三个字段的默认规则（所有字段 optional） */
  defaults: {
    solvent: IonSourceFieldRuleConfig
    maldiMatrix: IonSourceFieldRuleConfig
    maldiMatrixApplication: IonSourceFieldRuleConfig
  }
  /** 离子源家族列表，按顺序匹配，先命中先生效 */
  families: IonSourceFamilyConfig[]
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

/**
 * 功能展示项（FeatureScene 联动画廊的「联动单元」：词语 + 图片 + 卡片文案，按数组顺序一一对应）。
 *
 * 悬停画廊里第 i 张图时，左侧卡片同步展示第 i 项的 word/title/desc，实现「图 ↔ 卡片」联动。
 * 字段说明（编辑 config.json 的 features.items 时参考）：
 * - word:  画廊图片上方的词，如 'OPEN' / 'FAST' / 'INTELLIGENT'
 * - title: 左侧卡片标题（可选）
 * - desc:  左侧卡片描述（可选）
 * - image: 图片 URL（可选）；留空则回退到 hero.gallery 中同序号的图，便于先复用 Hero 的配图
 */
export interface FeatureItem {
  /** 画廊图片上方的词，如 'OPEN' */
  word: string
  /** 左侧卡片标题 */
  title?: string
  /** 左侧卡片描述 */
  desc?: string
  /** 图片 URL；留空回退到 hero.gallery 同序号图 */
  image?: string
}

/**
 * 版本时间线项（编辑 config.json 的 timeline 时参考）。
 * - date:     时间节点，如 '2024 Q1'
 * - version:  版本号，如 '1.0' / '2.5'
 * - features: 该版本新增特性列表
 */
export interface TimelineItem {
  /** 时间节点 */
  date: string
  /** 版本号 */
  version: string
  /** 版本更新特性 */
  features: string[]
}

/**
 * 侧边导航栏菜单项（config.json 的 `nav` 块）。
 *
 * 字段说明：
 * - active:        静态总开关（默认 true）。设为 false → 强制不显示，**优先级高于任何动态条件**。
 * - requireAuth:   仅登录用户可见
 * - requireAdmin:  仅管理员可见
 * - requireGuest:  仅未登录访客可见
 *
 * 这些权限字段是「与」关系：必须同时满足；任意一个不满足即不显示。
 * 父级（group）若被过滤掉，其 children 也整体隐藏。
 */
export interface NavVisibility {
  /** 静态总开关；缺省视为 true。设为 false 时强制隐藏，覆盖所有动态条件 */
  active?: boolean
  /** 仅登录用户可见 */
  requireAuth?: boolean
  /** 仅管理员可见 */
  requireAdmin?: boolean
  /** 仅未登录访客可见 */
  requireGuest?: boolean
}

/**
 * 判断一项（nav / fab 均适用）是否应当显示。
 * 静态开关 `active` 优先级最高：显式设为 false 即强制隐藏，不再看动态条件。
 *
 * 不直接依赖 `User` 类型，避免 shared 层反向依赖 features 层。
 */
export function isNavVisible(
  item: NavVisibility,
  ctx: { isAuthenticated: boolean; isAdmin?: boolean },
): boolean {
  if (item.active === false) return false
  if (item.requireAuth && !ctx.isAuthenticated) return false
  if (item.requireGuest && ctx.isAuthenticated) return false
  if (item.requireAdmin && !ctx.isAdmin) return false
  return true
}

/**
 * 过滤导航菜单（navbar 与 drawer 共用同一份规则）：
 * 先按可见性过滤顶层项，再过滤分组的 children；子项被过滤光的分组整组隐藏。
 */
export function filterNavItems(
  items: NavItem[],
  ctx: { isAuthenticated: boolean; isAdmin?: boolean },
): NavItem[] {
  const visible = (i: NavVisibility): boolean => isNavVisible(i, ctx)
  return items
    .filter(visible)
    .map((it) => (it.kind === 'group' ? { ...it, children: it.children.filter(visible) } : it))
    .filter((it) => it.kind !== 'group' || it.children.length > 0)
}

/** 分组下的二级菜单项 */
export interface NavChild extends NavVisibility {
  /** 路由地址 */
  to: string
  /** 图标名（对应 SvgIcon 的 IconType） */
  icon: string
  /** 显示文案 */
  label: string
  /** 是否在新标签页中打开（用 <a target="_blank"> 代替 <router-link>） */
  external?: boolean
}

/** 顶层菜单：普通链接 */
export interface NavLinkItem extends NavVisibility {
  kind: 'link'
  /** 路由地址 */
  to: string
  /** 图标名 */
  icon: string
  /** 显示文案 */
  label: string
  /** 点击后是否关闭抽屉，默认 true（如登录/注册等可设为 false） */
  closeOnClick?: boolean
  /** 是否在新标签页中打开（用 <a target="_blank"> 代替 <router-link>） */
  external?: boolean
}

/** 顶层菜单：可折叠分组 */
export interface NavGroupItem extends NavVisibility {
  kind: 'group'
  /** 图标名 */
  icon: string
  /** 显示文案 */
  label: string
  /** 子菜单 */
  children: NavChild[]
}

export type NavItem = NavLinkItem | NavGroupItem

/** 导航形态：navbar 顶栏 / drawer 左侧抽屉 + 悬浮按钮（FAB）/ none 不渲染任何导航 */
export type NavMode = 'navbar' | 'drawer' | 'none'

/** 登录后账户菜单项：link 跳转路由（navbar 头像下拉与 drawer 菜单尾部都显示）；
 *  action 触发动作（目前仅 logout，仅 navbar 头像下拉显示——drawer 形态的登出由 FAB 承担） */
export interface NavUserLink extends NavChild {
  kind: 'link'
}

export interface NavUserAction extends NavVisibility {
  kind: 'action'
  /** 动作类型 */
  action: 'logout'
  /** 显示文案 */
  label: string
}

export type NavUserItem = NavUserLink | NavUserAction

/** 未登录时的登录/注册入口（仅 navbar 头像下拉显示；drawer 形态不列登录入口） */
export interface NavGuestLink extends NavChild {
  /** navbar 下拉里高亮为主色，缺省普通样式 */
  primary?: boolean
}

/**
 * 统一导航配置（config.json 的 `nav` 块）：一份菜单数据驱动多种形态，
 * 每个页面按 mode + modeByPath 在 navbar / drawer / none 之间选择。
 */
export interface NavConfig {
  /** 全局默认形态；缺省 'drawer' */
  mode?: NavMode
  /** 按路由覆盖形态。key 为路径前缀（'/' 只精确匹配首页，其余按前缀匹配、最长者生效） */
  modeByPath?: Record<string, NavMode>
  /** navbar 形态：是否显示头像左侧的主题切换按钮，缺省 true */
  themeToggle?: boolean
  /** navbar 形态：未登录头像的 tooltip 文案，缺省 'Sign in' */
  guestHint?: string
  /** 导航菜单（两种形态共用）：link / group */
  items: NavItem[]
  /** 登录后的账户入口 */
  userMenu: NavUserItem[]
  /** 未登录时的登录/注册入口 */
  guestLinks: NavGuestLink[]
}

/** 解析某路由应使用的导航形态：modeByPath 最长前缀命中优先，否则回退全局 mode（缺省 'drawer'） */
export function resolveNavMode(path: string): NavMode {
  const nav = getConfig().nav!
  let best: NavMode | undefined
  let bestLen = -1
  for (const [prefix, mode] of Object.entries(nav.modeByPath ?? {})) {
    const hit =
      prefix === '/'
        ? path === '/'
        : path === prefix || path.startsWith(prefix.endsWith('/') ? prefix : `${prefix}/`)
    if (hit && prefix.length > bestLen) {
      bestLen = prefix.length
      best = mode
    }
  }
  return best ?? nav.mode ?? 'drawer'
}

/**
 * 悬浮按钮（NavFab）配置（config.json 的 `fab` 块）。
 *
 * 主按钮（main）只配置两套图标：drawer 收起时显示 `iconClosed`、展开时显示 `iconOpen`；
 * 主按钮本身就是 drawer 的开关（受控于与 NavDrawer 共享的 `open` model），不再额外派发事件。
 *
 * 子项（items）只有两种 kind：
 * - 'link'   : 跳转到 `to` 指定的路由
 * - 'action' : 触发 `action` 指定的事件（如 'toggle-theme'、'toggle-ai'、'logout'）；
 *              其中 'toggle-theme' 的图标由组件根据当前 isDark 自动在 sun/moon 之间切换，
 *              配置里的 `icon` 字段对它会被忽略
 *
 * 每项都支持 NavVisibility 中的 active / requireAuth / requireAdmin / requireGuest 字段。
 */
export interface FabMainConfig {
  /** drawer 关闭时主按钮显示的图标 */
  iconClosed: string
  /** drawer 打开时主按钮显示的图标 */
  iconOpen: string
}

interface FabItemBase extends NavVisibility {
  /** 图标名（'toggle-theme' action 会忽略此字段，改用 sun/moon） */
  icon: string
  /** tooltip 显示文案 */
  label: string
}

export interface FabLinkItem extends FabItemBase {
  kind: 'link'
  /** 跳转的路由地址 */
  to: string
}

/** FAB 上动作型子项支持的动作枚举（与 NavFab 对外 emit 的事件一一对应） */
export type FabActionKind = 'toggle-theme' | 'toggle-ai' | 'logout'

export interface FabActionItem extends FabItemBase {
  kind: 'action'
  /** 动作类型 */
  action: FabActionKind
}

export type FabItem = FabLinkItem | FabActionItem

export interface FabConfig {
  /** 主按钮图标（必填） */
  main: FabMainConfig
  /** 子项列表，按声明顺序从外向内排列 */
  items: FabItem[]
}

/** GitHub 提交（commit）热力图配置（config.json 的 githubHeatmap 块） */
export interface GithubHeatmapConfig {
  /** GitHub 仓库拥有者，如 "BioNet-XMU" */
  owner: string
  /** GitHub 仓库名，如 "MassVision" */
  repo: string
  /** 统计哪个分支的提交，默认 "dev" */
  branch?: string
  /** 统计最近多少天，默认 365 */
  days?: number
  /** 热力图标题；缺省时显示 "{owner}/{repo} Commit Activity" */
  title?: string
  /** 点击标题跳转的仓库页面地址；缺省时标题不可点击 */
  repoUrl?: string
  /** 热力图朝向：'auto'（大屏纵向/小屏横向，默认）| 'horizontal' | 'vertical' */
  orientation?: 'auto' | 'horizontal' | 'vertical'
}

/** Result 页面可独立关闭的功能。缺省时均启用，以兼容旧配置。 */
export interface ResultFeatureConfig {
  compare?: boolean
  annotation?: boolean
}

/**
 * 云端 zarr 读取调优参数（config.json 的 zarr 块），供按部署环境的网络/内存调整。
 * 均可缺省，非法值在 loadConfig 里回退默认。
 */
export interface ZarrConfig {
  /**
   * spectra 组 chunk 缓存上限（LRU，按 chunk 个数计，1 chunk ≈ 1MB，100 ≈ 100MB）。
   * 缓存的价值在跨请求复用：调整区域后重新比较时，重叠部分直接命中，不重新下载。
   */
  spectraChunkCacheSize?: number
  /**
   * spectra 组并发下载窗口（同时在下载/解码的 chunk 数上限）。
   * 1MB chunk 下 ~8 个即可打满常见带宽，16 含裕量；≥1Gbps 链路可到 24-32。
   */
  spectraConcurrency?: number
}

/** config.json 的结构 */
export interface AppConfig {
  /** 应用名称 */
  appName: string
  /** 应用版本号，如 "0.3.0" */
  version?: string
  /** 首屏 Hero 区 */
  hero: {
    /** 轮播展示的标语（每行一句，可含符号，如 "FREE ∞"） */
    taglines: string[]
    /** 悬停画廊：一组图片 URL，横向并排，悬停某张时展开放大；留空则不显示 */
    gallery?: string[]
  }
  /** 功能展示区（FeatureScene 联动画廊）；缺省或为空时该场景回退为占位标题 */
  features?: {
    /** 联动单元列表，按序对应画廊从左到右的图片 */
    items: FeatureItem[]
  }
  /** Result 页面功能开关 */
  resultFeatures?: ResultFeatureConfig
  /** 云端 zarr 读取调优参数；缺省时用内置默认（100MB 缓存 / 16 并发） */
  zarr?: ZarrConfig
  /** 版本时间线；缺省或为空时不显示时间线区域 */
  timeline?: TimelineItem[]
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
  /** GitHub 提交热力图（StatsScene 展示用） */
  githubHeatmap?: GithubHeatmapConfig
  /** 统一导航（navbar / drawer 按路由二选一）；缺省时只渲染空导航骨架 */
  nav?: NavConfig
  /** 悬浮按钮（NavFab）；缺省时 NavFab 不渲染任何子项，但仍渲染主按钮以切换 drawer */
  fab?: FabConfig
  /** 表单下拉选项表 */
  options: OptionLists
  /** Ion Source 动态字段规则 */
  ionSourceFieldRules: IonSourceRulesConfig
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
  _config.hero ??= { taglines: [], gallery: [] }
  _config.features ??= { items: [] }
  _config.resultFeatures ??= { compare: true, annotation: true }
  _config.resultFeatures.compare ??= true
  _config.resultFeatures.annotation ??= true
  _config.zarr ??= {}
  if (!Number.isInteger(_config.zarr.spectraChunkCacheSize) || _config.zarr.spectraChunkCacheSize! < 1) {
    _config.zarr.spectraChunkCacheSize = 100
  }
  if (!Number.isInteger(_config.zarr.spectraConcurrency) || _config.zarr.spectraConcurrency! < 1) {
    _config.zarr.spectraConcurrency = 16
  }
  _config.timeline ??= []
  _config.nav ??= { items: [], userMenu: [], guestLinks: [] }
  _config.fab ??= { main: { iconClosed: 'home', iconOpen: 'close' }, items: [] }
  return _config
}

/** 读取已加载的配置；若在 loadConfig 完成前调用会抛错（属编程错误，用以暴露时序问题）。 */
export function getConfig(): AppConfig {
  if (!_config) {
    throw new Error('App config not loaded yet. Ensure bootstrap awaits loadConfig() before use.')
  }
  return _config
}
