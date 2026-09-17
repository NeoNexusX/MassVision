# Dataset Overview

Inspect dataset metadata, download raw files, and share public links.

**Author:** Chen Kejiang

**Feedback:** Found a bug or have a suggestion? Open a [GitHub Issue](https://github.com/NeoNexusX/MassVision/issues) or email **jydong@xmu.edu.cn**.

## Open the Detail Page

Click any dataset row to open its detail page.

![Click dataset](https://official-oss.oss-cn-hongkong.aliyuncs.com/docs/20260908164356724.jpg_view)

## Metadata Sections

The detail page is organized into three sections.

![Detail page overview](https://official-oss.oss-cn-hongkong.aliyuncs.com/docs/20260908164615849.jpg_view)

### Biological & Sample Info

![Biological info](https://official-oss.oss-cn-hongkong.aliyuncs.com/docs/20260914194520307.jpg_view)

| Field | Example | Meaning |
|---|---|---|
| **Organism** | Mouse (mus musculus) | Species |
| **Organism Part** | Brain | Tissue or organ |
| **Condition** | Control | Experimental condition (e.g., untreated vs. disease) |
| **Growth Conditions** | — | How the sample was grown (often blank) |
| **Stabilization** | FFPE | Preservation method (formalin-fixed paraffin-embedded) |
| **Tissue Modification** | — | Pre-processing applied to the tissue (often blank) |

### MSI Analysis Settings

![MSI settings](https://official-oss.oss-cn-hongkong.aliyuncs.com/docs/20260914194545854.jpg_view)

| Field | Example | Meaning |
|---|---|---|
| **Polarity** | Positive | Ion polarity mode |
| **Ionisation Source** | MALDI | Ionization method (Matrix-Assisted Laser Desorption/Ionization) |
| **Analyzer** | Orbitrap | Mass analyzer type |
| **Pixel Size** | 30 × 30 μm | Spatial resolution |
| **Resolving Power** | at m/z 0, 0 | Shows `at m/z 0, 0` when not provided—this is normal |
| **Matrix** | DHB | Matrix compound (2,5-Dihydroxybenzoic acid) |
| **Matrix Application** | Spraying | How the matrix was applied |
| **Solvent** | 100% Water | Solvent composition |

### File Information

![File info](https://official-oss.oss-cn-hongkong.aliyuncs.com/docs/20260914194608330.jpg_view)

| Field | Example | Meaning |
|---|---|---|
| **File Type** | zip | Archive format |
| **Experiment** | imzML | Data format |
| **Size** | 259.7 MB | File size |
| **Spectrum Mode** | centroid | Centroid (peak-picked) or profile (continuous) |
| **Storage Mode** | continuous | How spectra are stored in the file |
| **MD5 Hash** | 7d5b0c… | File checksum (truncated) |
| **Submitted By** | dre | Uploader's username |

## Download

Two ways to download the raw .imzML/.ibd pair:

**Option 1:** Click **Download** on the dataset row in any list view.

![Download from list](https://official-oss.oss-cn-hongkong.aliyuncs.com/docs/20260908170252957.jpg_view)

**Option 2:** Click **Download** on the detail page.

![Download from detail](https://official-oss.oss-cn-hongkong.aliyuncs.com/docs/20260914195006583.jpg_view)

## Share

To share a dataset, open its detail page and click **Share** to copy the public link.

![Share button](https://official-oss.oss-cn-hongkong.aliyuncs.com/docs/20260914195044165.jpg_view)
