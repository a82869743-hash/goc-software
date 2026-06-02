# 04 — FRONTEND ARCHITECTURE
## React 19 + TypeScript + Vite — Stitch AI Screen Conversion Guide

---

## STITCH SCREEN CONVERSION RULES

Stitch AI generates static HTML + CSS + JS screens. The agent's job is to:

### Step 1 — Audit Stitch Screens
```bash
# List all stitch screens available
ls /stitch-screens/

# Each screen is a folder like:
# stitch-screens/leads-dashboard/index.html
# stitch-screens/job-card-detail/index.html
# stitch-screens/booking-form/index.html
```

### Step 2 — Extract Design Tokens
From each Stitch HTML, find `:root` CSS variables and consolidate into `/src/styles/tokens.css`:
```css
/* DO THIS ONCE — scan all stitch files for CSS variables, merge deduplicated */
:root {
  --color-primary: #CC0000;
  /* ... all tokens found in stitch files ... */
}
```

### Step 3 — Convert HTML to JSX
Rules:
- `class=""` → `className=""`
- Inline `style="..."` → keep as-is or move to CSS module
- `for=""` on labels → `htmlFor=""`
- Self-closing tags: `<img>` → `<img />`, `<input>` → `<input />`
- Remove all `<script>` tags from Stitch — replace with React logic

### Step 4 — Replace Static Data with Props/State
```tsx
// Stitch: <span>₹45,000</span>
// React:  <span>{formatINR(job.total_amount)}</span>

// Stitch: <div class="status-badge">Active</div>
// React:  <StatusBadge status={lead.status} />
```

### Step 5 — Wire API Calls
```tsx
// Every list page uses TanStack Query:
const { data, isLoading, error } = useQuery({
  queryKey: ['leads', filters],
  queryFn: () => leadsApi.getAll(filters),
});
```

---

## ROUTING STRUCTURE

```tsx
// App.tsx — React Router 7

<Routes>
  {/* Public */}
  <Route path="/login" element={<LoginPage />} />

  {/* Protected — wraps all in <AuthGuard> + <AppLayout> */}
  <Route element={<ProtectedRoute />}>
    <Route element={<AppLayout />}>
      <Route path="/" element={<Navigate to="/dashboard" />} />
      <Route path="/dashboard" element={<DashboardPage />} />

      {/* Leads */}
      <Route path="/leads" element={<LeadsPage />} />
      <Route path="/leads/new" element={<LeadCreatePage />} />
      <Route path="/leads/:id" element={<LeadDetailPage />} />

      {/* CRM */}
      <Route path="/customers" element={<CustomersPage />} />
      <Route path="/customers/new" element={<CustomerCreatePage />} />
      <Route path="/customers/:id" element={<CustomerDetailPage />} />

      {/* Bookings */}
      <Route path="/bookings" element={<BookingsPage />} />
      <Route path="/bookings/calendar" element={<BookingCalendarPage />} />
      <Route path="/bookings/new" element={<BookingCreatePage />} />
      <Route path="/bookings/:id" element={<BookingDetailPage />} />

      {/* Job Cards */}
      <Route path="/jobs" element={<JobCardsPage />} />
      <Route path="/jobs/new" element={<JobCardCreatePage />} />
      <Route path="/jobs/:id" element={<JobCardDetailPage />} />

      {/* Quotations */}
      <Route path="/quotations" element={<QuotationsPage />} />
      <Route path="/quotations/new" element={<QuotationCreatePage />} />
      <Route path="/quotations/:id" element={<QuotationDetailPage />} />

      {/* Inventory */}
      <Route path="/inventory" element={<InventoryPage />} />
      <Route path="/inventory/ppf-rolls" element={<PPFRollsPage />} />

      {/* Staff */}
      <Route path="/staff" element={<StaffPage />} />
      <Route path="/staff/:id" element={<StaffDetailPage />} />
      <Route path="/attendance" element={<AttendancePage />} />
      <Route path="/attendance/checkin" element={<AttendanceCheckinPage />} />

      {/* Billing */}
      <Route path="/invoices" element={<InvoicesPage />} />
      <Route path="/invoices/:id" element={<InvoiceDetailPage />} />
      <Route path="/payments" element={<PaymentsPage />} />

      {/* Marketing */}
      <Route path="/marketing" element={<MarketingPage />} />
      <Route path="/marketing/campaigns" element={<CampaignsPage />} />

      {/* Reports */}
      <Route path="/reports" element={<ReportsPage />} />
      <Route path="/reports/:type" element={<ReportDetailPage />} />

      {/* Settings */}
      <Route path="/settings" element={<SettingsPage />} />
    </Route>
  </Route>
</Routes>
```

