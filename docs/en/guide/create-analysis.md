# Creating an Analysis

After signing in, open **Workspace → New Analysis**. Select data and preprocessing methods on the left; review and submit the current configuration on the right.

## Select a Data Source

Two tabs are available:

- **My Datasets**: datasets uploaded by the current account.
- **Public Datasets**: datasets published on the platform.

The search field filters by the backend `filename` field. Switching tabs preserves the query and reloads the appropriate list. Each row shows the dataset name, filename/submission time, and size; click a row or its radio button to select it.

**Upload New Dataset** in the page header navigates to My Datasets and opens the upload dialog automatically.

After selection, the frontend reads Spectrum Mode, Storage Mode, Polarity, Ionisation Source, Analyzer, and Pixel Size from metadata. Polarity is required for submission; the other fields primarily populate the summary.

## Method Compatibility

Only method groups compatible with the selected data mode are shown:

| Spectrum + Storage | Available groups |
|---|---|
| Profile + Continuous | Noise Reduction, Baseline Correction, Normalization, Peak Picking; Peak Alignment appears after Peak Picking is selected |
| Profile + Processed | Same as Profile + Continuous |
| Centroid + Continuous | Normalization |
| Centroid + Processed | Normalization and Peak Alignment |

Centroid + Continuous already uses a shared m/z axis, so Peak Alignment is not offered. Profile data must be converted to peaks before alignment becomes meaningful.

## Methods and Parameters

Each method group is single-choice, but the group itself is optional. Click a selected method again to clear it.

### Noise Reduction

| Method | Parameters and defaults |
|---|---|
| Savitzky–Golay | Window `5`, Polyorder `3`, Derivative `0`, Delta `1.0` |
| Gaussian | Window `5`, Sigma `2.0` |
| Moving Average | Window `5` |

### Baseline Correction

- **SNIP** (`snip_numba`)
- **Local Minimum** (`locmin_numba`)

Neither exposes frontend parameters.

### Normalization

| Method | Parameters and defaults |
|---|---|
| TIC | Scale `1.0` |
| RMS | Scale `1.0` |
| REF | Scale `1.0`, Ref m/z blank for automatic selection, Ref Tolerance `0.1` |

### Peak Picking

**Standard Peak Detection** supports:

- Method: `diff`, `sd`, `mad`, or `quantile`; default `diff`.
- SNR: default `2.0`.
- Return: `height` or `area`; default `height`.
- Width: default `5` data points.

The submitted payload fixes the backend to Python.

### Peak Alignment

**Python Backend** supports:

- Bin Function: `median`, `mean`, `min`, or `max`; default `min`.
- Min Frequency: default `0.01`, with a defined range of `0–1`.

The payload also fixes `units: ppm` and `binratio: 2`.

## Submission Requirements

**Start Analysis** becomes available when:

1. A dataset is selected.
2. At least one currently available preprocessing method is selected.
3. The dataset metadata supplies a recognizable Polarity.

You do not need to select every visible group. The `Ready / Incomplete` badge currently uses a stricter summary rule and shows `Ready` only when every visible group has a selection; that visual status does not override the three actual submission conditions above.

## After Submission

The frontend converts the selected methods into the backend `algorithms` payload and calls `POST /processes`. On success it shows **Analysis started** and returns to the Workspace. Click **View** after completion; failed tasks expose the backend error message.

If you only need a quick visualization and no custom preprocessing, use **Explore** on a dataset card to create a Direct conversion task.
