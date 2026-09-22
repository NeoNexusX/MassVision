# Finding Datasets

Search, filter, and sort public and personal datasets on SpatialXomics.

**Author:** Chen Kejiang

**Feedback:** Found a bug or have a suggestion? Open a [GitHub Issue](https://github.com/NeoNexusX/MassVision/issues) or email **jydong@xmu.edu.cn**.

## Search by Name

### Dataset Naming Convention

Dataset names are generated at upload time from the metadata you entered plus the file hash. For example, `0e75ee_Human_Brain_MALDI_20_Positive`:

| Segment | Meaning | Example |
|---|---|---|
| Identifier | First six characters of the file hash | 0e75ee |
| Organism | Species | Human |
| Organism Part | Tissue or organ | Brain |
| Ion Source | Ionization method | MALDI |
| Pixel Size | Horizontal pixel size (μm) | 20 |
| Polarity | Ion polarity | Positive |

Use any of these segments to search.

![Dataset naming convention](https://official-oss.oss-cn-hongkong.aliyuncs.com/docs/20260908161627268.jpg_view)

### Search Bar

Type a dataset name (or part of it) in the search bar and click **Search**.

![Search bar](https://official-oss.oss-cn-hongkong.aliyuncs.com/docs/20260908162509801.jpg_view)

## Filter

Click **Add filter**, choose your criteria, then click **Apply**.

![Filter panel](https://official-oss.oss-cn-hongkong.aliyuncs.com/docs/20260914193954466.jpg_view)

### Available Filters

| Filter | Type | Example Values |
|---|---|---|
| **Filename** | Text | `0e75ee_Human_Brain_MALDI_20_Positive` |
| **Experiment Type** | Dropdown | imzML, Other |
| **Submitted By** | Text | Submitter's username |
| **Organism** | Dropdown | Human, Mouse, Rat, Zebrafish… |
| **Organism Part** | Dropdown | Brain, Heart, Liver, Tumor, Whole organism… |
| **Condition** | Dropdown | Control, Disease, Cancer, Drug-treated, Genetic modification… |
| **Sample Stabilization** | Dropdown | Fresh, Fresh frozen, Snap frozen, FFPE, Ethanol fixed… |
| **Sample Growth Conditions** | Dropdown | In vivo, Ex vivo, In vitro, Cell culture, Organoid… |
| **Tissue Modification** | Dropdown | None, Cryosectioned, Washed, Stained, Chemical derivatization… |
| **MALDI Matrix** | Dropdown | CHCA, DHB, NEDC, Sinapinic acid, 9-AA… |
| **Matrix Application** | Dropdown | Spraying, Sublimation, Spotting, Inkjet printing… |
| **Solvent** | Dropdown | Water, ACN, MeOH, Ethanol, TFA… |
| **Polarity** | Dropdown | Positive, Negative |
| **Ionisation Source** | Dropdown | MALDI, DESI, SIMS, AP-MALDI, LDI… |
| **Analyzer** | Dropdown | Orbitrap Exploris 480, Q Exactive HF, timsTOF fleX, TOF… |

On **My Datasets** the **Username** filter is not shown — results are always limited to your own uploads. An extra **Username** filter appears only on **Public Datasets**.

## Sort

Click the sort button to the right of the search bar and pick one of four orders:

- **Submission time (newest first)** — default
- **Submission time (oldest first)**
- **File size (largest first)**
- **File size (smallest first)**

![Sort options](https://official-oss.oss-cn-hongkong.aliyuncs.com/docs/20260908162922455.jpg_view)
