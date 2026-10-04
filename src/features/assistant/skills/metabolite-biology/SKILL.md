---
name: metabolite-biology
description: Biological interpretation of annotated molecules — tissue localization, disease associations (HMDB), pathways (KEGG), and semantic roles (ChEBI)
whenToUse: When the user asks what an annotated molecule means biologically, or wants tissue/disease/pathway context for a set of annotations
---

# Metabolite Biology Interpretation

Goal: answer "this molecule in THIS tissue — what does it mean?" with database
grounding, not memory. Chemistry answers *what it is*; this skill answers
*what it does and where*.

## 1. Workflow
1. Start from evidence: `get_annotation_top` / `get_annotation_detail(mz)` for
   the molecule(s) the user cares about. Take the top candidates (putative),
   note the adduct and level.
2. **Identity cross-check** (cheap, do first): `library_lookup(name)` (lipids,
   offline LMSD) or `pubchem_compound_lookup(name)` (formula/mass/synonyms) —
   confirm the name you are about to interpret matches the formula.
3. **Small-molecule biology (HMDB)**: `hmdb_lookup(name)` → tissue
   localization, disease associations, biological function, KEGG id.
   For an unknown m/z (non-lipid), `hmdb_lookup(mz=<value>, polarity=...)`
   does adduct-aware mass matching against the metabolite database.
4. **Pathways (KEGG)**: `kegg_pathway_lookup(<name or C number>)` → the
   pathways this metabolite belongs to; `kegg_pathway_lookup(<pathway>)`
   reverses to member compounds — use to test "is this annotation set
   enriched in one pathway" by mapping the top N annotations and counting.
5. **Semantic role (ChEBI)**: `chebi_lookup(name)` → biological role terms
   (antioxidant, xenobiotic, detergent, ...). Good for one-line "what kind of
   molecule is this".
6. **Literature**: `europepmc_search("{molecule} {tissue}")` for imaging or
   tissue-specific evidence (abstracts included); fall back to
   `openalex_search` for reviews.

## 2. Judgment criteria
- **Consistent story**: HMDB tissue list includes the imaged tissue AND
  literature shows prior imaging/detection ⇒ state it as "consistent with".
- **Plausible but unproven**: pathway membership relevant to the region's
  biology (e.g. glycolysis in tumor) but no tissue-specific record ⇒ "plausible,
  no direct tissue evidence".
- **Contradiction flags**: HMDB lists the molecule as drug/xenobiotic but the
  study is animal tissue with no dosing; disease associations from a different
  organ than imaged — mention the mismatch instead of forcing the story.
- Never present a sum-composition annotation (e.g. PC 34:1) as a single
  species in biology claims — isomer families share the biology.

## 3. Output template

```
## Biology of <candidate> (putative, <adduct>, L<level>)

**Identity**: <formula, class from library_lookup/ChEBI role>.

**Tissue context (HMDB)**: reported in <tissues>; associated with <diseases>.
Function: <biofunction>. [not found ⇒ say so]

**Pathways (KEGG)**: <path1, path2...> — <one line on why this pathway
matters for the imaged region>.

**Literature**: <1–3 findings with PMID/DOI — prefer imaging or tissue
studies; quote a short phrase from the abstract when decisive>.

**Verdict**: <consistent / plausible / unsupported> for this tissue —
<one sentence reason>. Confidence limited by <mass-only annotation |
no MS/MS | isomer ambiguity>.
```

For a batch of annotations, add a pathway rollup:

```
### Pathway rollup (top N annotations)
| Pathway | Molecules mapped | Members found |
|---|---|---|
| Glycerophospholipid metabolism | 5/32 | PC 32:0, PC 34:1, ... |
```
(Treat counts as descriptive, not a statistical enrichment test.)
