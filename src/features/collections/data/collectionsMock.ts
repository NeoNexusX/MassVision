import type {
  Collection,
  CollectionDraft,
  CollectionListResult,
  CollectionSortKey,
} from '../types/collection'

/**
 * Collections 的前端 mock 数据源：设计阶段代替后端 API。
 * 接口形状刻意对齐 listFiles（{ data, meta }），后端就绪后只需把
 * useCollectionsPage 里的 fetchCollections 换成真实请求。
 *
 * ME 是哨兵 owner：fetch 时替换为当前登录用户名，
 * 用于在任意账号下都能演示「所有者可见 Edit」的权限状态。
 */
const ME = '__me__'

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

// 模块级 store：会话内 Create / Edit 的修改在翻页、搜索后仍保留
const collectionsStore: Collection[] = [
  {
    id: 'col-001',
    name: 'Human Kidney MALDI Atlas',
    description:
      'Curated MALDI-MSI atlas of healthy and diseased human kidney sections, spanning cortex, medulla, and papilla annotations.',
    isPublic: true,
    owner: ME,
    updatedAt: '2026-09-05T09:12:00Z',
    datasetCount: 24,
    organisms: ['Human'],
  },
  {
    id: 'col-002',
    name: 'Mouse Brain Lipidomics',
    description:
      'Negative-ion MALDI lipid maps of mouse brain coronal sections with annotated hippocampus and cortex ROIs.',
    isPublic: true,
    owner: 'mchen',
    updatedAt: '2026-09-04T16:40:00Z',
    datasetCount: 12,
    organisms: ['Mouse'],
  },
  {
    id: 'col-003',
    name: 'Rat Liver Toxicology Screening',
    description:
      'Dose-response imaging cohort for hepatotoxicity candidate compounds. Week-4 necropsy sections, three dose groups plus vehicle control.',
    isPublic: false,
    owner: ME,
    updatedAt: '2026-09-03T11:05:00Z',
    datasetCount: 8,
    organisms: ['Rat'],
  },
  {
    id: 'col-004',
    name: 'Plant Metabolite Reference Set',
    description:
      'Cross-species reference spectra for primary and specialized metabolites in leaf and seed tissues, aligned with LC-MS/MS validation.',
    isPublic: true,
    owner: 's_patel',
    updatedAt: '2026-09-01T08:30:00Z',
    datasetCount: 31,
    organisms: ['A. thaliana', 'Rice', 'Wheat', 'Maize', 'Barley', 'Soybean'],
  },
  {
    id: 'col-005',
    name: 'Microbial Colony DESI Pilot',
    description:
      'Pilot DESI imaging of bacterial colonies grown on agar plates. Protocol and matrix notes included.',
    isPublic: false,
    owner: ME,
    updatedAt: '2026-08-31T14:22:00Z',
    datasetCount: 3,
    organisms: ['E. coli', 'B. subtilis'],
  },
  {
    id: 'col-006',
    name: 'Zebrafish Developmental Atlas',
    description:
      'Whole-body imaging across six developmental stages, from 24 hpf larvae to adult sections, with segmented organ masks.',
    isPublic: true,
    owner: 'tanaka',
    updatedAt: '2026-08-30T10:00:00Z',
    datasetCount: 18,
    organisms: ['Zebrafish'],
  },
  {
    id: 'col-007',
    name: 'Multi-Organ Drug Distribution Study',
    description:
      'Systemic distribution of three lead compounds imaged across organs and time points after oral dosing.',
    isPublic: true,
    owner: 'jzhang',
    updatedAt: '2026-08-29T17:45:00Z',
    datasetCount: 27,
    organisms: ['Mouse', 'Rat', 'Human', 'Pig', 'Dog'],
  },
  {
    id: 'col-008',
    name: 'Clinical Gastric Cohort',
    description:
      'Translucent tissue sections from 44 patients with matched H&E and IHC slides. Access restricted to study collaborators.',
    isPublic: false,
    owner: 'a_kowalski',
    updatedAt: '2026-08-28T13:10:00Z',
    datasetCount: 22,
    organisms: ['Human'],
  },
  {
    id: 'col-009',
    name: 'Melanoma Spatial Proteomics',
    description:
      'Tryptic peptide imaging of melanoma biopsies with pathological annotation of tumor margins and immune infiltration.',
    isPublic: true,
    owner: 'mchen',
    updatedAt: '2026-08-27T09:55:00Z',
    datasetCount: 14,
    organisms: ['Human'],
  },
  {
    id: 'col-010',
    name: 'Brain Tumor Lipid Markers',
    description: 'Glioma grades II–IV resection samples screened for diagnostic lipid signatures.',
    isPublic: true,
    owner: 's_patel',
    updatedAt: '2026-08-26T15:30:00Z',
    datasetCount: 9,
    organisms: ['Human'],
  },
  {
    id: 'col-011',
    name: 'Wheat Grain Imaging',
    description:
      'Longitudinal section imaging of cereal grains for spatial mapping of storage proteins and carbohydrates.',
    isPublic: true,
    owner: 'tanaka',
    updatedAt: '2026-08-25T08:20:00Z',
    datasetCount: 11,
    organisms: ['Wheat', 'Barley', 'Rice'],
  },
  {
    id: 'col-012',
    name: 'Drosophila Development Panel',
    description: 'Embryo to adult imaginal disc imaging; shared with the imaging course as teaching material.',
    isPublic: true,
    owner: 'jzhang',
    updatedAt: '2026-08-24T12:00:00Z',
    datasetCount: 7,
    organisms: ['Drosophila'],
  },
  {
    id: 'col-013',
    name: 'Mouse Embryo Atlas',
    description:
      'E10.5–E14.5 whole-embryo sagittal series with anatomical structure annotation from the limb and heart working groups.',
    isPublic: true,
    owner: 'mchen',
    updatedAt: '2026-08-21T10:40:00Z',
    datasetCount: 16,
    organisms: ['Mouse'],
  },
  {
    id: 'col-014',
    name: 'Kidney Stone Mineral Mapping',
    description: 'Cryo-sectioned renal calculi paired with papillary biopsy imaging from the same patients.',
    isPublic: false,
    owner: ME,
    updatedAt: '2026-08-20T16:15:00Z',
    datasetCount: 2,
    organisms: ['Human'],
  },
  {
    id: 'col-015',
    name: 'Forensic Fingermark Pilot',
    description:
      'Protocol placeholder for fingermark residue imaging. Datasets will be added once sampling begins.',
    isPublic: false,
    owner: ME,
    updatedAt: '2026-08-19T09:00:00Z',
    datasetCount: 0,
    organisms: ['Human'],
  },
  {
    id: 'col-016',
    name: 'Marine Toxin Screening',
    description: 'Shellfish tissue imaging for paralytic and diarrhetic toxin localization in digestive glands.',
    isPublic: true,
    owner: 'a_kowalski',
    updatedAt: '2026-08-18T14:50:00Z',
    datasetCount: 6,
    organisms: ['Mussel', 'Oyster'],
  },
  {
    id: 'col-017',
    name: 'Single-cell MALDI Pilot',
    description: 'On-tissue single-cell resolution pilot; currently a single proof-of-concept acquisition.',
    isPublic: false,
    owner: ME,
    updatedAt: '2026-08-17T11:35:00Z',
    datasetCount: 1,
    organisms: ['Human'],
  },
  {
    id: 'col-018',
    name: 'Pan-Cancer N-glycan Atlas',
    description:
      'N-glycan imaging across eight tumor types from the multi-center consortium, harmonized acquisition protocols.',
    isPublic: true,
    owner: 's_patel',
    updatedAt: '2026-08-14T10:05:00Z',
    datasetCount: 36,
    organisms: ['Human'],
  },
  {
    id: 'col-019',
    name: 'Liver Fibrosis Staging Cohort',
    description: 'Staged fibrosis sections (F0–F4) from human biopsy and the matching mouse CCl4 model time course.',
    isPublic: true,
    owner: 'jzhang',
    updatedAt: '2026-08-13T15:20:00Z',
    datasetCount: 19,
    organisms: ['Human', 'Mouse'],
  },
  {
    id: 'col-020',
    name: 'Plant Stress Response Study',
    description: 'Drought and salt stress time-course imaging of rosette leaves at 0, 6, 24, and 48 hours.',
    isPublic: true,
    owner: 'tanaka',
    updatedAt: '2026-08-12T09:45:00Z',
    datasetCount: 13,
    organisms: ['A. thaliana'],
  },
  {
    id: 'col-021',
    name: 'Bone Mineral Imaging',
    description: 'Cortical and trabecular bone sections imaged for mineral distribution and elemental mapping.',
    isPublic: true,
    owner: 'mchen',
    updatedAt: '2026-08-11T13:30:00Z',
    datasetCount: 10,
    organisms: ['Mouse', 'Rat'],
  },
  {
    id: 'col-022',
    name: 'Skin Microbiome Spatial Pilot',
    description: 'Tape-strip and biopsy imaging probing spatial co-localization of skin microbes with sebum lipids.',
    isPublic: true,
    owner: ME,
    updatedAt: '2026-08-08T10:10:00Z',
    datasetCount: 5,
    organisms: ['Human'],
  },
  {
    id: 'col-023',
    name: 'Lung Cancer Biomarker Panel',
    description:
      'Resection cohort imaged for a validated metabolic biomarker panel, with two-year outcome follow-up.',
    isPublic: true,
    owner: 'a_kowalski',
    updatedAt: '2026-08-07T16:00:00Z',
    datasetCount: 21,
    organisms: ['Human'],
  },
  {
    id: 'col-024',
    name: 'Teaching Dataset Bundle',
    description:
      'Annotated example datasets for the annual MSI workshop, covering the main workflows from calibration to segmentation.',
    isPublic: true,
    owner: ME,
    updatedAt: '2026-08-05T08:40:00Z',
    datasetCount: 15,
    organisms: ['Mouse', 'Rat', 'Human', 'Zebrafish', 'E. coli'],
  },
  {
    id: 'col-025',
    name: 'Yeast Culture Timecourse',
    description: 'Batch culture sampling at four growth phases for intracellular lipid droplet imaging.',
    isPublic: false,
    owner: 's_patel',
    updatedAt: '2026-08-03T12:25:00Z',
    datasetCount: 4,
    organisms: ['S. cerevisiae'],
  },
  {
    id: 'col-026',
    name: 'Rat Neuroinflammation Timecourse',
    description: 'LPS-challenge model imaged at 6, 24, and 72 hours to track spatial neuroinflammatory lipid changes.',
    isPublic: false,
    owner: 'jzhang',
    updatedAt: '2026-08-01T09:30:00Z',
    datasetCount: 6,
    organisms: ['Rat'],
  },
]

