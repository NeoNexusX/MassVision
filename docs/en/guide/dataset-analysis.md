# Dataset Analysis

Choose compatible preprocessing methods based on your data's spectrum/storage mode, configure parameters, and submit analysis tasks.

**Author:** Chen Kejiang

**Feedback:** Found a bug or have a suggestion? Open a [GitHub Issue](https://github.com/NeoNexusX/MassVision/issues) or email **jydong@xmu.edu.cn**.

## Open the Analysis Page

Go to **Workspace > New Analysis**.

![Navigation](https://official-oss.oss-cn-hongkong.aliyuncs.com/docs/20260909164518653.jpg_view)

## Page Overview

The page has six sections:

![Page layout](https://official-oss.oss-cn-hongkong.aliyuncs.com/docs/20260909152647040.jpg_view)

| Section | Purpose |
|---|---|
| **Navigation bar** | Switch between platform pages |
| **Upload shortcut** | Jump to the upload page |
| **Dataset selector** | Pick a personal or public dataset |
| **Method selector** | Choose preprocessing steps |
| **Summary panel** | Review selected dataset and methods |
| **Start Analysis** | Submit the task |

## Select a Dataset

Browse **My Datasets** or **Public Datasets** and select the one you want to analyze.

![Dataset selection](https://official-oss.oss-cn-hongkong.aliyuncs.com/docs/20260909151822747.jpg_view)

Haven't uploaded your data yet? Click **Upload New Dataset** in the top-right corner (see [Upload Data](./upload-data)).

![Upload shortcut](https://official-oss.oss-cn-hongkong.aliyuncs.com/docs/20260909153324475.jpg_view)

## Choose Preprocessing Methods

### 1. Noise Reduction

#### Savitzky–Golay Smoothing

Fits a polynomial to a local window—good at preserving peak shape.

| Parameter | Default | Notes |
|---|---|---|
| Window | 5 | Positive odd integer (even values are auto-adjusted). Range 5–15. Larger = smoother but may blur narrow peaks. |
| Polyorder | 3 | Must be < Window. Lower = smoother; higher = better peak preservation. |
| Derivative | 0 | Keep at 0 for smoothing. Higher values output the derivative, not the original intensity. |
| Delta | 1.0 | Sampling interval for derivative calculation. |

![Savitzky–Golay](https://official-oss.oss-cn-hongkong.aliyuncs.com/docs/20260909160244980.jpg_view)

#### Gaussian Smoothing

Weights nearby points more heavily—produces a natural-looking smooth.

| Parameter | Default | Notes |
|---|---|---|
| Window | 5 | Positive odd integer. Range 5–15. |
| Sigma | 2.0 | Standard deviation (σ) of the Gaussian kernel. Larger = stronger smoothing, wider peaks. |

![Gaussian](https://official-oss.oss-cn-hongkong.aliyuncs.com/docs/20260909160302194.jpg_view)

#### Moving Average

Replaces each point with the average of its neighbors. Simple and effective, but large windows can flatten narrow peaks.

| Parameter | Default | Notes |
|---|---|---|
| Window | 5 | Positive odd integer. Range 5–15. |

![Moving average](https://official-oss.oss-cn-hongkong.aliyuncs.com/docs/20260909160416905.jpg_view)

### 2. Baseline Correction

| Method | Best For |
|---|---|
| **SNIP** | Dense peaks, variable backgrounds. Iteratively estimates the baseline while preserving peak shape. |
| **Local Minimum** | General-purpose. Estimates baseline from locally low signal points. |

![Baseline correction](https://official-oss.oss-cn-hongkong.aliyuncs.com/docs/20260909163548562.jpg_view)

### 3. Intensity Normalization

#### TIC (Total Ion Current)

Scales each spectrum so its total intensity equals a target value.

| Parameter | Default | Notes |
|---|---|---|
| Scale | 1.0 | Multiplier applied after normalization. Common values: 1000 or 10000. |

![TIC normalization](https://official-oss.oss-cn-hongkong.aliyuncs.com/docs/20260909163744460.jpg_view)

#### RMS (Root Mean Square)

Scales each spectrum so its RMS equals a target value.

| Parameter | Default | Notes |
|---|---|---|
| Scale | 1.0 | Multiplier applied after normalization. |

![RMS normalization](https://official-oss.oss-cn-hongkong.aliyuncs.com/docs/20260909163810520.jpg_view)

#### Reference Peak (REF)

Scales each spectrum so a specific m/z peak matches a target value.

| Parameter | Default | Notes |
|---|---|---|
| Scale | 1.0 | Multiplier applied after normalization. |
| Ref | (auto) | Target internal-standard m/z. If blank, the midpoint of the m/z range is used. |
| Ref Tolerance | 0.1 Da | Matching window around the reference peak (e.g., 500 ± 0.1 Da). |

![REF normalization](https://official-oss.oss-cn-hongkong.aliyuncs.com/docs/20260909163851707.jpg_view)

### 4. Peak Picking

| Parameter | Default | Notes |
|---|---|---|
| **Method** | diff | Noise estimation: `diff` (adjacent-point differences), `sd` (local std dev), `mad` (median absolute deviation), `quantile`. `mad` is most robust for data with large peaks. |
| **SNR** | 2.0 | Signal-to-noise threshold. Peaks below `SNR × noise` are discarded. Range 1.5–5.0. Lower = more peaks (noisier); higher = fewer, more confident peaks. |
| **Return** | height | `height` (peak-top intensity) or `area` (integrated area). Height is recommended for most workflows. |
| **Width** | 5 | Half-width of the local-max detection window. Range 3–11. Larger merges nearby peaks; smaller retains more. |

![Peak picking](https://official-oss.oss-cn-hongkong.aliyuncs.com/docs/20260909164354471.jpg_view)

### 5. Peak Alignment

| Parameter | Default | Notes |
|---|---|---|
| **Bin Function** | min | Resolution aggregation: `median` (recommended, robust), `min` (finest), `max` (coarsest). |
| **Min Frequency** | 0.01 | Minimum occurrence rate across spectra. 0.01 = peak must appear in ≥1% of spectra. Range [0, 1]. |

![Peak alignment](https://official-oss.oss-cn-hongkong.aliyuncs.com/docs/20260909165322419.jpg_view)

## Compatibility Matrix

Not all methods work with every data mode:

| Spectrum Mode | Storage Mode | Noise Reduction | Baseline Correction | Normalization | Peak Picking | Peak Alignment |
|---|---|---|---|---|---|---|
| profile | continuous | ✓ | ✓ | ✓ | ✓ | ✓ |
| profile | processed | ✓ | ✓ | ✓ | ✓ | ✓ |
| centroid | continuous | ✗ | ✗ | ✓ | ✗ | ✗ |
| centroid | processed | ✗ | ✗ | ✓ | ✗ | ✓ |

**Rules:**

- In profile mode, **peak alignment requires peak picking to be enabled first**.
- In centroid + continuous mode, peaks already share the same m/z axis, so peak alignment is not applicable—**only normalization is available**.

## Submit

Click **Start Analysis** to submit.

![Start Analysis](https://official-oss.oss-cn-hongkong.aliyuncs.com/docs/20260909170806890.jpg_view)

You'll be redirected to the [Workspace](./workspace) to track progress.

![Workspace redirect](https://official-oss.oss-cn-hongkong.aliyuncs.com/docs/20260909170958484.jpg_view)
