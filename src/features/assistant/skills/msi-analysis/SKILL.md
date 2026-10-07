---
name: msi-analysis
description: General MSI (Mass Spectrometry Imaging) analysis workflow — preprocessing, quality, annotation with adduct/ppm rules, reporting
whenToUse: When the user asks about analyzing MSI data, preprocessing methods, data quality, m/z annotation, or wants to interpret a whole dataset
---

# MSI Data Analysis Workflow

## 1. Data Understanding
- Static sample metadata (dimensions, data mode, pixel size, m/z range, analyzer, ion source, polarity) is already injected in the system prompt's "Dataset Context" section — treat it as known session knowledge, no need to re-query. Use `get_page_state` for dynamic state (selected ion, clustering selection, annotation count) instead.
- Continuous mode: every pixel carries a full spectrum — use `get_mean_spectrum_top_peaks` to find dominant ions.
- Polarity determines the adduct search space (see §5). MALDI vs DESI vs SIMS changes typical molecule coverage: MALDI favors lipids and peptides; DESI favors small metabolites and lipids without matrix; SIMS gives element/fragment images at sub-cellular resolution.

## 2. Preprocessing
Ordered pipeline and when each step matters:

| Step | Methods | Use when |
|---|---|---|
| Normalization | TIC, RMS (median), median, TIC-in-MSI | comparing regions/samples; uneven ion suppression |
| Baseline correction | SNIP, top-hat | low-m/z drift, MALDI matrix background |
| Smoothing | Savitzky-Golay (spectral), Gaussian (spatial) | noisy single-pixel spectra |
| Peak picking | centroid, matched filtering | profile → peak list; downstream statistics |
| Coregistration | landmark/feature-based | correlating with H&E or serial sections |

Caveats:
- TIC normalization assumes constant total ion flux — invalid when a dominant species varies hugely (tumor necrosis); prefer median normalization then.
- Never smooth before peak picking on quantification workflows (peak height bias).
- Report pixel size with every spatial claim — a "hot spot" smaller than 1–2 pixels is usually noise.

## 3. Ion Image & Statistics
- `get_ion_image_stats` for the selected m/z: max / mean / percentiles / non-zero ratio / hot-spot coordinates.
- S/N heuristic: max ÷ (mean of background region). > 3 = detectable, > 10 = quantifiable.
- Non-zero ratio interpretation: > 50% widely distributed (structural lipids, PC/SM); 10–50% regional; < 10% highly localized (candidate biomarker or drug).

## 4. Clustering
- `get_kmeans_summary`: k, per-cluster pixel counts, and the currently selected cluster ids — no spatial masks or per-pixel data. k is chosen on the workbench.
- Use k-means for exploratory segmentation; expect blobs, not anatomy. Biological claim needs follow-up (overlay H&E, ROI statistics).
- Clusters driven by a few extreme pixels usually indicate noise or dead-pixel artifacts — check cluster size vs image.

