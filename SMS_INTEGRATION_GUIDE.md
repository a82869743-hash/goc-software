# GOC Studio — MSG91 & DLT SMS Integration Guide

This guide provides step-by-step instructions to configure the automated SMS system in GOC Studio. Since GOC Studio uses a **Queue-Worker Architecture**, the system will log and queue all events gracefully without sending them until configuration is complete.

---

## 1. DLT Registration (Required in India)
By TRAI regulation, all transactional SMS in India must be registered on a DLT platform (e.g., Jio, Vodafone-Idea, Airtel, BSNL, Videocon).

### Step 1.1: Register Principal Entity (PE)
1. Sign up on a DLT platform (e.g., [Jio DLT](https://trueconnect.jio.com/)).
2. Complete KYC and obtain your **14-digit Principal Entity (PE) ID**.
3. Paste this PE ID in the **MSG91 Principal Entity ID** setting.

### Step 1.2: Register Headers (Sender ID)
1. Register a 6-character Sender ID representing your brand (e.g., `GOCER` or `GOCSTD`).
2. Once approved, this header will be used as the **Sender ID** in settings.

### Step 1.3: Register Content Templates
You must register exactly 7 transactional content templates on DLT. Use the exact formats below. Replace variables with `{#var#}` on DLT:

#### 1. BOOKING_CONFIRMATION
* **Template Text:** `Dear {#var#}, your booking at God of Ceramic is confirmed for {#var#} at {#var#}. We look forward to serving you! — GOC Studio`
* **Variables:** `{#var#}` (Name), `{#var#}` (Date), `{#var#}` (Time)

#### 2. BOOKING_REMINDER
* **Template Text:** `Reminder: Dear {#var#}, your appointment at God of Ceramic is tomorrow ({#var#}) at {#var#}. Please arrive on time. — GOC Studio`
* **Variables:** `{#var#}` (Name), `{#var#}` (Date), `{#var#}` (Time)

#### 3. JOB_CREATED
* **Template Text:** `Dear {#var#}, your {#var#} has been registered at God of Ceramic. Job Card: {#var#}. We'll keep you updated on progress. — GOC Studio`
* **Variables:** `{#var#}` (Name), `{#var#}` (Vehicle), `{#var#}` (Job Code)

#### 4. VEHICLE_READY
* **Template Text:** `Dear {#var#}, great news! Your {#var#} is ready for pickup at God of Ceramic. Ref: {#var#}. Please visit us at your convenience. — GOC Studio`
* **Variables:** `{#var#}` (Name), `{#var#}` (Vehicle), `{#var#}` (Job Code)

#### 5. INVOICE_GENERATED
* **Template Text:** `Dear {#var#}, your invoice {#var#} for {#var#} has been generated at God of Ceramic. — GOC Studio`
* **Variables:** `{#var#}` (Name), `{#var#}` (Invoice No), `{#var#}` (Amount)

#### 6. PAYMENT_RECEIVED
* **Template Text:** `Dear {#var#}, thank you! Payment of {#var#} received for invoice {#var#} at God of Ceramic. — GOC Studio`
* **Variables:** `{#var#}` (Name), `{#var#}` (Amount), `{#var#}` (Invoice No)

#### 7. SERVICE_FOLLOWUP_30D
* **Template Text:** `Dear {#var#}, it's been 30 days since your vehicle was serviced at God of Ceramic. How is it looking? We'd love your feedback! Visit us for a free inspection. — GOC Studio`
* **Variables:** `{#var#}` (Name)

---

## 2. MSG91 Flow Setup

1. Log in to your [MSG91 Dashboard](https://control.msg91.com).
2. Go to **SMS** > **Flows** and click **Create Flow**.
3. Choose **Custom Template** or select your DLT Template.
4. Set up the flow logic and map DLT variables to Flow parameters:
   - For **BOOKING_CONFIRMATION**, define flow variables: `customerName`, `bookingDate`, `timeSlot`, `vehicle`.
   - Map these flow variables to `{#var#}` placeholders inside the template body in order.
5. Save the flow and copy the **Flow ID** (e.g. `64b34b12...`).
6. Copy your **MSG91 Auth Key** from the MSG91 API Credentials settings.

---

## 3. GOC Studio App Configuration

1. Log in to the GOC Studio Management Console as an **Admin** or **Manager**.
2. Navigate to **Settings** > **SMS Integration** tab.
3. Paste the following configuration values:
   - **MSG91 Auth Key**: Paste your MSG91 API key.
   - **Sender ID**: Paste your 6-char Sender ID (Header).
   - **Principal Entity ID**: Paste your DLT PE ID.
   - **Default Country Code**: `91` (India).
   - **MSG91 Base API Url**: `https://control.msg91.com`.
4. Click **Save Configuration**.
5. Scroll down to **Templates & Flow IDs**:
   - For each event, enter the approved **DLT Template ID** and **MSG91 Flow ID**.
   - Toggle the active state switch to **Active** for each template.
   - Click **Save template values**.
6. Toggle the **Enable Transactional SMS Sending** master switch to **Active**.

---

## 4. Operational Telemetry & Logs
* **Pending Queue**: View SMS notifications waiting to be sent (processed automatically every minute by the background cron worker).
* **Delivery Logs**: Review SMS logs showing the status (`sent`, `failed`, `mock_sent`), MSG91 Request IDs, and detailed error messages from MSG91 if delivery fails.
* **Retry Action**: For any failed message logs, click the **Retry** link to re-enqueue the message for sending.
