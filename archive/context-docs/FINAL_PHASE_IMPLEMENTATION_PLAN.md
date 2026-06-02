# Final Phase Implementation Plan: Marketing, Notifications & PDF Generation

Based on a comprehensive review of the project files, status documents, and the existing codebase, the core functionality (Leads, CRM, Bookings, Job Cards, Inventory, Billing, Staff, Dashboard, Commissions, and Settings) has been successfully implemented. 

The remaining features fall into three critical areas that bridge the gap between internal studio management and external customer communication.

---

## 1. PDF Generation Module (Phase 6b & 7b)
Currently, Quotations and Invoices are generated and stored in the database, but the system lacks the ability to generate the final, customer-facing PDF documents.

### Backend Implementation
*   **Target File:** `backend/src/services/pdfService.ts`
*   **Library:** `puppeteer`
*   **Tasks:**
    *   Create HTML templates for **Tax Invoice** and **Quotation** (utilizing the Stitch screens `tax_invoice_goc_studio` and `quotation_pdf_template_goc_studio`).
    *   Implement `generateQuotationPDF(quotationId)` and `generateInvoicePDF(invoiceId)` functions.
    *   Integrate PDF generation into existing `quotationController.ts` and `invoiceController.ts` to generate and save the PDF URL upon creation/approval.

### Frontend Integration
*   Ensure the "Download PDF" buttons in `QuotationsPage` and `InvoicesPage` point to the correct backend endpoints or serve the generated files.

---

## 2. WhatsApp & Marketing Module (Phase 8b)
The system needs to communicate automatically with customers using the MSG91 WhatsApp API.

### Database Adjustments
*   **Migration Required:** The `02_DATABASE_SCHEMA.md` mentions a `campaigns` functionality, but the `campaigns` table is currently missing from `schema.sql`. We need to design and add a `campaigns` table to store scheduled bulk messages.

### Backend Implementation
*   **Services:**
    *   `backend/src/services/whatsappService.ts`: Implement `sendWhatsApp(phone, template, variables)` using MSG91 API and log the attempt to the existing `whatsapp_logs` table.
    *   `backend/src/services/cronJobs.ts`: Implement `node-cron` scheduled jobs (e.g., daily birthday wishes at 09:00 AM, 1-day/3-day lead follow-ups).
*   **Controllers & Routes:**
    *   `backend/src/controllers/marketingController.ts`: Handle Quick Send, Campaign CRUD, and fetching WhatsApp logs.
    *   `backend/src/routes/marketing.ts`: Expose endpoints for the marketing dashboard.

### Frontend Implementation
*   **Pages:**
    *   `frontend/src/pages/MarketingPage.tsx`: Dashboard for WhatsApp logs and Quick Send functionality.
    *   `frontend/src/pages/CampaignsPage.tsx`: Manage bulk campaigns and segment selections.
*   **API Client:**
    *   `frontend/src/api/marketing.ts`

---

## 3. In-App Notifications Module (Phase 8c)
Staff need to receive in-app alerts for critical system events (e.g., new web lead, low stock, customer arrived).

### Backend Implementation
*   **Controllers & Routes:**
    *   `backend/src/controllers/notificationsController.ts`: Logic to fetch, mark as read, and delete notifications for the logged-in staff member.
    *   `backend/src/routes/notifications.ts`
*   **Service Integration:**
    *   Add helper functions to insert into the `notifications` table whenever a specific trigger occurs (e.g., inside `leadController` or `inventoryController`).

### Frontend Integration
*   Ensure the Topbar notification bell queries the `/api/v1/notifications` endpoint.
*   Implement real-time polling (via TanStack Query `refetchInterval`) or WebSocket (if required) to update the unread count.

---

## Proposed Execution Order
1. **Step 1:** Build `pdfService.ts` and integrate it with Quotations and Invoices (High value, low complexity).
2. **Step 2:** Build `whatsappService.ts` and implement basic automated triggers (Lead Welcome, Car Ready).
3. **Step 3:** Implement the frontend `MarketingPage` for manual WhatsApp sending and log viewing.
4. **Step 4:** Add the missing `campaigns` DB table and build the bulk Campaigns functionality.
5. **Step 5:** Complete the `notifications` backend and wire up the Topbar UI.
