/**
 * cheminfo 系列包的浏览器端类型声明（仅声明项目实际用到的 API）。
 *
 * `isotopic-distribution` 与 `mf-utilities` 的 lib 里有 .d.ts 但 package.json
 * 未声明 types 字段，TS 严格模式下无法解析导入，这里手工补齐用到的面。
 * `peaks-similarity` 自带类型（lib/index.d.ts），无需在此声明。
 */

declare module 'isotopic-distribution' {
  /** 理论同位素峰（fwhm 合并后）：x = m/z（含电荷/电子校正），y = 绝对同位素丰度（Σy≈1） */
  export interface IsotopeDistributionPoint {
    x: number
    y: number
  }

  export interface IsotopicDistributionPart {
    /** 理论包络数组，getDistribution() 调用后填充；按 x 升序 */
    isotopicDistribution?: IsotopeDistributionPoint[]
    /** 单同位素质量（别名 monoisotopicMass） */
    em?: number
  }

  export interface IsotopicDistributionOptions {
    /** 逗号分隔的电离列表，如 '+H, +Na'；缺省 = 不加合（分子式原样） */
    ionizations?: string
    /** 低于该相对高度（对最大峰）的峰被丢弃，默认不过滤 */
    threshold?: number
    /** 最多保留的峰数 */
    limit?: number
    /** 两峰合并阈值（Da），默认 0.01 */
    fwhm?: number
    /** 计算中最大行数，默认 5000 */
    maxLines?: number
    /** 分子式无电荷时是否仍计算，默认 true */
    allowNeutral?: boolean
  }

  export class IsotopicDistribution {
    constructor(value: string, options?: IsotopicDistributionOptions)
    /** 计算并缓存分布；返回所有 part 的总分布对象（内部结构不对外承诺） */
    getDistribution(): unknown
    /** 各电离/组分的 part 列表（isotopicDistribution 在 getDistribution 后可用） */
    getParts(): IsotopicDistributionPart[]
  }
}

declare module 'mf-utilities' {
  /** 电离/加合物描述：mf 如 '+H' / '(-1)H'；em = 加合原子精确质量和；charge = 电荷数 */
  export interface Ionization {
    mf: string
    em: number
    charge: number
    atoms: Record<string, number>
  }

  /** 解析 '+H, +Na' / '-H' / '2+' 风格的电离串；解析失败抛错 */
  export function preprocessIonizations(ionizations: string): Ionization[]
}

declare module 'chemical-elements' {
  export const ELECTRON_MASS: number

  export interface StableIsotopeInfo {
    nominal: number
    mass: number
    abundance: number
  }

  export interface ElementInfo {
    number: number
    symbol: string
    name: string
    mass: number
    monoisotopicMass: number
    isotopes: StableIsotopeInfo[]
  }

  /** 按元素符号索引（'Na' → 钠） */
  export const elementsAndStableIsotopesObject: Record<string, ElementInfo>
}
