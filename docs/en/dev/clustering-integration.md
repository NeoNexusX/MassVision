# Clustering Integration

> Aligned with the frontend implementation on 2026-08-24. This page documents the contract used by the current UI and readers; it does not promise backend behavior that the code does not rely on.

## Scope

- UMAP is available only for `continuous` results and is generated asynchronously by the backend.
- KMeans does not call a backend clustering API. It runs in the browser with `ml-kmeans` over the UMAP embedding.
- UMAP and the main algorithm output share one run Zarr. There is no separate clustering Zarr.

## Frontend Flow

```text
Open a Continuous result
  └─ Silently probe analysis/umap
       ├─ Present: load it and enable UMAP/KMeans
       └─ Missing/read error: remain disabled until user confirmation

User confirms Generate UMAP
  └─ POST /processes/{run_id}/clustering (no body)
       ├─ completed: read Zarr; only a successful read marks it ready
       ├─ failed / error_message: stop polling and show the error
       └─ any other status: POST again every 5 seconds
```

Only one polling timer is maintained, and it is stopped when the run changes or the component unmounts. A transient request error does not immediately terminate polling; completed and failed states do. The current error-row `Retry` rereads Zarr data—it should not be documented as creating a new backend task.

## Clustering Task Endpoint

```http
POST /processes/{run_id}/clustering
Authorization: Bearer <token>
```

- Path parameter: `run_id`
- Request body: none
- The frontend requires a numeric `id`; a missing ID makes the response invalid.
- Response fields used by the current flow:

| Field | Use |
|---|---|
| `id` | Validate the task response |
| `clustering_status` | Decide whether to complete, fail, or keep polling |
| `error_message` | A non-null value is treated as failure and displayed |
| `status`, `finished_at`, etc. | Retained in the type but do not drive the current clustering UI |

The frontend treats this POST as create-or-fetch/status-check. Do not extend the docs into a blanket idempotency guarantee for every state. In particular, the current UI stops automatic POST calls after failure.

## Zarr Access

```http
GET /processes/{run_id}/zarr
Authorization: Bearer <token>
```

Current response shape:

```json
{
  "folder_path": "processed/run_45.zarr/",
  "bucket": "bucket-name",
  "region": "cn-hangzhou",
  "sts_token": {
    "AccessKeyId": "...",
    "AccessKeySecret": "...",
    "SecurityToken": "...",
    "Expiration": "2026-08-24T12:00:00Z"
  },
  "expires_in": 3600
}
```

Do not add the removed `zarr_type=clustering` parameter. Main algorithm data and `analysis/umap` are read from the same directory named by `folder_path`. The OSS client refreshes STS before expiry and also refreshes plus retries once after token-expired/403 errors.

## Zarr v3 Contract

```text
<root>/zarr.json
<root>/analysis/umap/zarr.json
<root>/analysis/umap/coordinates/zarr.json
<root>/analysis/umap/scaled_embedding/zarr.json
```

| Data | Type and shape | Convention |
|---|---|---|
| Root attribute `spatial_shape` | `[height, width]` | Raster dimensions; never derive them from coordinate maxima |
| `coordinates` | `uint32[n, 2]` | `(x, y)`, already zero-based; do not subtract root `coordinate_base` |
| `scaled_embedding` | `float32[n, 3]` | Three-dimensional UMAP values expected in `[0, 1]` |

The exact group path is `analysis/umap`, not the obsolete `anay` spelling.

`ClusteringZarrStore` validates the Zarr v3 group, array dtypes/shapes, and equal row counts. Rasterization is:

```text
R = round(scaled_embedding[i, 0] * 255)
G = round(scaled_embedding[i, 1] * 255)
B = round(scaled_embedding[i, 2] * 255)
pixel = coordinates[i] = (x, y)
```

Grid cells without data remain `(0, 0, 0)` and become transparent when converted to the page RGBA overlay or exported PNG. The UMAP overlay dimensions must match the ion image.

## Local KMeans

- Input is raw `coordinates` plus `scaled_embedding`, not the raster PNG.
- The user may choose `k = 2–20`; the initial value is 5.
- Computation runs in `kmeans.worker.ts`; the current seed is 42 and maximum iteration count is 30.
- Labels map back to the `spatial_shape` grid, with `-1` for background.
- Rerunning replaces the current result; cluster selection controls both overlay and export mask.
- The current frontend neither needs nor reads backend KMeans label/color arrays from Zarr.

## Key Files

| File | Responsibility |
|---|---|
| `src/services/clustering/api/clusteringApi.ts` | POST the clustering task |
| `src/services/clustering/clusteringZarrStore.ts` | Read and rasterize UMAP arrays |
| `src/services/zarr/api/zarrAccessApi.ts` | Get Zarr/STS access for the same run |
| `src/features/workspace/results/composables/useOverlayData.ts` | Probe, poll, overlay, export, and cache lifecycle |
| `src/features/workspace/results/utils/kmeans.ts` | KMeans scheduling and validation |
| `src/features/workspace/results/utils/kmeans.worker.ts` | Local worker computation |

When the endpoint, group path, dtype/shape, coordinate base, or status values change, update the types, reader, result-page state machine, and both language versions of this page together.
