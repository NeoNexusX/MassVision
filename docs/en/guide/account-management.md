# Account Management

Register, sign in, recover your password, and manage your profile on SpatialXomics. Administrators can also manage platform users.

**Author:** Chen Kejiang

**Feedback:** Found a bug or have a suggestion? Open a [GitHub Issue](https://github.com/NeoNexusX/MassVision/issues) or email **jydong@xmu.edu.cn**.

## Register

1. Choose a username, enter your email, and set a password (typed twice for confirmation).
2. Click **Send Code** to receive a verification code — the username, email, password, and confirmation must already be filled in correctly.
3. Complete your basic profile information: institution, position, region, and research field are required; ORCID and homepage are optional.
4. Finish registration.

![Registration form](https://official-oss.oss-cn-hongkong.aliyuncs.com/docs/20260908150833177.jpg_view)

## Sign In

After registering, sign in with your username and password.

![Sign in form](https://official-oss.oss-cn-hongkong.aliyuncs.com/docs/20260908151359974.jpg_view)

## Reset Your Password

Forgot your password? Click **Forgot Password?** on the sign-in page. The flow has two steps:

1. Enter the registered email and click **Send Code**. Use **Resend** if the code doesn't arrive, or **Change email** to fix a typo.
2. Enter the code and a new password (twice for confirmation), then click **Reset Password**. Sign back in with the new password.

<!-- Image placeholder: password recovery flow -->

## Edit Your Profile

Click your avatar in the top-right corner, then select **Profile**. From there you can update your email, password, and academic profile details. Your username and identity are fixed and cannot be changed. Click **Save All Changes** when you are done.

Changing your email requires a verification code sent to the new address. Saving a new password signs you out automatically — sign back in with the new password.

![Profile page](https://official-oss.oss-cn-hongkong.aliyuncs.com/docs/20260908160212186.jpg_view)

## Quotas

The profile page reports how much of each account quota you have used. All four cards show **used over maximum** with a progress bar:

- **Storage Upload** — uploaded storage
- **Files** — number of uploaded files
- **Processing** — data-processing allowance
- **Downloads** — download allowance

![Quota info](https://official-oss.oss-cn-hongkong.aliyuncs.com/docs/20260908160325443.jpg_view)

## User Management (Administrators Only)

Administrators open the user management page via **Users** in the avatar menu; non-admins are redirected to their profile page. The page provides:

- **Summary cards** — counts of administrators, users, and institutions
- **Find users** — search by username; filter by status (Active / Inactive), institution, and region
- **User table** — username, identity (admin / user), status, institution, region, view
- **Detail drawer** — click **View** to inspect the user's profile and current usage, and to edit and save their quotas (files / storage / processing / downloads)
- **Delete user** — only non-administrators other than yourself can be deleted, after confirmation

Note that identity (admin / user) is read-only — there is no role editing or enable/disable action.

<!-- Image placeholder: user management page and detail drawer -->