---

## STATE MANAGEMENT

### Zustand Stores

```typescript
// /src/stores/authStore.ts
interface AuthStore {
  user: StaffProfile | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (token: string, user: StaffProfile) => void;
  logout: () => void;
}

// /src/stores/appStore.ts
interface AppStore {
  sidebarOpen: boolean;
  activeJobId: number | null;
  notifications: Notification[];
  unreadCount: number;
  setSidebarOpen: (open: boolean) => void;
  setActiveJob: (id: number | null) => void;
  addNotification: (n: Notification) => void;
  markAllRead: () => void;
}

// /src/stores/settingsStore.ts
interface SettingsStore {
  studioSettings: AppSettings | null;
  loadSettings: () => Promise<void>;
}
```

### TanStack Query Keys Convention
```typescript
// Always use arrays. Module name first, then filters/IDs:
['leads']                           // all leads
['leads', { status: 'new' }]        // filtered
['leads', id]                       // single lead
['leads', id, 'activity']          // sub-resource
['customers', id, 'vehicles']
['jobs', id, 'photos']
['dashboard', 'kpis']
['dashboard', 'charts', 'revenue', { period: 'monthly' }]
```

---

## API LAYER STRUCTURE

```typescript
// /src/api/client.ts — Axios instance with interceptors
const apiClient = axios.create({ baseURL: import.meta.env.VITE_API_BASE_URL });

// Request interceptor: add auth token
apiClient.interceptors.request.use(config => {
  const token = useAuthStore.getState().token;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Response interceptor: handle 401 (auto-logout), format errors
apiClient.interceptors.response.use(
  res => res.data,
  error => {
    if (error.response?.status === 401) useAuthStore.getState().logout();
    return Promise.reject(error.response?.data || error);
  }
);

// /src/api/leadsApi.ts
export const leadsApi = {
  getAll: (params) => apiClient.get('/leads', { params }),
  getById: (id) => apiClient.get(`/leads/${id}`),
  create: (data) => apiClient.post('/leads', data),
  update: (id, data) => apiClient.patch(`/leads/${id}`, data),
  updateStatus: (id, data) => apiClient.patch(`/leads/${id}/status`, data),
  convert: (id) => apiClient.post(`/leads/${id}/convert`),
  delete: (id) => apiClient.delete(`/leads/${id}`),
};
```

---

## COMPONENT LIBRARY (Reusable UI)

### Required Primitives to Build First (Phase 1)

```
/src/components/ui/
├── Button.tsx          → variant: primary|secondary|ghost|danger, size: sm|md|lg, loading state
├── Input.tsx           → with label, error message, prefix icon support
├── Select.tsx          → searchable dropdown, async options support
├── Modal.tsx           → portal-based, sizes: sm|md|lg|xl|full
├── Table.tsx           → sortable, pagination, loading skeleton
├── Badge.tsx           → status badges — dynamic color from status map
├── Card.tsx            → surface panel with optional header/footer
├── Drawer.tsx          → slide-in panel from right — for detail views
├── Toast.tsx           → via react-hot-toast — pre-configured
├── Spinner.tsx         → loading indicator
├── Empty.tsx           → empty state with icon + message
├── PageHeader.tsx      → title + breadcrumb + action buttons
├── SearchInput.tsx     → debounced search input
├── DatePicker.tsx      → calendar date picker (IST)
├── PhoneInput.tsx      → Indian phone input with +91 prefix
├── FileUpload.tsx      → drag-drop + camera for photos
└── ConfirmDialog.tsx   → "Are you sure?" confirmation modal
```

