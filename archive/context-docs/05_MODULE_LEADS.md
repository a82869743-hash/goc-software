# 05 — MODULE: LEAD MANAGEMENT
## Module 1 — Lead Capture, Funnel, WhatsApp, Connectors

---

## SCREENS TO BUILD (from Stitch + custom)
- `LeadsPage` — list view with funnel status filter tabs + table
- `LeadCreatePage` — form to add new lead
- `LeadDetailPage` — full lead detail + activity log + status change
- `LeadKanbanView` — optional kanban board view per funnel stage

## KEY COMPONENTS
```
LeadCard.tsx           — compact card for kanban view
LeadStatusBadge.tsx    — colored badge per funnel stage
LeadFunnelTabs.tsx     — tab bar: All | New | Contacted | Interested | Quoted | Booked | Lost
LeadActivityLog.tsx    — timeline of all actions on this lead
LeadConvertModal.tsx   — modal to convert lead → customer + vehicle
LostReasonModal.tsx    — required modal when marking lead as LOST
```

## LEAD STATUS FLOW UI
```
New Lead [Blue] → Contacted [Yellow] → Interested [Orange] → Quotation Sent [Purple] → Booked [Green]
                                                                                     ↘ Lost [Red/Gray]
```
Status change dropdown always shows: next logical statuses + "Mark Lost"
Backward status changes allowed only for owner/manager

## FACEBOOK LEAD SYNC
```
Backend: POST /webhook/facebook — receives lead from FB Lead Ads
Auto-creates lead record with source=facebook + fb_lead_id for dedup
Sends welcome WhatsApp immediately via MSG91
Staff with role=sales notified instantly via in-app notification
```

## CONNECTOR ASSIGNMENT
- When `source = 'reference'`, connector dropdown becomes required
- Shows connector name + commission rate info below dropdown
- On lead conversion to booking → connector commission auto-calculated

## FILTERS AVAILABLE
- Status (funnel tabs)
- Source (dropdown)
- Assigned Staff (dropdown)
- Date range
- Search (name / phone)

## VALIDATION RULES
- Phone: exactly 10 digits, Indian mobile
- If status → LOST: lost_reason required (textarea, min 10 chars)
- Duplicate phone check: warn if phone exists in leads or customers table
