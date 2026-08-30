# Downloading Data

A dataset download returns the two original uploaded files, `.imzML` and `.ibd`. It is separate from result-page PNG export and does not download the analysis Zarr.

## Requirements

- You must be signed in. Public datasets remain browsable while signed out, but clicking download shows a prompt and redirects to `/login`.
- Public datasets use the public download client; personal datasets use the authenticated client. The UI selects this automatically.
- Only one download request can be active in the same frontend session.

## Download Entry Points

- **Public Datasets** or **My Datasets**: click **Download** on a dataset card.
- **Dataset Overview**: click **Download** in the primary overview card.

The frontend calls `/files/{file_id}/download_raw`, receives pre-signed OSS URLs for imzML and ibd, and starts each file in a separate hidden iframe. Separate browsing contexts prevent the second file from cancelling the first.

## Cooldown

After a download starts successfully, the frontend applies a **60-second** cooldown:

- Another click during cooldown shows `Download is limited. Please wait Xs.`.
- A click while a request is still active shows `A download is already in progress.`.
- A failed request does not start the cooldown, so it can be retried immediately.

The current frontend does not implement a separate per-account download-count quota. If the backend rejects a download, its error message is shown directly.

## Troubleshooting

- Your browser may ask for permission to download multiple files from the site. Allow it in site permissions if either file is blocked.
- The two files may appear in the browser's download list at slightly different times.
- Pre-signed URLs expire. If a transfer stalls for a long time, click download again to obtain fresh URLs.
- A **Packing** label means another download-preparation flow is active; wait for it to finish.