### Status Badge Color Map
```typescript
export const STATUS_COLORS = {
  // Lead statuses
  new: 'blue', contacted: 'yellow', interested: 'orange',
  quotation_sent: 'purple', booked: 'green', lost: 'red',
  // Job statuses
  scheduled: 'blue', car_in: 'cyan', washing: 'yellow',
  in_progress: 'orange', qc: 'purple', rework: 'red',
  ready: 'green', delivered: 'gray', cancelled: 'red',
  // Payment/invoice
  draft: 'gray', sent: 'blue', partially_paid: 'orange',
  paid: 'green', cancelled: 'red',
};
```

---

## APP LAYOUT

```tsx
// /src/components/layout/AppLayout.tsx
<div className="app-layout">
  <Sidebar />           {/* Left nav — collapsed on mobile */}
  <div className="main-area">
    <Topbar />          {/* Notifications bell, user menu, breadcrumb */}
    <main className="page-content">
      <Outlet />        {/* React Router nested route output */}
    </main>
  </div>
</div>

// Sidebar items per role:
const NAV_ITEMS = [
  { label: 'Dashboard', icon: LayoutDashboard, path: '/dashboard', roles: ['owner','manager','detailer','sales'] },
  { label: 'Leads', icon: UserPlus, path: '/leads', roles: ['owner','manager','sales'] },
  { label: 'Customers', icon: Users, path: '/customers', roles: ['owner','manager','sales'] },
  { label: 'Bookings', icon: CalendarDays, path: '/bookings', roles: ['owner','manager','sales'] },
  { label: 'Job Cards', icon: ClipboardList, path: '/jobs', roles: ['owner','manager','detailer'] },
  { label: 'Quotations', icon: FileText, path: '/quotations', roles: ['owner','manager','sales'] },
  { label: 'Inventory', icon: Package, path: '/inventory', roles: ['owner','manager'] },
  { label: 'Staff', icon: UserCog, path: '/staff', roles: ['owner','manager'] },
  { label: 'Attendance', icon: MapPin, path: '/attendance', roles: ['owner','manager','detailer','sales'] },
  { label: 'Billing', icon: Receipt, path: '/invoices', roles: ['owner','manager'] },
  { label: 'Marketing', icon: Megaphone, path: '/marketing', roles: ['owner','manager','sales'] },
  { label: 'Reports', icon: BarChart3, path: '/reports', roles: ['owner','manager'] },
  { label: 'Settings', icon: Settings, path: '/settings', roles: ['owner'] },
];
```

---

## UTILITY FUNCTIONS

```typescript
// /src/utils/formatters.ts
export const formatINR = (amount: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);

export const formatDate = (date: string | Date) =>
  new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(date));

export const formatDateTime = (date: string | Date) =>
  new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(date));

export const formatPhone = (phone: string) =>
  phone.startsWith('+91') ? phone : `+91 ${phone.slice(0,5)} ${phone.slice(5)}`;

// /src/utils/constants.ts
export const JOB_STATUS = { SCHEDULED:'scheduled', CAR_IN:'car_in', ... } as const;
export const LEAD_STATUS = { NEW:'new', CONTACTED:'contacted', ... } as const;
export const VEHICLE_MAKES = ['Maruti Suzuki','Hyundai','Tata','Mahindra','Honda','Toyota', ...]; // full Indian list
```

---

## CUSTOM HOOKS

```typescript
// /src/hooks/useLeads.ts
export const useLeads = (filters: LeadFilters) => {
  return useQuery({ queryKey: ['leads', filters], queryFn: () => leadsApi.getAll(filters) });
};

export const useUpdateLeadStatus = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => leadsApi.updateStatus(id, data),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ['leads'] });
      qc.invalidateQueries({ queryKey: ['leads', id] });
      toast.success('Lead status updated');
    },
  });
};

// /src/hooks/useDebounce.ts — for search inputs
// /src/hooks/usePermissions.ts — role-based UI show/hide
// /src/hooks/useGPS.ts — navigator.geolocation wrapper for attendance
// /src/hooks/useCamera.ts — camera API wrapper for attendance photos
```