const SORTERS: Record<CollectionSortKey, (a: Collection, b: Collection) => number> = {
  updated_desc: (a, b) => b.updatedAt.localeCompare(a.updatedAt),
  name_asc: (a, b) => a.name.localeCompare(b.name),
  count_desc: (a, b) => b.datasetCount - a.datasetCount || a.name.localeCompare(b.name),
}

export interface FetchCollectionsParams {
  search?: string
  sort?: CollectionSortKey
  page: number
  size: number
}

/** 列表查询：搜索（名称/简介/Owner/物种）→ 排序 → 分页，带 ~350ms 模拟延迟以展示骨架屏。 */
export async function fetchCollections(
  params: FetchCollectionsParams,
  currentUsername = '',
): Promise<CollectionListResult> {
  await delay(350)

  let rows = collectionsStore.map((c) =>
    c.owner === ME && currentUsername ? { ...c, owner: currentUsername } : c,
  )

  const q = (params.search ?? '').trim().toLowerCase()
  if (q) {
    rows = rows.filter((c) =>
      [c.name, c.description, c.owner, ...c.organisms].some((v) => v.toLowerCase().includes(q)),
    )
  }

  rows.sort(SORTERS[params.sort ?? 'updated_desc'])

  const totalRecords = rows.length
  const totalPages = Math.max(1, Math.ceil(totalRecords / params.size))
  const page = Math.min(Math.max(1, params.page), totalPages)
  const start = (page - 1) * params.size

  return {
    data: rows.slice(start, start + params.size),
    meta: { current_page: page, total_pages: totalPages, total_records: totalRecords },
  }
}

/** 新建集合（会话内生效），返回带 id 的完整对象。datasetCount/organisms
 *  由成员 id 列表派生（真实后端会按 dataset_ids 自行汇总）。 */
export function addCollection(draft: CollectionDraft, owner: string): Collection {
  const collection: Collection = {
    id: `col-${Date.now()}`,
    name: draft.name,
    description: draft.description,
    isPublic: draft.isPublic,
    owner,
    updatedAt: new Date().toISOString(),
    datasetCount: draft.datasetIds.length,
    organisms: draft.organisms ?? [],
    datasetIds: [...draft.datasetIds],
  }
  collectionsStore.unshift(collection)
  return collection
}

/** 编辑集合（会话内生效），同时刷新更新时间。成员列表不在编辑弹窗的
 *  可改范围内，此处只动元信息字段，datasetIds/datasetCount/organisms 原样保留。 */
export function updateCollection(id: string, draft: CollectionDraft): void {
  const target = collectionsStore.find((c) => c.id === id)
  if (!target) return
  target.name = draft.name
  target.description = draft.description
  target.isPublic = draft.isPublic
  target.updatedAt = new Date().toISOString()
}
