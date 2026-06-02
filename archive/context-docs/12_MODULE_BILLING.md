# 12 — MODULE: PAYMENT & BILLING
## Module 8 — Advance/Split/Full Payments, GST Invoices, PDF Generation

---

## SCREENS
- `InvoicesPage` — list of all invoices
- `InvoiceDetailPage` — invoice view + PDF + WhatsApp actions
- `PaymentsPage` — payment ledger / cash register
- `OutstandingPage` — all pending balances

---

## SCREENS LAYOUT

### InvoicesPage
```
[Header: "Invoices" | + Create Invoice]
[Filter tabs: All | Draft | Sent | Partially Paid | Paid | Cancelled]
[Date range filter] [Search by invoice # / customer]

Table:
  Invoice # | Customer | Job Card | Date | Total | Paid | Balance | Type | Status | Actions
  GOC-INV-2526-0001 | Amit Shah | GOC-JC-0045 | 15/05 | ₹40,710 | ₹5,000 | ₹35,710 | Tax Invoice | Partially Paid | [View] [PDF] [WhatsApp]
```

### InvoiceDetailPage
```
[Header: GOC-INV-2526-0001 | PARTIALLY PAID | [Generate PDF] [Send WhatsApp] [Record Payment] [Cancel]]

Invoice Rendered View (like actual invoice):
┌──────────────────────────────────────────────────────┐
│  GOD OF CERAMIC                    TAX INVOICE       │
│  Vadodara, Gujarat, India                            │
│  GSTIN: 24XXXXX1234X1Z5            Date: 15/05/2026 │
│  Ph: +91 XXXXXXXXXX            Invoice #: GOC-INV-.. │
├──────────────────────────────────────────────────────┤
│  Bill To:                                            │
│  Amit Shah                                           │
│  +91 98765 43210                                     │
│  Vehicle: Hyundai Creta 2022 | GJ06AB1234           │
│  Job Card: GOC-JC-0045                               │
├──────────────────────────────────────────────────────┤
│  # │ Description           │ HSN  │ Qty│ Rate  │ Amt │
│  1 │ PPF Full Bonnet-3M    │998714│  1 │15,000 │15,000│
│  2 │ Ceramic Coating 9H    │998714│  1 │18,000 │18,000│
├──────────────────────────────────────────────────────┤
│                           Subtotal:        ₹33,000  │
│                           Discount:       - ₹500    │
│                           CGST (9%):      + ₹2,925  │
│                           SGST (9%):      + ₹2,925  │
│                    ─────────────────────────────    │
│                           Grand Total:    ₹38,350   │
├──────────────────────────────────────────────────────┤
│  Payment Summary:                                    │
│  Advance (UPI): ₹5,000 on 01/05/2026               │
│  Amount Paid:   ₹5,000                              │
│  Balance Due:   ₹33,350                             │
└──────────────────────────────────────────────────────┘
```

### PaymentsPage (Cash Ledger)
```
[Header: "Payments" | + Record Payment]
[Date filter | Payment Mode filter | Search]

Summary cards (today):
  Cash Received: ₹12,000 | UPI: ₹45,000 | Card: ₹8,000 | Total: ₹65,000

Payments Table:
  Date/Time | Customer | Job Card | Invoice | Type | Mode | Amount | Reference | Recorded By
  15/05 09:30 | Amit Shah | JC-0045 | INV-001 | Advance | UPI | ₹5,000 | UPI123 | Ravi
```

### OutstandingPage
```
[Header: "Outstanding Dues"]
[Summary: Total Outstanding: ₹2,45,000 across 12 customers]

Table (sorted by days outstanding, oldest first):
  Customer | Phone | Invoice # | Invoice Date | Total | Paid | Balance | Days Outstanding | Action
  Raj Patel | 9876... | INV-015 | 01/04 | ₹45,000 | ₹10,000 | ₹35,000 | 44 days | [Call] [WhatsApp] [Record Payment]

Color coding:
  0–15 days: Normal
  16–30 days: Amber
  31+ days:   Red
```

---

## CREATE INVOICE FLOW

```typescript
// Invoices are created from job cards (most common) or standalone

// From Job Card:
// On JobCardDetailPage → "Generate Invoice" button
// Pre-fills: customer, vehicle, job_code, all services from job_services table

// Invoice form:
interface CreateInvoiceForm {
  job_card_id: number;
  invoice_type: 'tax_invoice' | 'proforma' | 'quotation_invoice';
  invoice_date: string;
  items: InvoiceItem[];
  discount_amount: number;
  apply_gst: boolean;          // true = CGST+SGST; false = no GST
  gst_type: 'cgst_sgst' | 'igst';  // intra-state vs inter-state
  customer_gstin: string | null;
  notes: string;
}

interface InvoiceItem {
  description: string;
  hsn_sac: string;     // default: 998714 for auto detailing services
  qty: number;
  unit: string;        // 'job' | 'sqft' | 'piece'
  rate: number;
  amount: number;      // qty * rate (auto-calculated)
}
```

