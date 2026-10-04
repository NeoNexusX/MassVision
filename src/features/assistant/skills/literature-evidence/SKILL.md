---
name: literature-evidence
description: Literature retrieval and evidence grading — Europe PMC (abstracts), OpenAlex (reviews/citations), with citation formats and support/contradiction verdicts
whenToUse: When the user asks for literature on a molecule/method/tissue, wants citations for a report, or needs published evidence to support or challenge an interpretation
---

# Literature Evidence Workflow

Goal: grounded claims with traceable citations, and an explicit verdict of
whether the literature supports the interpretation.

## 1. Tool selection
| Need | Tool | Notes |
|---|---|---|
| Abstract text to quote/verify | `europepmc_search` | PubMed superset; returns abstract excerpts, PMCID, DOI — FIRST CHOICE for evidence |
| Quick existence check in PubMed | `pubmed_search` | title/journal/PMID only, no abstract |
| Reviews, coverage, influence | `openalex_search` | citation counts, work types (review/preprint), OA links |
| Methods background (MSI-specific) | the `skill` tool (msi-analysis §recent literature) | curated starting points |

## 2. Query construction
- Molecule + tissue + modality: `"{molecule} mass spectrometry imaging {tissue}"`.
- If too narrow, drop the tissue; if too broad, add the ionization (MALDI/DESI).
- Mechanism claims: add "review" or use OpenAlex and filter `type=review`.
- Non-English works exist but query in English first; try the molecule's class
  name as a fallback when the exact species is unpublished ("PC 34:1
  imaging" fails ⇒ "phosphatidylcholine imaging brain").

## 3. Evidence grading (judgment criteria)
| Grade | Meaning | Typical source |
|---|---|---|
| **A — direct** | This molecule imaged/quantified in this tissue/modality | MSI paper with the exact molecule |
| **B — transferable** | Molecule reported in this tissue by other -omics; or class-level MSI evidence | LC-MS/MS tissue study; class-level imaging |
| **C — mechanism only** | Pathway/role documented, tissue link not shown | HMDB/KEGG or reviews |
| **X — contradicting** | Study reports absence/negativity or conflicts | any level |

Rules:
- Quote at most one short decisive phrase from an abstract; paraphrase the rest.
- A PMID/DOI with no supporting text = do not cite it for a specific claim.
- If nothing is found after two query reformulations, say "no literature
  retrieved" — do NOT invent citations.

## 4. Output template

```
## Literature evidence: <claim in one line>

**Verdict: <supported | partially supported | unsupported | no literature found>**

| Grade | Finding | Source |
|---|---|---|
| A | <direct finding, 1 line> | Author, Journal Year — PMID/DOI |
| B | <transferable finding> | ... |
| C | <mechanism context> | ... |

**Most relevant excerpt**: "<short quote>" (PMID …)

**What would strengthen this**: <MS/MS confirmation / more specific query /
review-level evidence>.
```

For report writing, embed citations inline as (Author et al., Year, PMID) and
keep this table as the evidence appendix.
