# Uploading Data

This page describes how to upload mass spectrometry imaging (MSI) data to the SpatialXomics platform.

## 1. Supported Formats

The platform supports **imzML data pairs**: a `.imzML` file (metadata / spectrum index) together with its matching `.ibd` file (binary spectrum data). The two files must share the **same base filename** (only the extension differs).

## 2. Steps

### 2.1 Enter the Upload Page

After signing in, navigate to the **My Datasets** page via the navigation bar and click the **Upload New Dataset** button to open the upload dialog.

![Enter upload](https://official-oss.oss-cn-hongkong.aliyuncs.com/docs/1.png)

### 2.2 Select Files

Click the **Choose Files** button and select both the `.imzML` and `.ibd` files from your local machine. The system will automatically verify that the two files are a matching pair (same base filename) and display the filenames and total size below.

![Select files](https://official-oss.oss-cn-hongkong.aliyuncs.com/docs/2.png)

### 2.3 Fill in Metadata

After file selection, the system automatically parses metadata from the imzML file and pre-fills the following fields (e.g., Polarity, Ionisation Source, Analyzer, Pixel Size). For metadata not present in the file, please complete the fields manually.

![Fill in metadata](https://official-oss.oss-cn-hongkong.aliyuncs.com/docs/3.png)

![Fill in metadata](https://official-oss.oss-cn-hongkong.aliyuncs.com/docs/4.png)

Metadata is organized into two groups:

**Acquisition Information**

| Field | Description |
|------|------|
| Polarity | Positive / Negative ion mode |
| Ionisation Source | Ion source type |
| Analyzer | Analyzer type |
| Pixel Size X / Y | Pixel size in μm (range: 1–200) |
| Spectrum Mode | Profile / Centroid |
| Storage Mode | Continuous / Processed |
| Solvent | Solvent composition (see "Adding Solvents" below) |
| MALDI Matrix | MALDI matrix (required when ion source is MALDI) |
| MALDI Matrix Application | Matrix application method (required when ion source is MALDI) |
| Detector Resolving Power | m/z and Resolving Power (optional) |

**Sample Metadata**

| Field | Description |
|------|------|
| Organism | Organism species |
| Organism Part | Tissue / organ part |
| Condition | Sample condition |
| Sample Stabilization | Stabilization method |
| Sample Growth Conditions | Growth conditions (optional) |
| Tissue Modification | Tissue modification (optional) |

> Fields marked with \* are required.

#### Adding Solvents

Solvents are added via the **Solvent Picker**: enter a percentage value (1–100) in the input field, select a solvent type from the dropdown, and click the **+** button to add it to the list. Multiple solvent combinations are supported. If you are unsure of the exact solvent composition, keep the default `100% Water`.

![Add solvent](https://neonexus-picture.oss-ap-southeast-1.aliyuncs.com/test/image-20260703120422329.png)

### 2.4 Set Public / Private

Check the **Make dataset public (visible to others)** checkbox to publish the dataset as public, visible to all users. Leave it unchecked to keep it private.

![Public option](https://neonexus-picture.oss-ap-southeast-1.aliyuncs.com/test/image-20260703115054607.png)

> If you choose to make the dataset public, a confirmation dialog will appear after clicking submit. Once confirmed, the dataset will be visible to all users.

### 2.5 Submit the Upload

Once all information is confirmed, click the **Confirm & Upload** button to submit.

![Confirm submit](https://neonexus-picture.oss-ap-southeast-1.aliyuncs.com/test/image-20260703115249346.png)

The system will then display the upload progress panel, showing the current percentage, upload speed, and estimated time remaining. To cancel, click the **Abort Upload** button.

![Upload progress](https://neonexus-picture.oss-ap-southeast-1.aliyuncs.com/test/image-20260703115800703.png)

During the upload, the system automatically checks whether the data already exists on the server. If another user has already uploaded identical data, the backend will reuse the existing copy, eliminating the need to upload again and saving significant time.

## 3. Resume & Retries

### Resume Upload

If the page is closed or the network is interrupted during upload, a **resume prompt** will appear when the upload dialog is reopened. Click **Resume** to continue from the last breakpoint without re-selecting files or re-entering metadata.

![Resume prompt](https://neonexus-picture.oss-ap-southeast-1.aliyuncs.com/test/image-20260703115821860.png)

Click **Discard** to clear the resume state and start a new upload.

### Automatic Retries

If a single part upload fails, the system will automatically retry. The user is only prompted for manual intervention after multiple retry attempts have been exhausted.

## 4. Tips

- Before uploading, ensure that the base filenames (excluding extensions) of the `.imzML` and `.ibd` files are exactly identical.
- Hashing and compression for large files run asynchronously in the background — you may continue browsing other pages while they complete.
- If an upload fails, first verify that the filenames match and the network is stable, then use the resume feature to restart the upload.