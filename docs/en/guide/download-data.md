# Downloading Data

This page explains how to download raw MSI data (`.imzML` / `.ibd` file pairs) from the SpatialXomics platform.

## 1. Before You Download

- **Login required**: You must be logged in to download. Clicking the download button while not authenticated will redirect you to the login page with a prompt.
- **Original file pairs**: Each download delivers both the `.imzML` and `.ibd` files for the dataset.
- **Rate limit**: A cooldown period (1 minute) is enforced between consecutive downloads to prevent excessive requests.
- **Download quota**: Each account has a download limit managed by the administrator. Contact your admin if you exceed it.

## 2. Steps

#### 1. Download from the dataset list

Each dataset card on the **Public Datasets** or **My Datasets** page includes a download button. Click it to start downloading.

![download-1](https://official-oss.oss-cn-hongkong.aliyuncs.com/docs/download-1.png)

#### 2. Login redirect for unauthenticated users

If you are not logged in, clicking download shows a warning toast and redirects you to the login page. After logging in, return to the list and try again.

![download-2](https://official-oss.oss-cn-hongkong.aliyuncs.com/docs/download-2.png)

#### 3. Download from the dataset detail page

Click a dataset card to open its **Overview** page. A download button is also available there — login is still required.

![download-3](https://official-oss.oss-cn-hongkong.aliyuncs.com/docs/download-3.png)

#### 4. Download status feedback

Once clicked, a toast notification appears at the top (Downloading… / Download started). Your browser will then download the `.imzML` and `.ibd` files in sequence.

![download-4](https://official-oss.oss-cn-hongkong.aliyuncs.com/docs/download-4.png)

![download-5](https://official-oss.oss-cn-hongkong.aliyuncs.com/docs/download-5.png)

## 3. Download Limits

- **Cooldown**: A 60-second cooldown is enforced between downloads. During the cooldown you will see "Download is limited. Please wait Xs."

![download-6](https://official-oss.oss-cn-hongkong.aliyuncs.com/docs/download-6.png)

- **Quota**: Each account has a maximum download count. Contact your administrator if you need an increase.

![download-7](https://official-oss.oss-cn-hongkong.aliyuncs.com/docs/download-7.jpg)

## 4. Tips

- If nothing happens after clicking download, check whether your browser is blocking multiple-file downloads. Allow downloads for this site in your browser settings.
- If a download fails, check your network connection first, then retry.
- If downloads consistently fail, your account quota may be exhausted — contact your administrator.
