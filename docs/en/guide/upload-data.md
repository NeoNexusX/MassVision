# Uploading Data

This page walks you through uploading mass spectrometry imaging (MSI) data into SpatialXomics.

## Supported Formats

- **imzML data pairs**: a `.imzML` file (metadata/spectrum index) plus its matching `.ibd` file (binary spectrum data). The two files must share the **same base filename** (only the extension differs), or they can't be paired for upload.

## Steps

1. On the datasets page, click **Upload** to open the upload dialog.
2. Select (or drag and drop) a local `.imzML` + `.ibd` pair, and fill in the dataset metadata (analyzer type, ionization source, pixel size, etc.).
3. Your browser first hashes the files, then compresses them into a ZIP — this runs in a Web Worker so the page stays responsive. The compressed archive is staged in the browser's OPFS (Origin Private File System) to support resuming later.
4. The client requests temporary Alibaba Cloud OSS upload credentials from the backend, then uploads the archive via **multipart upload**. If the backend recognizes the file by its hash as already existing, it skips the actual transfer and reuses the stored copy.
5. Once the upload completes, the dataset appears in the data panel and is ready for analysis.

## Resuming & Retries

- Upload progress (upload ID, completed parts, credential expiry) is persisted locally. If you close the page or lose connection mid-upload, reopening the upload dialog shows a **resume banner** — click it to continue from where you left off, without re-hashing or re-compressing.
- A failed part upload retries automatically; you're only prompted if retries are exhausted.

## Tips

- Double-check that your `.imzML` and `.ibd` files have matching base filenames before uploading.
- Hashing and compression for large files run in the background — you can keep browsing other pages while they finish.
- If an upload fails, check the filename match and your network connection first, then try resuming before starting over.
