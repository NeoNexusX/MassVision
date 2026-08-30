# Getting Started

SpatialXomics is a web platform for uploading, managing, analyzing, and visualizing mass spectrometry imaging (MSI) data. Its current data entry point is a paired `.imzML` and `.ibd` dataset.

## What You Can Do

- Browse public datasets and public overview links without signing in.
- Sign in to download raw data, upload datasets, and manage public/private datasets.
- Use **Explore** to create a visualization without configuring preprocessing parameters.
- Choose compatible preprocessing methods under **Workspace → New Analysis**.
- Inspect ion/TIC images and spectra, then use UMAP, browser-local KMeans, ROIs, region comparison, and annotation CSV matching.

## First-Use Flow

1. **Browse public data**: open **Public Datasets**, search or filter, then click a card or **Overview** to inspect its metadata.
2. **Sign in or register**: downloads, uploads, the workspace, and result pages require authentication. Route guards return you to the protected destination after a successful sign-in.
3. **Prepare a dataset**: upload a paired imzML/ibd dataset under **My Datasets**, or select an existing public or personal dataset.
4. **Choose a processing path**:
   - Click **Explore** on a dataset card and confirm to create a Direct conversion task.
   - Or open **New Analysis** and configure a preprocessing pipeline for the dataset mode.
5. **View the result**: wait for the task to finish in the Workspace and click **View**. The result page relies on task context passed from the Workspace or a dataset card; do not treat the bare `/vizworkbench` URL as a bookmarkable result link.

## Data Modes

The result page detects one of two layouts:

| Mode | Image | Spectrum |
|---|---|---|
| Continuous | Ion-intensity image for the selected m/z | Dataset mean spectrum; click to change m/z |
| Processed | TIC image | Spectrum for the pixel clicked in the image |

UMAP/KMeans is available only for Continuous results. Annotation matching and region comparison also check spectrum mode; see [Viewing Data](./view-data).

## Interface Notes

- Light and dark themes are supported. The home page hides navigation, login and result pages use the drawer, and most other pages use the top navigation bar.
- Layouts are responsive on desktop and mobile, although complex result analysis works best on a wider screen.
- The application UI is currently English-first; the documentation language can be switched from the docs site header.
