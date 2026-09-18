# Upload Data

Upload paired imzML/ibd files, fill in metadata, and manage your private datasets.

**Author:** Chen Kejiang

**Feedback:** Found a bug or have a suggestion? Open a [GitHub Issue](https://github.com/NeoNexusX/MassVision/issues) or email **jydong@xmu.edu.cn**.

## Upload a Dataset

Click **Upload New Dataset** to open the upload page.

![Upload button](https://official-oss.oss-cn-hongkong.aliyuncs.com/docs/20260908174622409.jpg_view)

![Upload page](https://official-oss.oss-cn-hongkong.aliyuncs.com/docs/20260908174725075.jpg_view)

### 1. Select Files

Click **Choose Files** and select both the `.imzML` and `.ibd` files. They must share the same base filename.

![File picker](https://official-oss.oss-cn-hongkong.aliyuncs.com/docs/20260908175048689.jpg_view)

### 2. Visibility

Choose whether the dataset is **public** (visible to all users) or **private** (only visible to you). Public is selected by default.

![Visibility toggle](https://official-oss.oss-cn-hongkong.aliyuncs.com/docs/20260908175221284.jpg_view)

### 3. Fill in Metadata

Fields marked with \* are required.

![Metadata form](https://official-oss.oss-cn-hongkong.aliyuncs.com/docs/20260908193210320.jpg_view)

#### Acquisition Parameters

| Field | Required | Description | Values |
|---|---|---|---|
| **Polarity** | Yes | Ion polarity | Positive / Negative |
| **Ionisation Source** | Yes | Ionization method | MALDI family, DESI family, or Other (see dynamic fields below) |
| **Analyzer** | Yes | Mass analyzer | Orbitrap Exploris 480/240/120, Q Exactive HF, timsTOF fleX, Orbitrap, etc. |
| **Pixel Size X (μm)** | Yes | Horizontal pixel size | Integer, 1–200 |
| **Pixel Size Y (μm)** | Yes | Vertical pixel size | Integer, 1–200 |
| **Spectrum Mode** | Yes | Spectrum type | profile (continuous) / centroid (peak-picked) |
| **Storage Mode** | Yes | imzML storage mode | continuous / processed |
| **Solvent** | Depends | Solvent composition | Pre-filled "100% Water"; options: Water, ACN, MeOH, Ethanol, IPA, Acetone, etc. |
| **MALDI Matrix** | Depends | Matrix compound | CHCA, DHB, NEDC, Sinapinic acid, 9-AA, Norharmane, DAN, etc. |
| **Matrix Application** | Depends | How matrix was applied | Spraying, Airbrush, Automated sprayer, Sublimation, Spotting, etc. |
| **m/z** | No | Reference m/z for resolution | Number |
| **Resolving Power** | No | Resolution value | Number |

#### Dynamic Fields by Ion Source

Whether Solvent, MALDI Matrix, and Matrix Application are required depends on the selected ion source:

| Ion Source Family | Solvent | Matrix | Matrix Application |
|---|---|---|---|
| MALDI / MALDI-2 / AP-MALDI / AP-SMALDI | Required | Required | Required |
| DESI / nano-DESI / IR-MALDESI | Required | Optional | Optional |
| SIMS / LDI / SALDI / LAESI / Other / (none) | Optional | Optional | Optional |

#### Sample Information

| Field | Required | Description | Example Values |
|---|---|---|---|
| **Organism** | Yes | Species | Human, Mouse, Rat, Zebrafish, Fruit fly, Arabidopsis, etc. |
| **Organism Part** | Yes | Tissue location | Brain, Heart, Liver, Lung, Kidney, Spleen, Pancreas, etc. |
| **Condition** | Yes | Experimental condition | Control, Disease, Cancer, Infection, Drug-treated, Genetic modification, etc. |
| **Sample Stabilization** | Yes | Preservation method | Fresh, Fresh frozen, Snap frozen, FFPE, Fixed (formalin), etc. |
| **Sample Growth Conditions** | No | How sample was grown | In vivo, Ex vivo, In vitro, Cell culture, 2D culture, 3D culture, etc. |
| **Tissue Modification** | No | Tissue pre-processing | None, Sectioned, Cryosectioned, Microdissected, Washed, Digested, Stained, etc. |

## My Datasets

After uploading, your dataset appears under **Datahub > My Datasets**. See [Dataset Overview](./dataset-overview) for how to view details, download, and share.

![My Datasets](https://official-oss.oss-cn-hongkong.aliyuncs.com/docs/20260908203828434.jpg_view)