---

## GST CALCULATION LOGIC

```typescript
// For Indian auto detailing: SAC Code 998714 — "Repair and maintenance of motor vehicles"
// Default GST rate: 18% (CGST 9% + SGST 9% for Gujarat intra-state)

export const calculateGST = (subtotal: number, discount: number, apply_gst: boolean, gst_type: 'cgst_sgst' | 'igst') => {
  const taxable_amount = subtotal - discount;
  if (!apply_gst) return { taxable_amount, cgst: 0, sgst: 0, igst: 0, total: taxable_amount };
  
  const gst_rate = 0.18;
  if (gst_type === 'igst') {
    const igst = parseFloat((taxable_amount * gst_rate).toFixed(2));
    return { taxable_amount, cgst: 0, sgst: 0, igst, total: taxable_amount + igst };
  } else {
    const cgst = parseFloat((taxable_amount * 0.09).toFixed(2));
    const sgst = parseFloat((taxable_amount * 0.09).toFixed(2));
    return { taxable_amount, cgst, sgst, igst: 0, total: taxable_amount + cgst + sgst };
  }
};

// Non-GST bill: customer requests no GST
// Store: apply_gst = false + reason in invoice.notes
// Still generate invoice but without tax lines
```

---

## INVOICE NUMBER FORMAT

```typescript
// Format: GOC-INV-YYMM-SEQUENCE
// YY = financial year (e.g. 25 for FY 2025-26)
// MM = not included — resets per financial year
// Example: GOC-INV-2526-0001 (FY 2025-26, first invoice)

// Financial year resets in April (month 4)
// April 2026 → FY 2526 → GOC-INV-2526-0001
// March 2027 → still FY 2526 → GOC-INV-2526-XXXX

export const getCurrentFYCode = (): string => {
  const now = new Date();
  const month = now.getMonth() + 1; // 1-12
  const year = now.getFullYear();
  const fyStart = month >= 4 ? year : year - 1;
  const fyEnd = fyStart + 1;
  return `${String(fyStart).slice(-2)}${String(fyEnd).slice(-2)}`; // "2526"
};
```

---

## RECORD PAYMENT MODAL

```typescript
// Available from: InvoiceDetailPage, JobCardDetailPage, OutstandingPage

interface RecordPaymentForm {
  invoice_id: number;
  job_card_id: number;
  customer_id: number;
  payment_type: 'advance' | 'partial' | 'final';
  amount: number;        // validation: amount <= invoice.balance_due
  payment_mode: 'cash' | 'upi' | 'card' | 'bank_transfer' | 'cheque';
  reference_no: string;  // required for upi/card/bank_transfer
  payment_date: string;  // default: today
  notes: string;
}

// After POST /payments:
// 1. payments record created
// 2. invoice.amount_paid += amount
// 3. invoice.balance_due -= amount
// 4. if invoice.balance_due === 0 → invoice.status = 'paid'
// 5. job_card.amount_paid and job_card.balance_due updated
// 6. Toast: "Payment of ₹X recorded successfully"
```

---

## PDF INVOICE TEMPLATE (Puppeteer)

```
A4 Page — GST-compliant Indian tax invoice format:

Header:
  Logo (left) | Invoice title + number (right)
  Studio name, address, GSTIN, phone

Customer section:
  Bill To: name, address, GSTIN (if provided)
  Job Card reference | Vehicle details | Date

Items table:
  # | Description | HSN/SAC | Qty | Unit | Rate | Amount
  Striped rows, column headers in GOC Red

Tax summary (right-aligned):
  Subtotal
  Discount (if any)
  CGST 9% | SGST 9%  (or IGST 18%)
  ─────────
  Grand Total (bold, larger)

Payment summary:
  Amount Received: ₹X
  Balance Due: ₹Y (highlighted if > 0)

Bank details (for outstanding):
  Bank: HDFC Bank | A/C: XXXXXXXXX | IFSC: HDFC0001234
  UPI: godofceramic@upi

Footer:
  "Thank you for choosing God of Ceramic"
  Authorized Signatory (blank line)
  "This is a computer-generated invoice"
```

---

## WHATSAPP INVOICE SEND

```typescript
// POST /invoices/:id/send-whatsapp
// 1. Generate PDF if not exists
// 2. Upload PDF to accessible URL (or base64)
// 3. MSG91 API call with template: invoice_sent
//    Variables: {{name}}, {{invoice_no}}, {{amount}}, {{balance}}, {{pdf_link}}
// 4. invoice.status → 'sent'
// 5. Log in whatsapp_logs
```

---

## KEY BUSINESS RULES
1. Invoice required before job card can move to DELIVERED
2. Balance must be ₹0 before delivery (owner can override with reason logged)
3. Cancelled invoices cannot be edited — create a new one
4. GST opt-out logged with customer reason (customer preference, unregistered business)
5. Proforma invoices don't count as tax invoices — for advance quotation only
6. All payment modes tracked for daily cash reconciliation report
7. Invoice number resets each financial year (April start)
