# Uploading Data

This page describes how to upload mass spectrometry imaging (MSI) data to the SpatialXomics platform.

## 1. Supported Formats

- **imzML data pair**: a `.imzML` file (metadata / spectrum index) together with its matching `.ibd` file (binary spectrum data). The two files must share the **same base filename** (only the extension differs), otherwise they cannot be paired and recognized for upload.

## 2. Steps

1. Click the button on the right and sign in to your personal account.

![image-20260703113729368](https://neonexus-picture.oss-ap-southeast-1.aliyuncs.com/test/image-20260703113729368.png)

2. Navigate to your personal datasets page and click the **Upload** button to open the upload dialog.

![image-20260703113834009](https://neonexus-picture.oss-ap-southeast-1.aliyuncs.com/test/image-20260703113834009.png)

3. Select the local `.imzML` and `.ibd` file pair (by clicking or drag-and-drop), and complete the dataset metadata (e.g., analyzer type, ionization source, pixel size, etc.).

![image-20260703114021254](https://neonexus-picture.oss-ap-southeast-1.aliyuncs.com/test/image-20260703114021254.png)

4. Fill in the dataset metadata: the system will first attempt to parse and pre-fill fields automatically from the file. For any metadata not present in the file, please complete the fields manually.

<img src="https://neonexus-picture.oss-ap-southeast-1.aliyuncs.com/test/image-20260703114430946.png" alt="image-20260703114430946" style="zoom: 50%;" />

**If you wish to publish the dataset as a public dataset, please select the corresponding option:**

<img src="https://neonexus-picture.oss-ap-southeast-1.aliyuncs.com/test/image-20260703115054607.png" alt="image-20260703115054607" style="zoom:67%;" />

**After entering the solvent information, click the plus icon on the right to add it to the list and confirm the entry:**

<img src="https://neonexus-picture.oss-ap-southeast-1.aliyuncs.com/test/image-20260703120422329.png" alt="image-20260703120422329" style="zoom:50%;" />

If you are unsure of the exact solvent composition, select `100% Water` as the default. If the solvent is known, please select the corresponding option.

Once all information is confirmed, click **Confirm** to submit the upload task:

<img src="https://neonexus-picture.oss-ap-southeast-1.aliyuncs.com/test/image-20260703115249346.png" alt="image-20260703115249346" style="zoom: 50%;" />

<img src="https://neonexus-picture.oss-ap-southeast-1.aliyuncs.com/test/image-20260703115800703.png" alt="image-20260703115800703" style="zoom:50%;" />

During the upload, the system computes a hash of the data and compares it against the full database. If another user has already uploaded identical data, the backend will automatically reuse the existing copy, eliminating the need to upload again.

## 3. Resuming & Retries

- The multipart upload state (including `uploadId`, completed parts, credential expiry, etc.) is persisted to local storage. If the page is closed or the network is interrupted during upload, a **resume prompt** will appear when the upload dialog is reopened. Click it to continue from the last breakpoint, without the need to re-compress or re-hash the file.

<img src="https://neonexus-picture.oss-ap-southeast-1.aliyuncs.com/test/image-20260703115821860.png" alt="image-20260703115821860" style="zoom:50%;" />

- If a single part upload fails, the system will automatically initiate a retry. The user is only prompted for manual intervention when retries are exhausted.

## 4. Tips

- Before uploading, please ensure that the base filenames (excluding extensions) of the `.imzML` and `.ibd` files are exactly identical.
- Hashing and compression for large files run asynchronously in the background — you may continue browsing other pages while they complete.
- If an upload fails, it is recommended to first verify that the filenames match and that the network is stable, and then use the resume feature to restart the upload.