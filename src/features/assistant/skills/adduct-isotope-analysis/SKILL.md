---
name: adduct-isotope-analysis
description: Analyze adduct and isotope evidence for one m/z or molecule — multi-adduct groups, isotope envelope checks, in-source fragments
whenToUse: When the user asks about adduct assignment, whether an adduct pattern supports an annotation, isotope peaks (M+1/M+2), or suspects in-source fragments/dimers
---

# Adduct & Isotope Evidence Analysis

The platform scores two orthogonal evidence families for every matched row:
**isotope evidence** (Tier-1 `isotopeScore`, Tier-2 `spatial`/`spectral`) and
**multi-adduct evidence** (`adductScore` + Tier-2 `adductCorr`). This skill
reads and explains both, and flags when they disagree.

## 1. Multi-adduct evidence (CAMERA adduct_filter logic)
A molecule ionized as several adducts produces SEVERAL peaks. The platform
groups rows whose neutral mass (observed m/z inverted through the adduct rule)
agrees within `2·tolerance + 0.015 Da`, requires ≥ 2 distinct adduct types on
distinct peaks, requires at least one quasi-molecular ion ([M+H]+, [M+Na]+,
[M+K]+, [M+NH4]+, [M+Li]+, [M−H]−, [M+Cl]−, [M+HCOO]−, [M+CH3COO]−), and
scores the group by Σips (each primary adduct 1.0, secondary like [M−2H+Na]−
0.5): `adductScore = min(1, (Σips − 1)/2)` → composite ×(1 + 0.2·adductScore).

Reading it via tools:
1. `get_annotation_top` — token `add=0.50×3` means score 0.50, 3 adduct forms.
2. `get_annotation_detail(mz)` — the `adduct group` line lists every peer with
   its m/z, plus spatial verdict: `[spatially confirmed]` (ar ≥ 0.70),
   `[NOT co-localized — bonus questionable]`, or `[pending]` (Tier-2 not yet
   computed / group outside top-200).

Judgment:
- **Supports identity**: ≥ 2 primary adducts, mass differences match adduct
  deltas within ppm (verify: e.g. [M+Na]−[M+H] = 21.9819), ar ≥ 0.7.
- **Questionable**: ar < 0.7 — same nominal neutral mass but different spatial
  distributions ⇒ likely two different molecules (isobars), or matrix-region
  artifact. Recommend narrowing tolerance or MS/MS.
- **Penalized by design**: groups of only secondary adducts (e.g.
  [M−2H+Na]− + [M−2H+K]−) get NO bonus (no quasi-molecular ion).

## 2. Isotope envelope checks
From `get_annotation_detail` you get the theoretical envelope (M..M+3, peaks
≥ 1% relative) with expected m/z, and the row's `iso=<score> (obs/exp peaks)`.
- ¹³C spacing: 1.0034 Da (÷ charge). Use `get_mean_spectrum_top_peaks` or
  `get_pixel_spectrum` to eyeball observed neighbors.
- M+2 strong (≈ 1/3 of M+1): Cl (3:1 A+2); ≈ equal to M: Br (1:1). Weak M+2
  (~4%): S. Missing M+1 entirely in a ≥ C30 molecule: suspicious annotation.
- `iso=0.9+ with (3/3 peaks)` → L4 territory; `iso` low but `spatial` high ⇒
  envelope intensity mismatch — check for overlapping neighbor peaks.

## 3. In-source fragments / dimers (deduction patterns)
- **[2M+X]+ dimer**: check m/z ≈ 2×(monomer neutral) + adduct shift at half
  tolerance; dimer image should co-localize with monomer (same argument as
  adduct groups — check whether the platform grouped them; it deliberately
  does NOT group dimers).
- **Neutral-loss fragments** ([M+H−H2O]+, −18.0106): common for lipids with
  free OH; fragment and precursor co-localize.
- **Adducts of adducts** ([M+Na+K]²⁺, half-integer m/z spacing) — charge
  state sanity: neighboring isotope spacing ÷ z.

## 4. Output template

```
## Adduct/isotope evidence for m/z <value> (<candidate>)

**Adduct group (M×n)**: members [adducts + m/z], Δ between members matches
adduct deltas within <X> ppm. Group score add=<s> → composite bonus ×<1+w·s>.
Spatial co-localization: ar=<r> → <confirmed / questionable / pending>.

**Isotope envelope**: expected M..M+k with <rel%>; observed <obs/exp peaks>,
iso=<score>. <M+2 anomaly note if any — Cl/Br/S flags>

**Verdict**: <multi-adduct evidence supports / does not support this
annotation because …>. Next step if uncertain: <narrow tolerance / MS/MS /
spectral_library_search with the peak list>.
```

Optionally ground adduct preference in method facts from the Dataset Context:
MALDI favors [M+H]+/[M+Na]+/[M+K]+; DESI negative often shows [M−H]−,
[M+Cl]−, [M+HCOO]−.
