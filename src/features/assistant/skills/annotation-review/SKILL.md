---
name: annotation-review
description: Review the current annotation table — evidence tiers, multi-adduct support, FDR, and a per-row verdict template
whenToUse: When the user asks to review/check/rank annotations, ask which annotations are trustworthy, or wants a confidence report of the annotation table
---

# Annotation Review Workflow

Goal: turn the scored annotation table into a per-row verdict with explicit
judgment criteria — never a bare "this is X".

## 1. Gather
1. `get_page_state` — confirm annotation matches > 0; note polarity.
2. `get_annotation_top` (topN up to 20) — rows carry compact evidence tokens:
   `L4 c=0.87 q=2% add=0.50×3 msm=0.79 ch=0.95 sp=0.91 ar=0.83`
   - `L4/L5` — confidence level: L4 = exact mass + isotope support (isotopeScore ≥ 0.9 AND all expected peaks observed); L5 = exact mass only.
   - `c` — composite score (mass × isotope, includes the multi-adduct bonus; higher = stronger).
   - `q` — target-decoy FDR q-value (smaller = more credible).
   - `add=score×n` — multi-adduct evidence: the same molecule observed as n distinct adduct ions on different peaks (adductScore 0..1 folded into `c`).
   - `msm/ch/sp` — pySM spatial metrics (Tier-2, top-200 only; may be absent).
   - `ar` — spatial co-localization Pearson of the adduct group (≥ 0.70 = confirmed).
3. For any row you will discuss in depth, call `get_annotation_detail(mz)` — full scores, adduct group peers, candidate list, theoretical isotope envelope.

## 2. Judgment criteria (verdict matrix)
| Verdict | Criteria (all required unless noted) |
|---|---|
| **High confidence** | L4 AND q ≤ 5% AND (MSM ≥ 0.5 OR add ≥ 0.5×2 with ar ≥ 0.7) |
| **Moderate** | L4 AND q ≤ 10–20%; or L5 AND add ≥ 0.5×2; or MSM ≥ 0.5 with q ≤ 10% |
| **Low / mass-only** | L5 AND q > 10% AND no adduct bonus |
| **Questionable** | ar < 0.70 with add ≥ 0.5 (same neutral mass, different spatial distribution — isobar collision or co-eluting species); or ch ≈ 0 with sp high (scattered dots); or composite < 0.5 |
| **Reject** | unmatched rows; or fdr ≥ 50% with no other evidence |

Additional checks:
- **Same-peak collision**: multi-adduct bonus is only valid when each adduct sits on a DIFFERENT peak (the platform enforces this — peers list m/z values in `get_annotation_detail`; if you doubt it, verify the m/z differ by the adduct mass difference).
- **Isobars**: collapsed rows keep `altFormulas`/`altAdducts` — a row with many candidates of the same mass is a sum composition, not an identity.
- **Pixel-size sanity**: any spatial claim needs the pixel size from the dataset context; features < 2× pixel size are noise.

## 3. Output template (use this structure)

```
## Annotation review (top N rows, sorted by composite)

| # | m/z | Candidate (putative) | Adduct | Level | q | adduct evidence | MSM | Verdict |
|---|-----|----------------------|--------|-------|---|-----------------|-----|---------|
| 1 | 734.5699 | PC 32:0 | [M+H]+ | L4 | 1.2% | 0.50×2 (ar=0.83✓) | 0.79 | High |
| 2 | 786.6007 | PE 36:1 | [M+H]+ | L5 | 18% | — | — | Low (mass-only) |

### Key findings
- <2-4 strongest rows: what evidence makes them credible, which region they mark>

### Questionable calls
- <rows with ar < 0.7, ch ≈ 0, or q > 20%: what to re-check (MS/MS, narrower tolerance, isomer resolution)>

### Caveats
All annotations are putative (accurate-mass level unless MS/MS/standards confirm).
```

Rules for the table: cap at 10–12 rows; one line per row in prose findings; always state the sort criterion (composite descending).
