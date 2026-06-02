# 06 — MODULE: CUSTOMER + VEHICLE CRM
## Module 2 — Customer Profiles, Vehicles, History, LTV

---

## SCREENS
- `CustomersPage` — searchable, filterable customer list
- `CustomerDetailPage` — profile + vehicles + service history + stats

## CUSTOMER DETAIL PAGE SECTIONS
```
1. Header Card — name, phone, status badge, lifetime value, total visits
2. Vehicles Tab — list of all vehicles with quick-add button
3. Service History Tab — all job cards (date, service, amount, status)
4. Quotations Tab — all quotations for this customer
5. Payments Tab — all payment records
6. Notes Tab — free-form notes, editable
```

## VEHICLE CARD
```
Make + Model + Year
Color pill | Fuel type pill | Reg number
"Primary Vehicle" badge if is_primary = true
[View History] [Edit] buttons
```

## KEY BUSINESS LOGIC
- When creating a customer from lead conversion: auto-create vehicle from lead's vehicle_make + vehicle_model
- `total_revenue` and `total_visits` are computed columns — recalculated after each DELIVERED job
- VIP status: manually set by owner/manager — shown with gold badge
- Customer search: by name, phone, or customer_code

## INDIAN VEHICLE DATABASE
```typescript
// /src/utils/vehicleData.ts — full Indian make/model list
export const VEHICLE_DATABASE = {
  'Maruti Suzuki': ['Alto', 'Swift', 'Dzire', 'Baleno', 'Brezza', 'Ertiga', 'XL6', 'Jimny', 'Grand Vitara'],
  'Hyundai': ['i10', 'i20', 'Venue', 'Creta', 'Tucson', 'Alcazar', 'Verna', 'Aura'],
  'Tata': ['Tiago', 'Tigor', 'Nexon', 'Harrier', 'Safari', 'Punch', 'Altroz'],
  'Mahindra': ['Thar', 'Scorpio', 'XUV700', 'XUV300', 'Bolero', 'BE 6e', 'XEV 9e'],
  'Honda': ['Amaze', 'City', 'Elevate', 'WR-V'],
  'Toyota': ['Glanza', 'Urban Cruiser', 'Innova Crysta', 'Fortuner', 'Camry', 'Hyryder'],
  'Kia': ['Sonet', 'Seltos', 'Carens', 'EV6'],
  'MG': ['Astor', 'Hector', 'ZS EV', 'Comet EV'],
  'Skoda': ['Kushaq', 'Slavia', 'Octavia', 'Superb'],
  'Volkswagen': ['Taigun', 'Virtus', 'Tiguan'],
  'Jeep': ['Meridian', 'Compass', 'Wrangler'],
  'BMW': ['3 Series', '5 Series', 'X1', 'X3', 'X5', 'X7'],
  'Mercedes-Benz': ['C-Class', 'E-Class', 'GLA', 'GLC', 'GLE', 'S-Class'],
  'Audi': ['A4', 'A6', 'Q3', 'Q5', 'Q7'],
  'Volvo': ['XC40', 'XC60', 'XC90'],
  'Land Rover': ['Defender', 'Discovery', 'Range Rover'],
  'Porsche': ['Cayenne', 'Macan', 'Panamera'],
};
```
