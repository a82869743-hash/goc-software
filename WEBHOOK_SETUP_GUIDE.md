# GOC Studio — Webhook Integration Setup Guide

This guide details how to configure automatic lead capture from Facebook, Instagram, and WhatsApp into the GOC Studio CRM.

---

## Facebook & Instagram Lead Ads Setup

Facebook and Instagram share the Meta Webhook configuration via the Meta Developer portal.

### Step 1: Create a Facebook App
1. Go to the [Meta App Dashboard](https://developers.facebook.com/apps).
2. Click **Create App** and choose the **Business** app type.
3. Set your App Name (e.g., `GOC Studio CRM Integration`) and click **Create App**.

### Step 2: Configure Webhook Product
1. In your App Dashboard, scroll to **Add a Product** and click **Set Up** on the **Webhooks** product card.
2. In the dropdown at the top, select **Page** object, and click **Subscribe to this object**.
3. Fill in the parameters:
   - **Callback URL:** `https://your-server-domain.com/api/v1/webhooks/meta` (Must be HTTPS)
   - **Verify Token:** Set a secure string (e.g., `GOC_META_WEBHOOK_2026_SECURE_TOKEN`). Ensure this matches the `verify_token` defined in your GOC Settings under the Facebook/Instagram tabs.
4. Under the Page Webhooks subscription list, find **leadgen** and click **Subscribe**.

### Step 3: Configure Page Access Token
1. Generate a permanent Page Access Token with permissions: `pages_show_list`, `pages_read_engagement`, `pages_manage_ads`, and `leads_retrieval`.
2. Add this token to your backend environment configuration as `META_PAGE_ACCESS_TOKEN`.
3. Add `META_APP_ID` and `META_APP_SECRET` from your Meta App settings block.

---

## WhatsApp Inbound Setup (MSG91)

When a customer messages the GOC studio number, MSG91 relays the conversation starter directly to the CRM.

### Step 1: Configure Webhook URL in MSG91
1. Log in to the [MSG91 Control Panel](https://control.msg91.com).
2. Go to **WhatsApp** -> **Inbound Webhook Configuration**.
3. Set the webhook URL to:
   - `https://your-server-domain.com/api/v1/webhooks/whatsapp`
4. Set the Webhook Secret key and match it with `MSG91_WEBHOOK_SECRET` in your `.env` configuration file.

---

## Configuration & Operation in GOC Studio

1. Navigate to **App Settings** -> **Integrations** in GOC Studio.
2. Enable/Disable specific platform captures using the toggles.
3. Configure the **Verify Tokens** to match those submitted to Meta / MSG91.
4. Assign default staff agents for automatic lead routing per channel.
