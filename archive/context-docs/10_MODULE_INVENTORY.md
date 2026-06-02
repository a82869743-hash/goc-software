# 10 — MODULE: INVENTORY MANAGEMENT
## Module 6 — PPF Roll Sq.ft Tracking, Ceramic Stock, Low-Stock Alerts

---

## SCREENS
- `InventoryPage` — master inventory list
- `PPFRollsPage` — dedicated PPF roll management
- `InventoryDetailPage` — single item detail + usage history

---

## SCREENS LAYOUT

### InventoryPage
```
[Header: "Inventory" | + Add Item]
[Filter tabs: All | PPF Rolls | Ceramic | Primer | Car Care | Consumables]
[Low Stock Alert banner: "3 items below minimum threshold" — shown when applicable]

[Table:
  Item Code | Name | Category | Brand | Unit | Stock | Min Threshold | Status | Actions
  GOC-INV-001 | 3M Pro Series PPF | PPF Roll | 3M | sqft | 124.5 | 50 | ✅ OK | [View] [Adjust]
  GOC-INV-002 | IGL Kenzo Ceramic | Ceramic | IGL | ml | 450 | 500 | ⚠️ Low | [View] [Adjust]
]

Low stock rows highlighted in amber.
```

### PPFRollsPage
```
[Header: "PPF Rolls" | + Add Roll]
[Filter: Brand | Grade | Status: Available / Partial / Exhausted]

[Roll Cards Grid]:
┌─────────────────────────────────┐
│ Roll-007                        │
│ 3M Pro Series — Gloss           │
│ Width: 152cm | Length: 30m      │
│ Total: 490.5 sqft               │
│ Used:  120.0 sqft (24.5%)       │
│ Balance: ██████░░░ 370.5 sqft   │
│ Status: PARTIAL                 │
│ Purchased: 01/04/2026 ₹28,000  │
│ [View Usage] [Mark Exhausted]   │
└─────────────────────────────────┘

[List view toggle for table format]
```

### InventoryDetailPage / PPF Roll Detail
```
[Header: Roll-007 — 3M Pro Series | PARTIAL badge]

Roll Info Card:
  Brand: 3M | Grade: Pro Series Gloss
  Width: 152cm | Length: 30m
  Total Sq.ft: 490.5 | Wastage Buffer: 5%
  Purchase Price: ₹28,000 | Purchase Date: 01/04/2026
  
Usage Progress:
  [████████░░░░░░░░░░░░] 24.5% used
  Used: 120.0 sqft | Balance: 370.5 sqft

Usage History Table:
  Date | Job Card | Customer | Vehicle | Sq.ft Used | Wastage | Used By
  15/05 | GOC-JC-0045 | Amit Shah | Hyundai Creta | 12.5 sqft | 0.625 | Karan
  12/05 | GOC-JC-0042 | Raj Patel | Tata Nexon | 15.0 sqft | 0.75 | Hiren
```

---

## KEY COMPONENTS

```
InventoryTable.tsx        — sortable/filterable main table
PPFRollCard.tsx           — visual roll card with progress bar
StockLevelBadge.tsx       — OK / Low / Critical / Exhausted
AdjustStockModal.tsx      — manual stock adjustment form
AddInventoryItemModal.tsx — add new inventory item
AddPPFRollModal.tsx       — add new PPF roll with sqft calc
UsageHistoryTable.tsx     — usage log for an item
LowStockAlertBanner.tsx   — dashboard + inventory page alert
```

---

## INVENTORY CATEGORIES

```typescript
export const INVENTORY_CATEGORIES = {
  ppf_roll:    { label: 'PPF Roll',    unit: 'sqft',  icon: 'Layers' },
  ceramic:     { label: 'Ceramic',     unit: 'ml',    icon: 'Droplets' },
  primer:      { label: 'Primer',      unit: 'ml',    icon: 'Pipette' },
  car_care:    { label: 'Car Care',    unit: 'units', icon: 'Spray' },
  consumable:  { label: 'Consumable',  unit: 'units', icon: 'Package' },
} as const;
```

---

## PPF ROLL SQ.FT CALCULATION

