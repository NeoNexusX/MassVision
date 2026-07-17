# Viewing Data

SpatialXomics offers two ways to turn mass spectrometry imaging data into interactive visualizations:

## 1. Two Visualization Methods

### One-Click Visualization (Explore / Raw-Convert) — Recommended

Launch directly from the dataset list with zero preprocessing configuration — the backend handles all conversion steps automatically.

**Use cases**: Quick data browsing, first-time dataset exploration, no custom preprocessing needed.

**Steps:**

1. On the **Public Datasets** or **My Datasets** page, find the target dataset card.
2. If the card button shows **Explore**, the dataset hasn't been converted yet. Click it to start one-click visualization.
3. A confirmation dialog titled "Prepare Visualization" will appear — click **Generate** to confirm.
4. After the "Task is in progress" toast, the page redirects to the Workspace where you can track the conversion progress. If no redirect occurs, the task already exists in another user's workspace — simply wait a moment and the button will change to Visualize.
5. Once the task status shows `completed`, click **View** to open the result page.

![view-1](https://official-oss.oss-cn-hongkong.aliyuncs.com/docs/view-1.png)

![view-2](https://official-oss.oss-cn-hongkong.aliyuncs.com/docs/view-2.png)

**Returning visits**: After conversion, the dataset card button changes to **Visualize**. Clicking it opens the result page directly — no repeated conversion needed.

![view-3](https://official-oss.oss-cn-hongkong.aliyuncs.com/docs/view-3.png)

### Preprocessing Analysis (Workspace Analysis)

Create an analysis task manually in the Workspace, choosing your own algorithms and parameters for noise reduction, baseline correction, normalization, peak picking, and peak alignment.

**Use cases**: Fine-grained control over the preprocessing pipeline, comparing algorithm performance, reproducing analysis workflows.

For the detailed steps (selecting a data source, configuring the preprocessing pipeline, submitting the task, etc.), see [Creating an Analysis](/guide/create-analysis). Once the task completes, click **View** in the Workspace task list to open the result page.

> Regardless of the method, the final interactive visualization interface (ion image, spectrum, ROI, etc.) is identical. The sections below cover how to use the result page.

---

## 2. Entering the Result Page

After generating a visualization through either method above, tasks with a `completed` status in the **Workspace** task list will show a **View** button. Click it to enter the result page.

![view-5](https://official-oss.oss-cn-hongkong.aliyuncs.com/docs/view-5.png)

> The result page is at `/workspace/results` and requires login. Tasks with a `processing` status cannot be viewed yet; for `failed` tasks, click to view the error reason.

## 3. Page Layout

The result page uses a two-column layout:

- **Left main area**: Ion image or TIC image at the top (with toolbar and zoom controls), spectrum at the bottom (with summary stats).
- **Right panel**: Display range adjustment, statistical histogram, dataset metadata, preprocessing methods, and ROI overlay controls.

![view-6](https://official-oss.oss-cn-hongkong.aliyuncs.com/docs/view-6.png)

---

## 4. Data Modes

The result page supports two data viewing modes, determined by the dataset's storage mode:

| Mode | Description | What you can do |
|---|---|---|
| **Continuous** | Renders the ion intensity distribution for a given m/z | Switch m/z, view average spectrum, click peaks to link |
| **Processed** | Renders the TIC (Total Ion Current) image | View TIC image, click a pixel to see its spectrum |

Interactions differ between the two modes, as explained in the sections below.

---

## 5. Ion Image

### Basic Operations

- **Zoom**: Mouse scroll wheel to zoom, centered on the cursor position.
- **Pan**: When zoomed beyond 1×, drag to pan the image.
- **Zoom controls**: − / + buttons with current zoom level in the bottom-right corner. Click **Reset** to return to 1:1.
- **Pixel hover**: Hovering over the image shows a tooltip — pixel coordinates (col, row) and intensity value.

![view-7](https://official-oss.oss-cn-hongkong.aliyuncs.com/docs/view-7.png)

### Toolbar

The toolbar above the image provides the following controls:

| Control | Description | Mode |
|---|---|---|
| Title | Shows the current mode name (Ion Image / TIC Image) | Both |
| m/z value | Displays the currently selected m/z | Continuous |
| Tolerance | Adjusts the m/z matching tolerance (min 0.001) | Continuous |
| Colormap | Switch between Viridis / Inferno / Plasma / Gray | Both |
| Intensity Scale | Switch between Linear or Log scale | Both |
| Reset | Reset all image parameters (tolerance, colormap, scale, gamma, display range) | Both |

> **About Tolerance**: Tolerance defines the acceptable deviation for m/z matching — for example, with a tolerance of 0.01 and a selected m/z of 889.58, signals in the range 889.57 ~ 889.59 are considered the same ion. Smaller tolerance means stricter matching; larger tolerance widens the match window.

![view-8](https://official-oss.oss-cn-hongkong.aliyuncs.com/docs/view-8.png)

### Display Range Adjustment

Each pixel in the ion image is colored according to its ion intensity: **low intensity → dark end, high intensity → bright end**, with intermediate values mapped through the current colormap.

The vertical gradient strip to the right of the image visualizes this mapping — showing the full intensity gradient from top to bottom in the current colormap — and supports manual range adjustment:

- Drag the Min / Max handles to adjust the range bounds.
- Click between the handles on the strip to jump to that position.
- Click the ↺ button to restore the automatic range (P1 ~ P95).

### Gamma Adjustment

The **Visualization** section in the right panel provides a Gamma slider, ranging from 0.5 to 1.5. Increasing Gamma brightens low-intensity regions; decreasing Gamma enhances contrast in highlight regions.

**Gamma = 1.0 (default):**

![view-9](https://official-oss.oss-cn-hongkong.aliyuncs.com/docs/view-9.png)

**Gamma = 0.5:**

![view-10](https://official-oss.oss-cn-hongkong.aliyuncs.com/docs/view-10.png)

### Pixel Click in Processed Mode

In Processed / TIC mode, clicking a pixel in the image loads that pixel's spectrum (see the Spectrum section below).

![view-11](https://official-oss.oss-cn-hongkong.aliyuncs.com/docs/view-11.png)

---

## 6. Spectrum

The spectrum is located below the ion image.

### Spectrum Modes

The spectrum has two display modes based on data characteristics:

| Mode | Display | Data Mode |
|---|---|---|
| **Centroid** | Medium gray bar chart — each bar represents a detected peak | Continuous / Processed |
| **Profile** | Dark gray continuous line chart — shows the full spectrum profile | Continuous / Processed |

**Centroid:**

![view-12](https://official-oss.oss-cn-hongkong.aliyuncs.com/docs/view-12.png)

**Profile:**

![view-13](https://official-oss.oss-cn-hongkong.aliyuncs.com/docs/view-13.png)

### Continuous Mode Interactions

- **Average spectrum**: Shows the mean spectrum across all pixels in the dataset.
- **Click to select peaks**: Click anywhere in the spectrum to switch the ion image to the corresponding m/z.
- **Red selection line**: A red vertical line marks the currently selected m/z, staying in sync during zooming.
- **Bidirectional linkage**: Click a point on the ion image → spectrum highlight updates; click a peak in the spectrum → ion image switches to that m/z.

For example, clicking the peak at m/z 889.5810 in the spectrum will automatically switch the ion image to show the intensity distribution at that m/z.

![view-14](https://official-oss.oss-cn-hongkong.aliyuncs.com/docs/view-14.png)

### Processed Mode Interactions

- **Pixel spectrum**: After clicking a pixel in the TIC image, the spectrum switches to that pixel's mass spectrum, with the title showing "Spectrum — Pixel (66, 66)".

![view-15](https://official-oss.oss-cn-hongkong.aliyuncs.com/docs/view-15.png)

### Zooming & Browsing

- **Built-in zoom**: Supports drag-to-select region zooming.
- **Bottom slider**: Drag the slider handles to adjust the X-axis (m/z) display range.

### Summary Statistics

A statistical summary of the current data is displayed below the spectrum:

| Stat | Continuous Mode | Processed Mode |
|---|---|---|
| Peak count | Number of detected peaks | Number of peaks at this pixel |
| Intensity range | Min / Max intensity | Min / Max intensity |
| Selected m/z | Current m/z ± tolerance | — |
| Pixel coordinates | — | (x, y) of the selected pixel |

### Retry

If spectrum loading fails, an error message and **Retry** button are displayed. Click to reload.

---

## 7. Right Panel

### Display Range

- Shows the current Min / Max intensity values and their corresponding percentiles.

### Statistical Histogram

- An intensity distribution histogram.
- Red marker lines indicate the position of the current displayMin / displayMax within the distribution.
- Text stats: **Dimensions** (total pixel count), **Non-zero** (non-zero pixel ratio), **TIC** (total ion current).

### Metadata (Info)

Displays the dataset's acquisition and analysis parameters:

| Field | Description |
|---|---|
| Polarity | positive / negative |
| Analyzer | Analyzer type (e.g. Q-TOF) |
| Ionisation Source | Ion source (e.g. ESI, MALDI) |
| Pixel Size | Pixel dimensions (μm) |
| Spectrum Mode | centroid / profile |
| Storage Mode | continuous / processed |

### Preprocessing Methods

Lists the preprocessing methods applied to this dataset during analysis.

![view-16](https://official-oss.oss-cn-hongkong.aliyuncs.com/docs/view-16.png)

---

## 8. ROI Analysis

Draw regions of interest on the ion image to focus statistical analysis or comparison on specific tissue areas.

### Drawing Tools

The **Region of interest** section in the right panel provides two drawing modes:

| Tool | How to use | Visual style |
|---|---|---|
| **Rectangle** | Click and drag on the image to draw a rectangle. Corner handles allow resizing; click inside to reposition. | Red semi-transparent fill + red stroke |
| **Lasso** | Click point by point to draw a polygon. The path auto-closes (minimum 5 points). | Blue stroke |

### Confirming & Managing

- After drawing, click **Confirm** to finalize the ROI. The system automatically calculates statistics (pixel count, mean, std dev, min, max, sum).
- Click **Cancel** to discard the current draft.
- Confirmed ROIs appear in the list, each with a color label. Delete individually or use **Clear All** to remove all.
- Up to 6 colors are assigned, cycling as needed.

**Drawing an ROI:**

![view-17](https://official-oss.oss-cn-hongkong.aliyuncs.com/docs/view-17.png)

**Confirming an ROI:**

![view-18](https://official-oss.oss-cn-hongkong.aliyuncs.com/docs/view-18.png)

### Viewing ROI Mode

After confirming an ROI, the image automatically switches to **Viewing ROI** mode — only pixels within the ROI area are shown, the rest are hidden for focused analysis.

**Multiple selections**: You can draw and confirm multiple ROIs in sequence. The system displays the union of all confirmed ROIs — pixels belonging to any ROI are retained, all others remain hidden. Click **Reset** to restore the full image.

> To draw a new ROI in a different area, click **Reset** first to restore the full image. Otherwise Viewing ROI mode will only show pixels within existing ROI boundaries.

![view-19](https://official-oss.oss-cn-hongkong.aliyuncs.com/docs/view-19.png)

---

## 9. Usage Tips

- Selection between the ion image and spectrum is bidirectional — making it easy to home in on an m/z of interest.
- The zoom center follows your cursor — position the mouse precisely to zoom into the area of interest.
- The slider at the bottom of the spectrum is ideal for quickly navigating m/z ranges, especially for wide mass range data.
- Initial loading may take a few seconds — please be patient.
