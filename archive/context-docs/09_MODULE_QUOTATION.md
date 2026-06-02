# 09 — MODULE: WHITEBOARD QUOTATION SYSTEM
## Freehand Stylus Whiteboard Quotations + Auto PDF + WhatsApp Dispatch

The Quotation module replaces the legacy top-down SVG car diagram zone picker with an infinite whiteboard canvas powered by `tldraw`. The admin can draw/handwrite quotation details directly using a stylus/Apple Pencil on an iPad/tablet or a mouse on desktop, save it, and send a generated PDF of the whiteboard snapshot to the customer via WhatsApp.

---

## SCREENS
- `QuotationsPage` — Whiteboard quotation manager (list of all saved quotations + creation form + tldraw modal editor)

---

## WORKFLOWS

### 1. Quotation Initialization
Admin opens the Quotations page and clicks **"+ New Whiteboard Quotation"**.
A form modal pops up with:
- **Search Existing Customer (Optional):** Dynamic lookup on existing customer profiles in CRM. If selected, auto-links `customer_id` and enables selection from their registered vehicles.
- **Manual Overrides:** Freetext fields for **Customer Name**, **Phone (WhatsApp)**, and **Vehicle Description** to support walk-ins without linking to CRM profiles.
- **Valid Until Date:** Defaults to 15 days from today.
- **Estimated Grand Total (₹):** Mapped to the quotation's `grand_total` database column.
- **Internal Notes:** Mapped to the quotation's `notes` database column.

Clicking **"Proceed to Whiteboard"** saves the draft record to the database and opens the freehand drawing whiteboard.

### 2. Whiteboard Drawing Canvas (`tldraw`)
A full-screen responsive whiteboard modal overlay opens containing:
- A drawing paper-like white canvas.
- Complete stylus and touch gesture support (Apple Pencil, finger, mouse).
- Custom control buttons:
  - **Select All / Undo / Redo:** Full controls.
  - **Clear Canvas:** Clears all drawn elements.
  - **Save Canvas:** Serializes the canvas elements to a JSON string (`canvas_data` column) and exports a base64 PNG snapshot (`canvas_snapshot` column) to the backend.

### 3. PDF Generation & WhatsApp Dispatch
- **PDF Render:** Admin clicks **"Generate PDF"** on the list page or inside the editor. The backend uses Puppeteer to render a clean A4 PDF consisting of a professional header, client details block (overrides or linked CRM details), the handwritten `canvas_snapshot` image, and any internal notes. The PDF is saved under `/uploads/quotation-pdfs/`.
- **WhatsApp Dispatch:** Admin clicks **"Send WhatsApp"**. The backend uses MSG91 service template `quick_message` to dispatch a notification to the customer's phone containing quotation details and a link to the generated PDF.

---

## DATABASE STRUCTURE

Whiteboard quotations are stored in the `quotations` table:
- `canvas_data` (`LONGTEXT`): serialized JSON structure representing the `tldraw` canvas store.
- `canvas_snapshot` (`LONGTEXT`): Base64-encoded PNG image of the canvas layout.
- `customer_name_override` (`VARCHAR(200)`): customer's name if CRM linking is bypassed.
- `customer_phone_override` (`VARCHAR(20)`): customer's contact number if CRM linking is bypassed.
- `vehicle_description` (`VARCHAR(200)`): vehicle identifier if CRM linking is bypassed.
- `customer_id` (`INT UNSIGNED NULL`): nullable linked customer reference.
- `vehicle_id` (`INT UNSIGNED NULL`): nullable linked vehicle reference.

*The `quotation_zones` table has been completely dropped as predefined zones are no longer used.*

---

## PDF LAYOUT SPECIFICATION
Generated A4 PDF structure:
- **Header:** Elite GOC Studio branding (Dark theme strip, Vadodara, Gujarat address, GSTIN details, sequential Quote #, validity date).
- **Client & Car Details Section:** Highlighted border containing Customer Name, Phone, Vehicle Name/Description, and License Plate.
- **Handwritten Details Canvas:** The whiteboard PNG snapshot image stretched to full content width with a thin border accent.
- **Notes:** Optional notes rendered below the whiteboard drawing.
- **Footer:** GOC branding info and generated date.
