# Data Visualization

Explore ion images, TIC plots, and spectra interactively. Covers UMAP/KMeans clustering, ROI selection, region comparison, and annotation matching.

**Author:** Chen Kejiang

**Feedback:** Found a bug or have a suggestion? Open a [GitHub Issue](https://github.com/NeoNexusX/MassVision/issues) or email **jydong@xmu.edu.cn**.

## Dataset Status

Dataset cards show one of two actions:

| Action | Meaning |
|---|---|
| **Explore** | No preprocessed result exists yet. Click **Explore**, then **Generate** to create a direct-conversion task. |
| **Visualize** | A preprocessed result is ready. Click to open the visualization page. |

When you click **Explore > Generate**, the platform creates a task and redirects you to the [Workspace](./workspace) to track progress.

![Explore button](https://official-oss.oss-cn-hongkong.aliyuncs.com/docs/20260909211924161.jpg_view)

![Generate dialog](https://official-oss.oss-cn-hongkong.aliyuncs.com/docs/20260909212549240.jpg_view)

## Page Layout

The visualization page has five main areas:

![Page layout](https://official-oss.oss-cn-hongkong.aliyuncs.com/docs/20260911150203309.jpg_view)

1. **Ion intensity image** (center) — spatial heatmap of the selected m/z
2. **Pixel spectrum** (bottom) — mean spectrum or per-pixel spectrum
3. **Region comparison** (bottom panel) — compare two regions side by side
4. **Info & controls** (right sidebar) — metadata, display settings, clustering, ROIs
5. **Annotation panel** (left rail) — CSV-based annotation matching

## Right Sidebar Controls

### Info

Shows dataset metadata: Polarity, Analyzer, Ionisation Source, Pixel Size, Spectrum Mode, Storage Mode.

### Display Range

- Enter Min/Max values directly.
- The current values are shown as percentiles (e.g., "95.23%").

### Statistic

- **Intensity histogram** — visualizes the intensity distribution; red lines mark the current Min/Max.
- **Dimensions** — image size (e.g., 100 × 80).
- **Non-zero** — number of pixels with non-zero intensity.
- **TIC** — total ion current.

### Preprocessing

Lists the processing methods applied to this result (e.g., "Direct conversion (no preprocessing)").

### Visualization Controls

| Control | Description |
|---|---|
| **Gamma** | Brightness/contrast curve. Range 0.5–1.5, default 1.0. |
| **Enable UMAP/KMeans** | First use requires confirmation; triggers a backend UMAP task. |
| **UMAP** | Overlay showing UMAP dimensionality reduction. |
| **KMeans** | Run KMeans on the UMAP embedding (k = 2–20). Runs locally in the browser. |
| **Opacity** | Adjust overlay transparency for UMAP and for KMeans separately. |
| **Export UMAP PNG / Export KMeans PNG** | Download the corresponding overlay as a PNG image. |
| **Clusters** | Toggle individual clusters on and off. |

### Region of Interest (ROI)

| Tool | Description |
|---|---|
| **Rect** | Drag to draw a rectangular ROI. |
| **Lasso** | Draw a freeform outline for an irregular ROI. |
| **Confirm / Cancel** | Finalize or discard the current draft. |
| **ROI only / Show all** | Toggle between showing only ROI pixels or the full image. |
| **ROI stats** | Each ROI shows: Pixels, Mean, Std, Min, Max. |
| **Delete / Clear all** | Remove individual ROIs or clear everything. |

### Mask Import & Export

Export ROI masks and KMeans clusters as a binary mask file, or import one and use it as a display filter.

| Control | Description |
|---|---|
| **Format** | Choose the mask file format. |
| **ROI masks / KMeans clusters** | Pick which regions to include. Checked regions are merged into a single binary mask. |
| **Export mask** | Download one mask file. Each file embeds the dataset name, shape, pixel size, and a SHA-256 digest over the pixel payload. |
| **Import mask** | Load a mask and apply it as a filter on the ion image. |
| **Apply Mask / Show Original** | Re-apply the imported mask, or suspend it and show the full image. |
| **Clear imported mask** | Remove the imported mask. |

## Ion Intensity Image

Displays the spatial intensity distribution for the selected m/z value.

![Ion image](https://official-oss.oss-cn-hongkong.aliyuncs.com/docs/20260911153144287.jpg_view)

### Interaction

| Action | How |
|---|---|
| **Zoom** | Mouse wheel (centered on pointer), or use the `−` / `+` buttons in the bottom-right. |
| **Pan** | Click and drag when zoomed in. |
| **Pixel info** | Hover to see 1-based coordinates `(x, y)` and intensity. |
| **Select pixel** | In Processed mode, clicking a pixel loads its spectrum. |

### Toolbar

| Control | Description |
|---|---|
| **m/z search** | Continuous mode only. Enter a target m/z and press Enter or click Search to jump to the nearest peak. |
| **Tolerance ±** | m/z matching tolerance. Default 0.0001, range 1e-8–1. |
| **Colormap** | Viridis, Inferno (default), Magma, Hot, Gray. |
| **Intensity Scale** | Linear / Log / TIC norm. TIC norm divides each pixel by its total ion current and needs pre-computed stats on Continuous data. |
| **Reset** | Restore all controls to defaults. |
| **PNG** | Export the current image with a transparent background. |

### Display Range & Gamma (Right Strip)

- **Min/Max sliders** — drag to adjust contrast.
- **Gamma slider** — range 0.5–1.5, default 1.0.

## Multi-Ion Overlay

Continuous data can overlay several ions at once as separate colour channels. Enable **Overlay mode**, then add the current m/z as a channel — or use **Batch add m/z** and click peaks straight on the spectrum.

- Up to **10 channels**. Each channel is normalized on its own range and added as a colour.
- Per-channel controls cover visibility, colour, and opacity.
- Display Range, Colormap, and Gamma do not apply while an overlay is active (their controls are greyed out).

## Pixel Spectrum

Content depends on the data mode:

| Mode | What's Shown | Interaction |
|---|---|---|
| **Continuous** | Mean spectrum of the entire dataset | Click anywhere to switch to the nearest m/z and refresh the ion image. |
| **Processed** | Spectrum of the selected pixel | Click a pixel in the TIC image first, then its spectrum loads here. |

- Centroid data renders as **bar peaks**; profile data as **continuous curves**.
- The currently selected m/z is highlighted with a **vertical marker**.
- Footer shows: Peaks, Intensity, Selected/Tolerance, or Pixel info.

## Region Comparison

::: tip Availability
Region comparison is only available for **Centroid** data.
:::

Compare spectral differences between two regions (A vs. B). Regions can come from:

1. **KMeans clusters** (generated in the sidebar)
2. **User-drawn ROIs**

Set a minimum detection rate and an intensity threshold, then click **Compare**. Results are grouped into **A only**, **B only**, **A enriched**, **B enriched**, and **Shared**, with detection rates and mean intensities for both sides. Members of a group are combined (union) before comparing.

### Using KMeans Clusters

1. Open the **Visualization** section in the right sidebar and enable KMeans.

   ![KMeans controls](https://official-oss.oss-cn-hongkong.aliyuncs.com/docs/20260914160650461.jpg_view)

2. Choose the number of clusters.

   ![Cluster result](https://official-oss.oss-cn-hongkong.aliyuncs.com/docs/20260914160834781.jpg_view)

   ![Cluster overlay](https://official-oss.oss-cn-hongkong.aliyuncs.com/docs/20260914160853673.jpg_view)

3. Select two clusters to compare.

   ![Comparison result](https://official-oss.oss-cn-hongkong.aliyuncs.com/docs/20260914161105137.jpg_view)

### Using ROIs

1. Click **Rect** in the ROI section, draw a region, then click **Confirm** to create ROI 1.

   ![ROI 1](https://official-oss.oss-cn-hongkong.aliyuncs.com/docs/20260914161347733.jpg_view)

2. Click **ROI only** to reset the view, then draw another region to create ROI 2.

   ![ROI 2](https://official-oss.oss-cn-hongkong.aliyuncs.com/docs/20260914161613765.jpg_view)

3. Select both ROIs for comparison.

   ![ROI comparison](https://official-oss.oss-cn-hongkong.aliyuncs.com/docs/20260914161809308.jpg_view)

## Annotation Panel

The collapsible left-side panel imports an external metabolite/lipid annotation CSV, matches each row's experimental m/z against the current average spectrum, and lets you jump to matched peaks.

::: warning Prerequisites
Annotation matching requires **Continuous + Centroid** data. A warning appears if the spectrum mode is not supported.
:::

### Import

Click **Import CSV** to select a file, or drag and drop a CSV onto the panel. Parsing runs in a Web Worker; large tables use virtual scrolling.

CSV format requirements:

- **Encoding**: UTF-8 or UTF-8 BOM. Delimiter auto-detected (comma, semicolon, tab, or `|`).
- **m/z column** (required): recognized names include `Exp. m/z`, `Tar. m/z`, `mz`, `m/z`, `experimental_mz`, `mass`, etc.
- **Candidate names**: merged from `Candidate_1` through `Candidate_N` (or a single `Candidate` column). Empty values are dropped.
- **Optional columns**: `formula_ion` / `formula` (molecular formula), `Ion type` / `adduct` (adduct type).

### Tolerance

- Switch between **ppm** and **Da** units using the dropdown.
- Matching re-runs automatically when the value changes.

### Filtering & Search

- **Status badges** (top) filter by All, Matched, or Unmatched rows.
- **Adduct** and **Formula** dropdowns narrow results by metadata.
- **Search box** filters by name, formula, or m/z keywords.

Rows whose adduct or formula implies the opposite polarity, or whose m/z falls outside the spectrum range, are dropped before matching.

### Sorting

Use the **Sort by** dropdown, then click the arrow to toggle ascending/descending:

| Sort Key | What It Sorts By |
|---|---|
| Name | Compound name |
| Exp. m/z | Target m/z value |
| Mass Difference | Mass error (Δ) |
| Intensity | Average intensity at the matched peak |
| Composite score | Evidence score (see below), best first |
| Adduct score | Multi-adduct bonus (see below), best first |
| FDR | Target-decoy q-value, most reliable first |

### Evidence Scoring (Level 5 → Level 4)

Exact-mass matching alone corresponds to **Level 5** of the MSI confidence hierarchy (mass only). When the CSV provides `formula_ion`, every matched row additionally receives evidence scores computed entirely in the browser:

- **Mass score** — linear decay of the mass error within the tolerance.
- **Isotope score** — the theoretical isotope envelope of the ion formula is computed on the fly (natural-abundance convolution) and matched against observed peak intensities in the average spectrum using the formula of pySM's `isotope_pattern_match` (L1 distance on L2-normalized intensity vectors). Satellite peaks missing or wrongly-ratioed lower the score; note this spectral metric alone is lenient by design — the reference relies on the image-based metrics below for discrimination.
- **Composite** — mass × isotope. Rows whose formula cannot be parsed degrade gracefully (folded at a neutral constant that ranks them below every scored row).
- **FDR (q-value)** — a pySM-style target-decoy estimate: the same scoring pipeline runs on chemically implausible decoy adducts (e.g. [M+Mn]⁺), and the decoy score distribution yields an empirical false-discovery rate per row. Smaller is better.
- **Confidence level** — `L4` (exact mass + isotope support: isotope score ≥ 0.9 **and** all expected isotope peaks observed) or `L5` (mass only), shown as a badge in the table row.
- **Multi-adduct bonus (adductScore)** — when the same neutral molecule is detected as a group of ≥2 adduct ions (e.g. [M+H]⁺ together with [M+Na]⁺), the group is scored with the CAMERA adduct rule table: quasi-molecular ions ([M+H]⁺, [M−H]⁻, …) count ips=1.0, alkali replacements ([M−2H+Na]⁻, …) ips=0.5, and `adductScore = min(1, (Σips−1)/2)`; the composite is then multiplied by `1 + 0.2·adductScore`. The bonus is applied *after* FDR (q-values stay on the un-boosted scale, since decoy metal adducts cannot form groups). Grouped rows carry an **M×n** badge in the table, and the hover card links to the group members.

A **L4 filter chip** restricts the table to Level-4 rows.

### Spatial Evidence (pySM MSM metrics)

For the top 200 rows by composite score, the panel progressively loads ion images of the theoretical isotope peaks (up to 4) and computes the three pySM (Palmer et al., *Nat Methods* 2017) metrics, combined as **MSM = chaos × spatial × spectral**:

- **Chaos (ρ_chaos)** — level-set measure of spatial chaos: the image is thresholded at 10 intensity levels, each level set is opened morphologically (cross dilation + 3×3 erosion) and 4-connected objects are counted; a single structured region keeps the count low (score → 1) while speckle fragments are vetoed (→ 0).
- **Spatial (ρ_spatial)** — weighted Pearson correlation between the monoisotopic image and each satellite isotope image (weights = theoretical intensities), clipped to [0, 1]. Ions of the same molecule must co-localize; a zero satellite correlation is strong evidence against the annotation.
- **Spectral (ρ_spectral)** — image-based isotope pattern match: the total intensity of each isotope image (over the M image's mask) vs the theoretical envelope, L2-normalized L1 distance.

Images are hotspot-clipped at the 99th percentile before scoring (pySM preprocessing). Hovering a row or scrolling bumps it to the front of the scoring queue. The metrics appear in the hover card and in the exported CSV; they intentionally do **not** feed back into the Tier-1 composite score (which sorts the full row set).

**Multi-adduct spatial confirmation**: for adduct groups that make it into the Top-K, the member M images are additionally loaded and cross-correlated pairwise (Pearson); each row shows its maximum correlation `r` against the other members. Unlike the three MSM metrics above, this confirmation **does** feed back into the ranking: passing groups (per connected component of `r ≥ 0.7` edges, which must contain ≥2 distinct adduct forms and a quasi-molecular ion, aligned with adduct_filter's confirmation step) keep their Tier-1.5 bonus marked confirmed, while failing groups have the bonus revoked — the composite is divided back, `adductScore` is zeroed, and the panel re-sorts accordingly (a warning-colored badge and the `adductUnconfirmed` export column flag it).

### Table Interaction

- Two compact columns: **Annotation** (compound name + confidence badge) and **Exp. m/z**.
- **Hover card** shows: matched m/z, mass error, average intensity, the key scores up front (composite, level, FDR, MSM with its readiness progress), with mass / isotope / adduct / chaos / co-localization details folded into a "detailed scores" section; plus **isotope-peak jump** buttons (M+1, M+2, … jump to the nearest spectrum peak of the theoretical envelope), an **adduct-group** badge (M×n — click a member chip to select that row), and a **PubChem** lookup button.
- **Click a matched row** to jump to that m/z, refreshing the ion image and highlighting the spectrum peak.

### Export & Clear

- **Download** button exports matched rows as CSV, including the evidence-score columns; Chaos/Coloc when spatial scoring has run, and Adduct Score / Adduct Peers / Adduct Corr when multi-adduct groups formed.
- **Trash** button clears the imported data.
