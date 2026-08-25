# Viewing Data

Results can be reached through one-click **Explore / Visualize** on a dataset card or **View** on a completed custom analysis in the Workspace.

## Create or Open a Result

### Explore / Direct conversion

1. Find a dataset under Public Datasets or My Datasets.
2. **Explore** means no default visualization exists. Click it, then choose **Generate** in **Prepare Visualization**.
3. The backend creates a `/processes/raw-convert` task. The task owner is sent to the Workspace; if another user already owns the shared default task, the card later changes to **Visualize**.
4. **Visualize** means the card has a `defaultRunId`; clicking it opens the result with task context.

### Workspace results

Click **View** on a completed Workspace result. Processing rows do not offer View; failed results expose their error and can be deleted.

The route is `/workspace/results`, but the run ID, dataset name, and methods arrive through browser history state. Opening or refreshing the bare URL may show **No result selected**; enter again from the Workspace or dataset card.

## Layout

On desktop, the page contains:

- A collapsible **Annotations** rail on the left.
- **Image View** above **Spectrum View** in the center.
- Metadata, range, statistics, Visualization, clustering, and ROI controls on the right.
- Collapsible **Compare regions / Comparison results** below the main visualization.

Small screens stack these sections vertically. `resultFeatures.annotation` and `resultFeatures.compare` in `public/config.json` can disable the respective panels, so deployments may differ.

## Continuous and Processed Modes

| Mode | Image | Spectrum | Advanced features |
|---|---|---|---|
| Continuous | Ion-intensity image for one m/z | Mean spectrum; click to change m/z | UMAP and KMeans; annotation and region comparison for Centroid data |
| Processed | TIC image | Per-pixel spectrum after clicking the image | ROIs; two or more ROIs can be compared for Centroid data |

The Zarr `row_axis` and `encoding` determine the mode automatically.

## Image View

### Navigation and Pixel Information

- Use the wheel to zoom around the pointer. Above 1×, drag with the primary button to pan.
- The bottom-right `− / scale / +` control changes zoom; a reset button appears when zoomed in.
- Hover displays 1-based pixel coordinates and intensity.
- In Processed mode, clicking a pixel shows its coordinates in the toolbar and loads its spectrum.

### Toolbar

| Control | Behavior |
|---|---|
| m/z | Current value in Continuous mode |
| Tolerance ± | Continuous m/z tolerance, clamped to `0.001–1`; default `0.05` |
| Colormap | Viridis, Inferno, Magma, Hot, Gray |
| Intensity scale | Linear, Log, plus TIC norm for Continuous Zarr data with `stats/tic` |
| Reset | Restores tolerance `0.05`, Inferno, Linear, Gamma `1.0`, and automatic range |
| PNG | Exports the current image and visible overlay with a transparent background |

TIC norm divides each pixel by precomputed `stats/tic`. If loading fails, the original image remains and the control exposes the error.

### Display Range and Gamma

- The initial range is `0` through P95 of non-zero intensity; the true maximum remains visible above the strip.
- Drag the Min/Max handles on the image strip or type values under **Display range**.
- Use the strip reset button to restore the automatic range.
- **Gamma** ranges from `0.5` to `1.5`, default `1.0`.
- **Statistic** shows a histogram, Dimensions, Non-zero, and TIC. **Info** shows acquisition/mode metadata, and **Preprocessing** lists task methods.

## Spectrum View

Continuous mode shows the result mean spectrum:

- Click to select the nearest m/z and refresh Image View.
- A marker tracks the current m/z; selections from annotation and comparison tables use the same m/z index.
- Centroid data uses peak bars, while Profile data uses a continuous line.

Processed mode shows instructions until a TIC pixel is clicked, then loads that pixel's spectrum. The heading remains **Spectrum View**; footer statistics switch between Peaks, Intensity, Selected/Tolerance, and Pixel as appropriate. Use **Retry** after a load error.

## UMAP and KMeans

These controls appear only in Continuous mode.

1. Turn on **Enable UMAP / KMeans**. First use asks for confirmation, then calls `POST /processes/{run_id}/clustering` to create or fetch the backend UMAP task.
2. While incomplete, the frontend checks every 5 seconds; **Refresh** checks immediately. Automatic polling stops on failure and retry remains user-initiated.
3. On completion, the frontend reads `coordinates` and `scaled_embedding` from `analysis/umap` in the run's Zarr and rasterizes the UMAP overlay in the browser.
4. Click **KMeans** and choose k from `2–20`. `ml-kmeans` runs locally over the UMAP embedding; no backend KMeans array is read.

UMAP and KMeans overlays are mutually exclusive. Adjust opacity and export transparent PNGs. KMeans also supports individual cluster selection, All/Clear, and re-running with another k. Export respects the currently selected clusters.

## ROIs

Under **Region of interest**:

- **Rect**: drag a rectangle, then move it or resize with handles.
- **Lasso**: hold and draw a freeform outline, then drag inside to move it.

Choose **Confirm** or **Cancel** when the draft is ready. A confirmed ROI gets its own color and displays Pixels, Mean, Std, Min, and Max. The image switches to **ROI only**; multiple ROIs are unioned. Toggle **ROI only / Show all**, delete individually, or use **Clear all**.

Displayed ROI statistics describe the current m/z/current TIC image at confirmation time. Region comparison uses the ROI pixel masks to rescan spectrum data rather than reusing those displayed image statistics.

## Region Comparison

Region comparison is available only for **Centroid** data. Candidate regions are:

- Local KMeans clusters for Continuous results.
- Confirmed ROIs in the current result.

At least two regions are required. A and B may each contain multiple members; members are unioned within a group, and one region cannot belong to both groups.

Controls:

- **Min detection rate**: `1–50%`.
- **Intensity threshold**: intensity percentile from `0–20%`.

**Compare** streams spectrum chunks from Zarr and can be cancelled. The table contains m/z, Mean A/B, A/B, Det A/B, and Category, with filters for `A only`, `B only`, `A enriched`, `B enriched`, and `Shared`. Clicking a row changes Image View m/z and synchronizes annotation selection.

## Annotation CSV

Annotation matching requires **Continuous + Centroid** data and a loaded mean spectrum.

### File Contract

- UTF-8 and UTF-8 BOM are supported; comma, semicolon, tab, and `|` delimiters are detected automatically.
- A recognized m/z column is required, such as `Exp. m/z`, `Tar. m/z`, `mz`, `m/z`, `experimental_mz`, or `mass`.
- Names may come from `Candidate_1` through any `Candidate_N`, or a single `Candidate` column.
- Optional columns include `formula_ion` / `formula` and `Ion type` / `adduct`.

### Use

Click **Import CSV** or drop a file onto the panel. Parsing and matching run in a Web Worker; large tables use virtual scrolling.

- Match tolerance supports ppm or Da.
- Filter by match status, search names/formulas/m/z, and sort the table.
- Rows that clearly imply the opposite polarity or fall outside the spectrum m/z range are removed before matching, with a visible count.
- Clicking a matched row changes Image View. The hover card shows matched m/z, mass difference, mean intensity, and candidate names.
- Use **PubChem** to inspect a candidate. The download button exports matched rows; the trash button clears the import.

## Performance and Error Handling

- Zarr chunks are read from OSS with temporary STS credentials. The client refreshes credentials near expiry or once after a 403/token failure.
- m/z changes keep the last successful image; a loading overlay appears only after 250 ms, and failures preserve the old image with an error message.
- Region comparison uses a separate spectra LRU cache and configurable concurrency under the `zarr` block in `public/config.json`.