```typescript
// Auto-calculate total_sqft when adding a roll:
// Formula: (width_cm / 100) × length_m × 10.764
// Example: (152 / 100) × 30 × 10.764 = 490.5 sqft

export const calculatePPFSqft = (width_cm: number, length_m: number): number => {
  return parseFloat(((width_cm / 100) * length_m * 10.764).toFixed(2));
};

// balance_sqft = total_sqft - used_sqft
// Status auto-update:
//   balance_sqft === 0              → exhausted
//   balance_sqft < 0.2 * total_sqft → partial (< 20% remaining)
//   balance_sqft >= 0.2 * total_sqft → available
```

---

## ADD PPF ROLL FORM

```typescript
interface AddPPFRollForm {
  inventory_item_id: number;   // links to parent inventory_item
  brand: string;               // 3M | STEK | Llumar | Garware | SunTek | XPEL
  grade: string;               // Pro Series | Standard | Matte | Satin | Elite
  width_cm: number;            // e.g. 152
  length_m: number;            // e.g. 30
  total_sqft: number;          // auto-calculated, read-only display
  wastage_pct: number;         // default from app_settings, editable
  purchase_price: number;      // cost of this roll
  purchase_date: string;       // date
  notes: string;
}
// roll_code auto-generated: ROLL-{brand initials}-{sequence}
// e.g. ROLL-3M-007
```

---

## STOCK ADJUSTMENT (Manual)

```typescript
// For non-PPF items or manual corrections:
interface StockAdjustment {
  item_id: number;
  adjustment_type: 'add' | 'deduct' | 'set';
  quantity: number;
  reason: string;  // 'Purchase', 'Damage', 'Theft', 'Correction', 'Other'
  notes: string;
}
// Creates entry in inventory_usage with job_card_id = null
// Updates inventory_items.current_stock
```

---

## LOW STOCK LOGIC

```typescript
// Computed on every inventory read:
// LOW:      current_stock < min_threshold
// CRITICAL: current_stock < (min_threshold * 0.5)
// OK:       current_stock >= min_threshold

// Dashboard KPI: low_stock_count = count of items where current_stock < min_threshold

// Notification trigger:
// When any item goes below min_threshold → notify owner + manager
// Notification type: 'low_stock'
// title: "Low Stock Alert: {item_name}"
// body: "Only {current_stock} {unit} remaining. Minimum threshold: {min_threshold}"
```

---

## USAGE RECORDING (from Job Card)

```typescript
// When detailer adds PPF service to job card:
// POST /inventory/:id/usage
{
  ppf_roll_id: 7,
  job_card_id: 45,
  qty_used: 12.5,           // actual sq.ft applied
  wastage_qty: 0.625,       // qty_used * wastage_pct / 100
  total_deducted: 13.125,   // qty_used + wastage_qty
  used_by: staff_id,
  notes: "Bonnet + front bumper"
}
// Server updates:
// ppf_rolls: used_sqft += total_deducted, balance_sqft -= total_deducted
// inventory_items: current_stock -= total_deducted
// inventory_usage: new record created
// Check if balance_sqft triggers low-stock notification
```

---

## INVENTORY DASHBOARD WIDGET

```typescript
// Shown on main dashboard for owner/manager:
// "Inventory Snapshot" card:
//   PPF Rolls: 4 available | 2 partial | 1 exhausted
//   Low Stock Items: [item list with red badges]
//   Total PPF Balance: 1,240 sqft across all rolls
```

---

## REPORTS INTEGRATION

```typescript
// GET /reports/inventory?date_from=...&date_to=...
// Returns:
//   - Total PPF sq.ft consumed in period
//   - Per-brand breakdown
//   - Wastage percentage (actual vs budgeted)
//   - Ceramic ml used per service type
//   - Total inventory cost consumed
//   - Low-stock events in period
```

---

## KEY BUSINESS RULES
1. PPF roll must be selected when adding a PPF service — cannot save without it
2. Cannot deduct more sq.ft than roll's balance_sqft
3. Wastage is always added on top of actual usage (5% default, configurable)
4. Exhausted rolls show in history but cannot be selected for new jobs
5. Inventory adjustments require a reason — logged for audit trail
6. Owner and manager receive notification when any item goes below threshold
