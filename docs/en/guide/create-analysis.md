# Creating a New Analysis

This page explains how to create a new analysis task in the **SpatialXomics** workspace, including selecting a data source and configuring the preprocessing pipeline.

## Accessing the Page

After signing in, navigate to the **Workspace** via the navigation bar and click the **New Analysis** button to enter the creation page.

![New Analysis entry](https://official-oss.oss-cn-hongkong.aliyuncs.com/docs/Analysis_1.png)

The creation page is divided into two main areas: the configuration steps on the left, and the analysis summary panel on the right.

![Create New Analysis page](https://official-oss.oss-cn-hongkong.aliyuncs.com/docs/Analysis_2.png)

---

## Step 1: Data Source

In this step, you need to select a dataset to analyze.

![Data source selection](https://official-oss.oss-cn-hongkong.aliyuncs.com/docs/Analysis_3.png)

### Switching Data Sources

There are two tabs at the top:

- **My Datasets**: shows the private datasets you have uploaded.
- **Public Datasets**: shows all publicly shared datasets on the platform.

### Searching & Browsing

- Type keywords into the search box to filter datasets by name.
- The list displays each dataset's **name** and **file size**.
- Use the pagination bar at the bottom to browse through more datasets.

### Selecting a Dataset

![Selecting a dataset](https://official-oss.oss-cn-hongkong.aliyuncs.com/docs/Analysis_7.png)

Click any row in the list, or click the radio button on the right, to select a dataset. Once selected, the system will automatically:

- Detect the dataset's **spectrum mode** (Profile / Centroid) and **storage mode** (Continuous / Processed).
- Auto-fill instrument parameters from the dataset metadata (e.g., ionization source, analyzer, pixel size) for use in later steps.

> **Note**: The dataset's spectrum mode and storage mode together determine which preprocessing methods are available. For example, Profile mode datasets must go through Peak Picking before Peak Alignment becomes available; Centroid + Continuous datasets already share one m/z axis across all pixels (equivalent to already being aligned), so Peak Alignment is not supported.

---

## Step 2: Preprocessing Pipeline

Once a dataset is selected, you configure the preprocessing pipeline. Within each method group, **only one method** may be selected (single choice). Some methods support custom parameters.

![Preprocessing pipeline configuration](https://official-oss.oss-cn-hongkong.aliyuncs.com/docs/Analysis_4.png)

### Noise Reduction

Reduces signal noise while preserving mass spectral peaks as much as possible.

| Method | Description | Parameters |
|--------|-------------|------------|
| **Savitzky–Golay** | Savitzky–Golay smoothing filter | Window, Polyorder, Derivative, Delta (sample spacing) |
| **Gaussian** | Gaussian smoothing filter | Window, Sigma (standard deviation) |
| **Moving Average** | Moving average smoothing | Window |

### Baseline Correction

Removes baseline drift and corrects background signal.

| Method | Description |
|--------|-------------|
| **SNIP** | Statistics-sensitive Nonlinear Iterative Peak-clipping |
| **Local Minimum** | Local minimum baseline estimation |

Both methods require no additional parameters.

### Normalization

Scales spectra to comparable intensity ranges.

| Method | Description | Parameters |
|--------|-------------|------------|
| **TIC** | Total Ion Current normalization | Scale (output scaling factor) |
| **RMS** | Root Mean Square normalization | Scale (output scaling factor) |
| **REF** | Reference peak normalization | Scale (output scaling factor), Ref m/z (reference m/z; auto if empty), Ref Tolerance |

### Peak Picking

Detects and extracts peaks from spectra.

| Method | Description | Parameters |
|--------|-------------|------------|
| **Standard Peak Detection** | Standard peak detection | Method (Differential / Std Dev / MAD / Quantile), SNR (signal-to-noise threshold), Return (Height / Area), Width (peak width in data points) |

### Peak Alignment

Aligns peaks across spectra to a common m/z axis.

| Method | Description | Parameters |
|--------|-------------|------------|
| **Python Backend** | Python-based peak alignment | Bin Function (Median / Mean / Min / Max), Min Frequency (minimum frequency threshold for peak retention) |

> **Tip**: For datasets in **Profile** mode, the Peak Alignment option only appears after a Peak Picking method is selected. **Centroid + Processed** datasets store each pixel's peaks on its own m/z axis, so alignment to a common axis is needed. **Centroid + Continuous** datasets already share one m/z axis across all pixels, so their peaks are effectively already aligned, and Peak Alignment is not available.

### Mode Notice

After a dataset is selected, a blue info banner appears at the top of the preprocessing pipeline area, indicating the dataset's spectrum/storage mode and which methods are available or restricted.

---

## Analysis Summary Panel

The right side of the page has a fixed **Analysis Summary** panel that provides a real-time overview of the current configuration.

![Analysis Summary panel](https://official-oss.oss-cn-hongkong.aliyuncs.com/docs/Analysis_5.png)

### Panel Contents

- **Status Badge**: displays `Ready` (green) or `Incomplete` (yellow), indicating whether the current configuration meets the submission requirements.
- **Pipeline Summary**: lists each method group with the selected method and a ✓ mark.
- **Dataset Metadata**: shows metadata automatically parsed from the dataset (e.g., Polarity, Ionisation Source, Analyzer, Pixel, Organism, etc.).
- **Selected Dataset**: displays the dataset name and file size.
- **Start Analysis Button**: click **Start Analysis** to submit the analysis task.

### Submission Requirements

The submit button is only enabled when **all** of the following conditions are met:

1. A dataset has been selected.
2. Every method group has a method selected.
3. Polarity (positive / negative ion mode) has been specified.

When requirements are not met, the button is grayed out with the hint *"Select dataset and configure pipeline first"*.

---

## Submitting the Analysis

After clicking **Start Analysis**, the system submits the configuration to the backend and creates an analysis task. Upon successful submission:

1. A success toast appears at the top of the page.
2. You are automatically redirected to the **Workspace** page, where you can view the newly created analysis task and its execution status in the task list.

![Analysis submitted successfully](https://official-oss.oss-cn-hongkong.aliyuncs.com/docs/Analysis_6.png)

---

## Tips

- Before selecting a dataset, consider uploading the required data on the **My Datasets** page or verifying that the target data is available in **Public Datasets**.
- Each method group in the preprocessing pipeline is **single-choice** — you can only pick one method per group, but you may switch your selection at any time.
- If you are unsure about a parameter's meaning, hover over its label to see a tooltip; the default values usually produce good results.
- Analysis execution time depends on the data size and the complexity of the selected methods — please be patient while it runs.
