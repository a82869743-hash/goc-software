# 14 — MODULE: MARKETING & FOLLOW-UP
## Module 10 — WhatsApp Automation, Service Reminders, Campaigns

---

## SCREENS
- `MarketingPage` — overview: quick send + scheduled messages + stats
- `CampaignsPage` — bulk WhatsApp campaign management
- `WhatsAppLogsPage` — delivery tracking for all messages

---

## SCREENS LAYOUT

### MarketingPage
```
[Header: "Marketing & Follow-up"]

=== Stats Bar ===
Sent Today: 24 | Delivered: 22 | Failed: 2 | Campaigns Active: 1

=== TABS ===
[Quick Send] [Campaigns] [Auto Follow-ups] [WhatsApp Logs]

=== Quick Send Tab ===
Send WhatsApp to Individual Customer:

Customer:   [async search — name or phone]
Template:   [dropdown — all MSG91 approved templates]
            [Template preview below dropdown]

Template variables auto-filled:
  {{name}} → customer full_name
  {{vehicle}} → make + model
  
Custom variables (if template has extras):
  [dynamic input fields per variable]

[Send Now]
```

### CampaignsPage
```
[Header: "Campaigns" | + New Campaign]

Campaign Cards:
┌─────────────────────────────────────┐
│ 🎯 Ceramic Coating 6-Month Reminder │
│ Template: service_reminder          │
│ Segment: Ceramic customers 6m ago   │
│ Recipients: 45 customers            │
│ Scheduled: 10 May 2026, 10:00 AM   │
│ Status: SCHEDULED                   │
│ [Edit] [Cancel] [View Logs]         │
└─────────────────────────────────────┘

Completed campaigns show:
│ Status: COMPLETED                   │
│ Sent: 45 | Delivered: 43 | Failed: 2│
```

### New Campaign Form
```
Campaign Name: [text]
Template:      [dropdown — bulk-eligible templates only]
Segment:       [dropdown — see segments below]
Schedule At:   [DateTimePicker — min: 30 min from now]
               [or: Send Immediately checkbox]
Preview Recipients: [count + sample list of 5 names]
[Create Campaign]
```

### WhatsApp Logs Tab / Page
```
[Filters: Template | Status | Date Range | Customer search]

Table:
  Date/Time | Customer | Phone | Template | Status | MSG91 ID | Error
  15/05 09:30 | Amit Shah | +919876... | car_ready | ✅ Delivered | MSG91-XXX | —
  15/05 08:15 | Raj Patel | +919123... | invoice_sent | ❌ Failed | — | Invalid number
```

---

## WHATSAPP TEMPLATES

```typescript
// All templates pre-approved on MSG91 WhatsApp Business API
// Templates defined in: /src/utils/whatsappTemplates.ts

export const WHATSAPP_TEMPLATES = {
  lead_welcome: {
    name: 'lead_welcome',
    label: 'Lead Welcome',
    trigger: 'auto',    // automatic trigger
    variables: ['{{name}}', '{{studio_name}}'],
    preview: 'Hi {{name}}! Thank you for your interest in {{studio_name}}. We'll get in touch shortly!',
  },
  quotation_sent: {
    name: 'quotation_sent',
    label: 'Quotation Sent',
    trigger: 'manual',
    variables: ['{{name}}', '{{vehicle}}', '{{amount}}', '{{valid_until}}', '{{pdf_link}}'],
    preview: 'Hi {{name}}, your PPF quotation for {{vehicle}} is ready. Total: ₹{{amount}}. Valid till {{valid_until}}.',
  },
  booking_confirmed: {
    name: 'booking_confirmed',
    label: 'Booking Confirmed',
    trigger: 'auto',
    variables: ['{{name}}', '{{vehicle}}', '{{date}}', '{{time}}', '{{booking_code}}'],
    preview: 'Booking confirmed! {{name}}, your {{vehicle}} is booked for {{date}} at {{time}}. Ref: {{booking_code}}',
  },
  car_ready: {
    name: 'car_ready',
    label: 'Car Ready for Pickup',
    trigger: 'auto',    // triggered when job status → ready
    variables: ['{{name}}', '{{vehicle}}', '{{job_code}}'],
    preview: 'Great news {{name}}! Your {{vehicle}} is ready for pickup. Job: {{job_code}}. See you soon!',
  },
  invoice_sent: {
    name: 'invoice_sent',
    label: 'Invoice Sent',
    trigger: 'manual',
    variables: ['{{name}}', '{{invoice_no}}', '{{amount}}', '{{balance}}', '{{pdf_link}}'],
    preview: 'Hi {{name}}, invoice {{invoice_no}} for ₹{{amount}} is attached. Balance due: ₹{{balance}}.',
  },
  follow_up_1day: {
    name: 'follow_up_1day',
    label: '1-Day Follow-up',
    trigger: 'auto',    // 24h after lead created if still in 'new' status
    variables: ['{{name}}', '{{studio_name}}'],
    preview: 'Hi {{name}}, following up on your inquiry. We'd love to help with your car! — {{studio_name}}',
  },
  follow_up_3day: {
    name: 'follow_up_3day',
    label: '3-Day Follow-up',
    trigger: 'auto',    // 72h after lead if still in 'new' or 'contacted'
    variables: ['{{name}}', '{{studio_name}}'],
    preview: 'Hi {{name}}, still interested in PPF/Ceramic for your car? Book a free consultation! — {{studio_name}}',
  },
  service_reminder: {
    name: 'service_reminder',
    label: 'Service Reminder',
    trigger: 'campaign', // bulk campaign
    variables: ['{{name}}', '{{vehicle}}', '{{service}}', '{{months}}'],
    preview: 'Hi {{name}}, it has been {{months}} months since your {{vehicle}} received {{service}}. Time for a refresh?',
  },
  birthday_wish: {
    name: 'birthday_wish',
    label: 'Birthday Greeting',
    trigger: 'auto',    // daily cron: check customers with dob = today
    variables: ['{{name}}'],
    preview: 'Happy Birthday {{name}}! 🎂 God of Ceramic wishes you a wonderful day! Special discount awaits you.',
  },
  payment_reminder: {
    name: 'payment_reminder',
    label: 'Payment Reminder',
    trigger: 'manual',
    variables: ['{{name}}', '{{balance}}', '{{invoice_no}}'],
    preview: 'Hi {{name}}, ₹{{balance}} is outstanding on invoice {{invoice_no}}. Please arrange payment. Thank you.',
  },
};
```

