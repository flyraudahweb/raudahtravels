# Google OAuth Setup Guide (Production)

How to configure Google Sign-In for production so the consent screen shows **"Raudah Travels & Tours"** instead of Clerk's shared app name, and so Google login works on your custom domain.

---

## Why This Is Needed

In development, Clerk uses its own shared Google OAuth credentials automatically — the "Continue with Google" button works out of the box. However in production you must create your own Google credentials because:

1. **Branding** — Google's consent screen will show your app name ("Raudah Travels & Tours") instead of a generic name
2. **Domain verification** — Google requires your production domain to be registered
3. **Trust** — Users see your verified business name, not an unknown shared app

---

## Step 1 — Create a Google Cloud Project

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Click the project selector at the top → **New Project**
3. Name it: `Raudah Travels & Tours`
4. Click **Create**
5. Make sure the new project is selected in the top bar

---

## Step 2 — Configure the OAuth Consent Screen

1. In the left sidebar: **APIs & Services → OAuth consent screen**
2. Select **External** (for any Google account) → **Create**
3. Fill in:

| Field | Value |
|---|---|
| App name | `Raudah Travels & Tours` |
| User support email | Your support email |
| App logo | Upload your logo (optional but recommended) |
| App domain | `https://yourdomain.com` |
| Authorized domains | `yourdomain.com` |
| Developer contact email | Your email |

4. Click **Save and Continue**
5. On the **Scopes** page — click **Save and Continue** (no extra scopes needed)
6. On the **Test users** page — click **Save and Continue**
7. Click **Back to Dashboard**

> **Note:** Your app starts in "Testing" mode. Up to 100 test users can sign in. To allow all users, click **Publish App** on the consent screen page.

---

## Step 3 — Create OAuth Credentials

1. In the left sidebar: **APIs & Services → Credentials**
2. Click **+ Create Credentials → OAuth client ID**
3. Application type: **Web application**
4. Name: `Raudah Travels Production`
5. Under **Authorized JavaScript origins**, add:
   ```
   https://yourdomain.com
   ```
6. Under **Authorized redirect URIs**, add the Clerk callback URL:
   ```
   https://accounts.yourdomain.com/v1/oauth_callback
   ```
   > Get your exact redirect URI from: **Clerk Dashboard → Configure → SSO Connections → Google → Redirect URI**

7. Click **Create**
8. A dialog shows your **Client ID** and **Client Secret** — copy both

---

## Step 4 — Add Credentials to Clerk

1. Go to [dashboard.clerk.com](https://dashboard.clerk.com) → select your app
2. Make sure you're on the **Production** instance (top-left dropdown)
3. Navigate to **Configure → SSO connections → Google**
4. Toggle Google **on** if not already
5. Under **Use custom credentials**:
   - Paste your **Client ID**
   - Paste your **Client Secret**
6. Click **Save**

---

## Step 5 — Publish the Google App

While in "Testing" mode, only the 100 test users you manually add can sign in with Google. To open it to everyone:

1. Go back to [console.cloud.google.com](https://console.cloud.google.com) → **OAuth consent screen**
2. Click **Publish App**
3. If Google asks for verification (only required if you request sensitive scopes — you don't), follow the verification process. For basic sign-in this is instant.

---

## Step 6 — Test

1. Open your production app in an incognito window
2. Go to Sign In → **Continue with Google**
3. Verify the Google consent screen shows **"Raudah Travels & Tours"** with your logo
4. Complete sign-in and confirm the profile syncs correctly in your app

---

## Clerk Production Instance

> **Important:** Development keys (`pk_test_` / `sk_test_`) cannot be used in production. You must switch to production keys.

1. In Clerk Dashboard, click the instance selector (top-left) → **Create production instance** (or switch to existing production)
2. Copy the new `pk_live_` and `sk_live_` keys
3. Update your server environment variables:
   - `CLERK_PUBLISHABLE_KEY` → `pk_live_...`
   - `CLERK_SECRET_KEY` → `sk_live_...`
   - `VITE_CLERK_PUBLISHABLE_KEY` → `pk_live_...`
4. In Clerk Production → **Domains**, add your production domain

---

## Summary Checklist

- [ ] Google Cloud project created
- [ ] OAuth consent screen configured with "Raudah Travels & Tours" name and logo
- [ ] OAuth client ID created with correct redirect URI from Clerk
- [ ] Client ID + Secret pasted into Clerk Dashboard → Google SSO
- [ ] Google app published (not in Testing mode)
- [ ] Clerk switched to Production instance with `pk_live_` keys
- [ ] Production domain added to Clerk Domains
- [ ] Sign-in tested end-to-end in incognito browser

---

## Authorized Redirect URI Format

Clerk's redirect URI follows this pattern:

```
https://accounts.<your-clerk-frontend-api-domain>/v1/oauth_callback
```

The exact URL is shown in **Clerk Dashboard → Configure → SSO Connections → Google**. Always copy it from there — it may differ slightly between development and production instances.

---

*Last updated: May 2026*
