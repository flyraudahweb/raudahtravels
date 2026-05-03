# Gmail SMTP Setup Guide

How to configure a Gmail account as your SMTP sender so Raudah Travels & Tours can send branded payment receipts directly from your Gmail address.

---

## Prerequisites

- A Gmail or Google Workspace account (e.g. `team@flyraudah.com.ng`)
- 2-Factor Authentication enabled on that account

---

## Step 1 — Enable 2-Factor Authentication

Gmail requires 2FA before you can create App Passwords.

1. Go to [myaccount.google.com](https://myaccount.google.com)
2. Click **Security** in the left sidebar
3. Under *How you sign in to Google*, click **2-Step Verification**
4. Follow the prompts to enable it (use your phone number or authenticator app)

---

## Step 2 — Create an App Password

An App Password is a 16-character code that lets a non-browser app (like your server) send email on your behalf — without needing your real Gmail password.

1. Go to [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords)
   *(You must be signed in and have 2FA enabled for this link to work)*
2. In the **App name** field, type: `Raudah Travels`
3. Click **Create**
4. Google shows you a 16-character password like: `abcd efgh ijkl mnop`
5. **Copy it immediately** — Google only shows it once
6. Remove the spaces when you paste it into Settings: `abcdefghijklmnop`

---

## Step 3 — Configure in Admin Settings

1. Open your app and go to **Admin → Settings**
2. Scroll down to the **Email** section
3. Select the **Gmail SMTP** tab
4. Fill in the fields:

| Field | Value |
|---|---|
| SMTP Host | `smtp.gmail.com` |
| Port | `587` |
| Username / Email | Your full Gmail address, e.g. `team@flyraudah.com.ng` |
| Password / App Password | The 16-character App Password from Step 2 (no spaces) |
| From Name | `Raudah Travels & Tours` |
| From Email | Same as Username |
| SSL/TLS | **Off** (use STARTTLS on port 587) |

5. Click **Save SMTP Settings**

---

## Step 4 — Test

Make a test payment booking and confirm a receipt email arrives in the pilgrim's inbox. Check the **Spam** folder if it doesn't appear in the inbox — you may need to mark it as "Not Spam" the first time.

---

## Troubleshooting

**"Username and password not accepted"**
- Make sure you're using the App Password, not your regular Gmail password
- Confirm the App Password has no spaces
- Check that 2FA is still active on the account

**"Less secure app access"**
- This setting no longer applies. Google removed it in 2022. App Passwords are the correct method.

**Emails going to spam**
- Consider switching to **Resend** (see Settings → Email → Resend tab) for better deliverability
- Or add a custom domain and configure SPF/DKIM records

**Daily sending limit**
- Gmail App Passwords allow ~500 emails/day
- For higher volumes, use Resend (3,000/month free) or a dedicated SMTP service

---

## Google Workspace (G Suite) Notes

If your Gmail is a custom domain through Google Workspace (e.g. `team@flyraudah.com.ng`):
- The setup is identical — use `smtp.gmail.com` host
- Create the App Password under the Workspace account's Google account settings
- Your Workspace admin may need to allow App Passwords under Admin Console → Security → API Controls

---

## SMTP Settings Reference Card

```
Host:     smtp.gmail.com
Port:     587
Security: STARTTLS (SSL/TLS off)
Username: your.email@gmail.com
Password: [16-char App Password, no spaces]
```

*Last updated: May 2026*