---

## CUSTOMER SEGMENTS

```typescript
// Pre-defined segments for bulk campaigns:

export const CAMPAIGN_SEGMENTS = [
  {
    key: 'ceramic_6months',
    label: 'Ceramic customers — 6 months ago',
    description: 'Customers who got ceramic coating 6 months ago',
    query: `SELECT DISTINCT c.id FROM customers c
            JOIN job_cards j ON j.customer_id = c.id
            JOIN job_services js ON js.job_card_id = j.id
            WHERE js.service_type = 'ceramic'
            AND j.status = 'delivered'
            AND j.date_out BETWEEN DATE_SUB(NOW(), INTERVAL 7 MONTH) AND DATE_SUB(NOW(), INTERVAL 5 MONTH)`,
  },
  {
    key: 'ppf_12months',
    label: 'PPF customers — 12 months ago',
    description: 'PPF customers due for inspection/reapplication',
    query: `... WHERE js.service_type = 'ppf' AND DATEDIFF(NOW(), j.date_out) BETWEEN 330 AND 400`,
  },
  {
    key: 'inactive_6months',
    label: 'Inactive customers — 6+ months',
    description: 'Customers with no visit in last 6 months',
    query: `... WHERE c.last_visit < DATE_SUB(NOW(), INTERVAL 6 MONTH)`,
  },
  {
    key: 'vip_customers',
    label: 'VIP customers',
    description: 'All customers with status = VIP',
    query: `... WHERE c.status = 'vip'`,
  },
  {
    key: 'all_active',
    label: 'All active customers',
    description: 'All customers who have visited at least once',
    query: `... WHERE c.total_visits > 0 AND c.deleted_at IS NULL`,
  },
];
```

---

## AUTO FOLLOW-UP LOGIC (Cron Jobs)

```typescript
// Backend cron jobs (node-cron):

// Every day at 09:00 AM IST:
// 1. Birthday Wish: customers where dob month+day = today
// 2. Follow-up 1-day: leads created exactly 24h ago, status still 'new'
// 3. Follow-up 3-day: leads created 72h ago, status IN ('new', 'contacted')
// 4. Service Reminders: from scheduled campaigns with schedule_at = now (± 5 min)

// Campaign execution:
// 1. Load campaign from DB
// 2. Run segment query → get recipient list
// 3. For each recipient: POST /whatsapp/send with template variables
// 4. Log each in whatsapp_logs
// 5. Update campaign: sent_count, failed_count, status = 'completed'

// Rate limiting: 20 messages/second (MSG91 limit)
// Queue with 50ms delay between each message
```

---

## MSG91 INTEGRATION

```typescript
// /backend/src/services/whatsappService.ts

interface MSG91SendPayload {
  integrated_number: string;   // MSG91 WhatsApp sender number
  content_type: 'template';
  payload: {
    to: string;                // customer phone with country code: 919876543210
    type: 'template';
    template: {
      name: string;            // template name
      language: { code: 'en' };
      components: Array<{
        type: 'body';
        parameters: Array<{ type: 'text'; text: string }>;
      }>;
    };
  };
}

export const sendWhatsApp = async (
  phone: string,
  template_name: string,
  variables: Record<string, string>
): Promise<{ success: boolean; message_id?: string; error?: string }> => {
  // Format phone: remove +91, ensure 10 digits, prepend 91
  const formatted_phone = `91${phone.replace(/^\+91/, '').replace(/\s/g, '')}`;
  
  try {
    const response = await axios.post(
      'https://api.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/',
      buildPayload(formatted_phone, template_name, variables),
      { headers: { 'authkey': process.env.MSG91_AUTH_KEY } }
    );
    return { success: true, message_id: response.data.message_id };
  } catch (error) {
    return { success: false, error: error.message };
  }
};
```

---

## KEY BUSINESS RULES
1. Auto messages (lead_welcome, car_ready, booking_confirmed) fire without staff action
2. Manual messages require staff to explicitly trigger from UI
3. Campaigns can only be cancelled if not yet started (status = 'scheduled')
4. Maximum 1 campaign per segment per week (prevent spam — enforced in UI with warning)
5. All WhatsApp messages logged in whatsapp_logs regardless of success/failure
6. Failed messages do not auto-retry — staff must manually resend
7. Birthday wishes sent at 09:00 AM daily (not immediately on customer creation)