## 5. Annotation (m/z → molecule)
Workflow (evidence priority: the user's scored candidates first, external databases for cross-checking, de novo search only when no library is loaded):

1. **Record the polarity** and probable adducts. Common adduct mass shifts (monoisotopic, Da):

   | Positive | shift | Negative | shift |
   |---|---|---|---|
   | [M+H]+ | +1.0073 | [M−H]− | −1.0073 |
   | [M+Na]+ | +22.9892 | [M+Cl]− | +34.9694 |
   | [M+K]+ | +38.9632 | [M+HCOO]− | +44.9982 |
   | [M+NH4]+ | +18.0338 | [M+CH3COO]− | +59.0133 |
   | [M+H−H2O]+ | −17.0027 | [M−H2O−H]− | −19.0178 |

   Neutral mass M = m/z − shift. In MALDI, [M+Na]+ / [M+K]+ often dominate despite [M+H]+ being "expected" — check all.
2. **Mass error** in ppm: `err = 1e6 × |m/z_observed − m/z_calculated| / m/z_calculated`.
   Orbitrap/FTICR: < 3 ppm is a good match; TOF (common in MSI): < 10 ppm acceptable, < 5 ppm good. PPM alone never proves identity — it only filters candidates.
3. **Platform candidates first (primary route)**: call `get_annotation_top` — the user's own imported annotation library, already scored by the platform's evidence pipeline (mass × isotope composite with target-decoy FDR q, multi-adduct bonus, and spatial MSM/chaos/colocalization for top rows). Rows carry tokens like `L4 c=0.87 q=2% add=0.50×3 msm=0.79 ar=0.83`: `add=s×n` = multi-adduct evidence (same molecule as n distinct adduct ions on different peaks, CAMERA Σips-based bonus already inside `c`), `ar` = spatial co-localization Pearson of that adduct group (≥ 0.70 confirmed). Whenever a library is loaded (annotation matches > 0 in `get_page_state`), START here: read the evidence tokens, cut at q ≤ 5–10%, distinguish L4 (isotope-supported) from L5 (mass-only), and analyze from the strongest evidence down. To dig into one row call `get_annotation_detail(mz)` (full scores, adduct group peers, candidates, isotope envelope). Treat as candidates, not identifications.
4. **Cross-check identity** for the rows you discuss: `library_lookup` (shorthand → species, classification, exact mass; deployed offline library = LIPID MAPS LMSD) and `pubchem_compound_lookup` (synonyms, SMILES/InChIKey). For a suspicious row or a competing candidate, `library_mass_search(mz, polarity)` re-derives candidates independently — adduct-aware matching, returns candidates with Δppm and lipid class.
5. **No library loaded (annotation matches = 0)? De novo route**: for lipids call `library_mass_search(mz, polarity)`; for non-lipid / small metabolites call `hmdb_lookup(mz=<value>, polarity=...)` (adduct-aware mass search with tissue/disease context) or enumerate formula candidates with `pubchem_formula_search`, then check the candidate is a plausible tissue molecule (metabolite, drug).
6. **Isotope sanity**: ¹³C spacing 1.0034 Da; visible M+2 ⇒ Cl (3:1) or Br (1:1); S gives weak M+2 (~4%). The row's `iso=<score> (obs/exp peaks)` token and the envelope in `get_annotation_detail` give the expected pattern.
7. **Fragment evidence (stage ③)**: if the user has MS/MS peaks (pixel spectrum via `get_pixel_spectrum`), run `spectral_library_search(precursorMz, peaks=...)` against the offline MassBank reference library — matched-peak counts beat any rule table.
8. **Isomers & isobars**: one sum composition (e.g. PC 34:1) covers many sn-position/double-bond isomers — an image is a composite unless isomer-resolved (ion mobility, MS/MS, derivatization; see *Int J Mass Spectrom* 2024, PMID 40766833).
9. **In-source fragments / dimers / adducts of adducts** ([2M+H]+, [M+Na+K]²⁺) inflate false candidates — check for half-integer charge states and paired m/z.
10. **Everything above is putative**: imaging-only annotation is never an identification — confirmation requires on-tissue MS/MS or standards (reporting practice: Balluff et al., *Histochem Cell Biol* 2011, doi:10.1007/s00418-011-0843-x).

### Authoritative databases to cite / verify against
- **LIPID MAPS / LMSD** (https://www.lipidmaps.org) — lipid systematics, shorthand notation, calculated masses; queried offline by the `library_*` tools (deployed index).
- **PubChem** (https://pubchem.ncbi.nlm.nih.gov) — general compounds; the `pubchem_*` tools query it live.
- **HMDB** (https://hmdb.ca) — human metabolites, tissue/disease context (`hmdb_lookup`, offline index).
- **KEGG** (https://www.kegg.jp) — metabolic pathways (`kegg_pathway_lookup`, offline index).
- **ChEBI** (https://www.ebi.ac.uk/chebi) — biological role ontology (`chebi_lookup`, online).
- **METLIN** (https://metlin.scripps.edu) — MS/MS reference for metabolites.
- **MassBank** (https://massbank.eu) — open MSⁿ spectra (`spectral_library_search`, offline index).
- **GNPS** (https://gnps.ucsd.edu) — molecular networking / library spectra (needs backend proxy; not browser-callable).
- **LipidBlast / mzCloud** — in-silico and reference MS/MS libraries.
MSI-specific: confirmation requires on-tissue MS/MS or standards — imaging-only annotation is "putative" (review & reporting practice: Balluff et al., *Histochem Cell Biol* 2011, doi:10.1007/s00418-011-0843-x).

### Recent key literature
- Kumar BS. *From tumors to neurons: mass spectrometry imaging in spatial lipidomics.* Anal Methods, doi:10.1039/d6ay00170j (PMID 42370410) — current landscape of MALDI/DESI/SIMS spatial lipidomics.
- *An analytical evaluation of tools for lipid isomer differentiation in imaging mass spectrometry.* Int J Mass Spectrom 2024 (PMID 40766833) — isomer/isobar resolution options.
- *MS-DIAL 5 multimodal mass spectrometry data mining unveils lipidome complexities.* Nat Commun 2024, doi:10.1038/s41467-024-54137-w — open-source data processing incl. lipid identification.
Search for newer work with `pubmed_search` before writing reports.

## 6. Literature grounding
Before claiming biological meaning, search `europepmc_search` (abstracts included) or `pubmed_search`, e.g. `"{molecule} mass spectrometry imaging {tissue}"`. Prefer reviews for mechanism claims (`openalex_search` finds them); cite PMID/DOI when writing reports.

## 7. Reporting (output template)
Include: dataset summary (instrument, dimensions, pixel size, m/z range, polarity) → preprocessing actually applied → key ions with m/z, annotation level (putative by mass / MS/MS confirmed), spatial pattern → clustering results → biological interpretation with literature (PMID) → limitations (mass resolution, pixel size, no MS/MS).

Structure the report as:

```
# MSI Analysis Report — <sample>

## 1. Dataset & preprocessing
<instrument, mode, dims × pixel size, polarity; steps actually applied>

## 2. Key ions & annotations (putative)
| m/z | Candidate | Adduct | Evidence (L, q, add, MSM) | Spatial pattern |
|---|---|---|---|---|

## 3. Spatial structure
<k-means / co-localized groups; 2–4 findings>

## 4. Biological interpretation
<per finding: molecule → tissue context (HMDB/KEGG) → literature (PMID)>

## 5. Limitations & next steps
<mass-only annotations, no MS/MS, pixel-size limits; what to confirm>
```
