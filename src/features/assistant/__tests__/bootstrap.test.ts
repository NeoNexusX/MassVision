import { describe, expect, it } from 'vitest'
import { Context } from 'cordis'
import { llmProvider } from '../providers/llm'
import { toolsProvider } from '../providers/tools'
import { skillsProvider } from '../providers/skills'
import { frontendContextTools } from '../tools/frontendContextTools'
import { backendApiTools } from '../tools/backendApiTools'
import { knowledgeTools } from '../tools/knowledgeTools'
import { bioTools } from '../tools/bioTools'
import { spectralTools } from '../tools/spectralTools'
import { literatureTools } from '../tools/literatureTools'
import { archiveTools } from '../tools/archiveTools'

/**
 * 生产接线回归测试：完整复刻 plugins/index.ts 的加载方式（不 await，
 * 与浏览器里的真实调用一致）。
 *
 * 背景：cordis 4 的属性解析要求 fiber 内声明过 inject 才能访问兄弟服务，
 * 否则插件 fiber **静默失败**（不抛错、无日志）——工具一个都注册不上。
 * agentLoop.test.ts 只从根 context 注册测试工具（根上下文不受 inject 限制），
 * 检测不到这条路径；工具插件曾因此全员失效而测试全绿。
 */
describe('assistant bootstrap (production wiring)', () => {
  it('registers all tools when plugins load the way the browser loads them', async () => {
    const ctx = new Context()
    ctx.plugin(llmProvider)
    ctx.plugin(toolsProvider)
    ctx.plugin(skillsProvider)
    ctx.plugin(frontendContextTools)
    ctx.plugin(backendApiTools)
    ctx.plugin(knowledgeTools)
    ctx.plugin(bioTools)
    ctx.plugin(spectralTools)
    ctx.plugin(literatureTools)
    ctx.plugin(archiveTools)
    // 注意：全部不 await——静默失败的 fiber 只有这条路径能暴露

    // 等待 fiber 激活链（微任务级联 + 一个宏任务兜底）完成
    await new Promise((r) => setTimeout(r, 10))

    const names = ctx.tools.schemas().map((s) => s.name)
    // 七个工具插件各自的代表性成员（9+1 + 5 + 5 + 2 + 1 + 3 + 1 = 27 个）。
    // read_archived_result 必须在列：agentLoop 持续往历史里写"call
    // read_archived_result(id)"存根，该工具一旦静默失效，被截断的结果就
    // 永远取不回（且无其他测试加载 archiveTools）
    expect(names).toContain('get_page_state')
    expect(names).toContain('get_annotation_detail')
    expect(names).toContain('skill')
    expect(names).toContain('list_files')
    expect(names).toContain('get_user_quota')
    expect(names).toContain('pubmed_search')
    expect(names).toContain('europepmc_search')
    expect(names).toContain('library_mass_search')
    expect(names).toContain('hmdb_lookup')
    expect(names).toContain('kegg_pathway_lookup')
    expect(names).toContain('spectral_library_search')
    expect(names).toContain('read_archived_result')
    expect(names.length).toBeGreaterThanOrEqual(19)
  })

  it('exposes the bundled skills catalog without waiting for a first skill load', async () => {
    const ctx = new Context()
    ctx.plugin(skillsProvider)
    await new Promise((r) => setTimeout(r, 10))

    // 目录必须在无任何前置 load() 的情况下就绪：系统提示的
    // "Available Skills" 段依赖 catalog()，懒加载 + 无启动初始化 = 永远为空
    const catalog = ctx.skills.catalog()
    expect(catalog.map((s) => s.name)).toEqual(
      expect.arrayContaining(['msi-analysis', 'ion-image-interpretation']),
    )
  })
})
