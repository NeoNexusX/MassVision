# Uploading Data

This page describes the current imzML upload flow. After signing in, open **My Datasets → Upload New Dataset**.

## File Requirements

- Select one `.imzML` file and one `.ibd` file at the same time.
- The two files must have exactly the same base filename; extension case is ignored.
- The frontend checks the imzML file for basic structural tags. If parsing fails, select the pair again after fixing the file.
- For a public dataset, the `.ibd` file must be at least **10 MB**. The frontend does not apply this minimum to private datasets.

## Metadata

After selection, the frontend attempts to read polarity, ion source, analyzer, pixel dimensions, Spectrum Mode, and Storage Mode from imzML. Complete anything that could not be detected. Changing a detected Spectrum/Storage Mode triggers a confirmation dialog.

The following fields are always required:

| Group | Fields |
|---|---|
| Acquisition | Polarity, Ionisation Source, Analyzer, Pixel Size X/Y, Spectrum Mode, Storage Mode |
| Sample | Organism, Organism Part, Condition, Sample Stabilization |

Additional rules:

- Pixel Size X/Y must be integers from `1` to `200`.
- Sample Growth Conditions and Tissue Modification are optional.
- The m/z and Resolving Power fields under Detector resolving power are optional; valid values are submitted as numbers.
- Whether Solvent, MALDI Matrix, and MALDI Matrix Application are required is driven by the ion-source rules in `src/features/upload/utils/ionSourceRules.ts`. The form starts with `100% Water`; MALDI-family sources generally also require matrix details.
- Selecting **Other** requires a concrete custom value; the literal value `Other` cannot be submitted for required select-with-other fields.

## Public or Private

**Make dataset public (visible to others)** is currently checked by default:

- Keep it checked: confirm the public upload and ensure the `.ibd` file is at least 10 MB.
- Uncheck it: the dataset remains visible only under your **My Datasets** page.

An existing private dataset can also be made public from its overview page. The current UI treats this action as irreversible.

## Actual Upload Pipeline

After **Confirm & Upload**, the frontend performs these steps:

1. Compute a combined MD5 for the two original files in a Web Worker.
2. Send the original size and MD5 to the preflight endpoint to check for existing data.
3. If the backend can reuse the data, finish immediately without compression or upload.
4. Otherwise, check storage quota and create a ZIP64 archive in browser OPFS.
5. Obtain temporary OSS STS credentials from the backend and upload the archive with `ali-oss` multipart upload.
6. Remove the local resume session and temporary OPFS ZIP after success.

The progress panel reports the stage, percentage, speed, and ETA. **Abort Upload** aborts the active OSS multipart upload but keeps the local archive so a later attempt can reuse it.

## Resume

Session metadata is stored in this site's `localStorage`, while the compressed ZIP is stored in this browser's OPFS:

- **Resume / Discard** appears only after both an upload session and local ZIP have been established.
- Resume requires the same browser, site origin, and browser profile. Clearing site data removes the resumable archive.
- An expired STS session cannot resume; the frontend removes it and asks you to start again.
- **Resume** restores the saved multipart checkpoint. After an explicit abort, the next attempt starts a new multipart upload while reusing the local ZIP.
- **Discard** deletes both session metadata and the OPFS file.

An OSS failure is retried once automatically (two attempts total). If the second attempt fails, the recoverable state is kept and an error is shown.

## Troubleshooting

- **Files cannot be selected**: select both files together and verify their base filenames match.
- **Metadata cannot be submitted**: check starred fields, pixel dimensions, and dynamic ion-source fields. Replace `Other` with a concrete value.
- **Public upload rejected**: verify that the `.ibd` file is at least 10 MB.
- **No Resume prompt**: preparation may not have reached the persisted upload stage, or site data, the OPFS file, or the STS session has expired.
