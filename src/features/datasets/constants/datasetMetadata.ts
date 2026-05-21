export const EXPERIMENT_TYPES = ['imzML', 'Other']

export const ORGANISMS = [
  'Human (Homo sapiens)',
  'Mouse (Mus musculus)',
  'Rat (Rattus norvegicus)',
  'Zebrafish (Danio rerio)',
  'Fruit fly (Drosophila melanogaster)',
  'Arabidopsis (Arabidopsis thaliana)',
  'E. coli',
  'Yeast (Saccharomyces cerevisiae)',
  'Other',
]

export const ORGANISM_PARTS = [
  'Brain',
  'Heart',
  'Liver',
  'Lung',
  'Kidney',
  'Intestine',
  'Stomach',
  'Skin',
  'Blood',
  'Tumor',
  'Muscle',
  'Bone',
  'Whole organism',
  'Other',
]

export const CONDITIONS = [
  'Healthy / Control',
  'Disease',
  'Cancer',
  'Treated',
  'Untreated',
  'Drug-treated',
  'Infection',
  'Genetic modification',
  'Time-course',
  'Other',
]

export const SAMPLE_GROWTH_CONDITIONS = [
  'In vivo',
  'In vitro',
  'Cell culture',
  '2D culture',
  '3D culture',
  'Organoid',
  'Temperature controlled',
  'Hypoxia',
  'Serum-free',
  'Other',
]

export const SAMPLE_STABILIZATIONS = [
  'Fresh',
  'Fresh frozen',
  'Snap frozen',
  'FFPE (Formalin-fixed paraffin-embedded)',
  'Fixed (formalin)',
  'Ethanol fixed',
  'Dried',
  'Other',
]

export const TISSUE_MODIFICATIONS = [
  'None',
  'Sectioned',
  'Cryosectioned',
  'Microdissected',
  'Washed',
  'Digested',
  'Stained',
  'Enzymatic treatment',
  'Chemical derivatization',
  'Other',
]

export const MALDI_MATRICES = [
  'CHCA (α-Cyano-4-hydroxycinnamic acid)',
  'DHB (2,5-Dihydroxybenzoic acid)',
  'Sinapinic acid',
  '9-AA (9-Aminoacridine)',
  'Norharmane',
  'DAN (1,5-Diaminonaphthalene)',
  'Ionic liquid matrices',
  'Gold nanoparticle',
  'Silver nanoparticle',
  'Other',
]

export const MALDI_MATRIX_APPLICATIONS = [
  'Spraying',
  'Airbrush',
  'Automated sprayer',
  'Sublimation',
  'Spotting',
  'Droplet deposition',
  'Inkjet printing',
  'Other',
]

export const SOLVENTS = [
  'Water',
  'Acetonitrile (ACN)',
  'Methanol (MeOH)',
  'Ethanol',
  'Isopropanol (IPA)',
  'Acetone',
  'Formic acid',
  'Trifluoroacetic acid (TFA)',
  'Ammonium hydroxide',
  'Other',
]

export function createDefaultDatasetFilters() {
  return {
    filename: '',
    experiment_type: '',
    username: '',
    organism: '',
    organism_part: '',
    condition: '',
    sample_stabilization: '',
    tissue_modification: '',
    maldi_matrix: '',
    maldi_matrix_application: '',
    solvent: '',
    status: [] as string[],
  }
}
