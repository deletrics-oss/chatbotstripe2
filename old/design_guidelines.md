# Design Guidelines: WhatsApp Chatbot SaaS Platform

## Design Approach

**Selected Approach**: Design System - Material Design 3 adapted for B2B SaaS
**Justification**: This is a utility-focused, information-dense dashboard application requiring consistent patterns, clear hierarchy, and professional aesthetics for business users managing chatbot operations.

**Key Design Principles**:
- Data clarity and immediate comprehension
- Efficient workflows with minimal friction
- Professional B2B aesthetic with modern polish
- Scalable component system for feature expansion

---

## Typography

**Font Stack**: 
- Primary: Inter (Google Fonts) - UI elements, body text, data
- Monospace: JetBrains Mono - JSON editor, code snippets, technical data

**Hierarchy**:
- Dashboard Headings: text-2xl/text-3xl font-semibold
- Section Titles: text-xl font-semibold
- Card Headers: text-lg font-medium
- Body Text: text-base font-normal
- Metadata/Labels: text-sm font-medium
- Captions/Helper: text-xs font-normal
- JSON Editor: text-sm font-mono

---

## Layout System

**Spacing Units**: Tailwind units of 2, 4, 6, 8, 12, 16 as primary rhythm
- Tight spacing: p-2, gap-2 (within components)
- Standard spacing: p-4, gap-4 (card padding, form fields)
- Section spacing: p-6, p-8 (major containers)
- Page margins: p-8, p-12 (outer containers)

**Grid Structure**:
- Sidebar Navigation: Fixed 16rem (w-64) on desktop, collapsible on mobile
- Main Content: flex-1 with max-w-7xl container
- Dashboard Cards: grid-cols-1 md:grid-cols-2 lg:grid-cols-3
- Chat Layout: Split 60/40 (conversation list / active chat)

---

## Component Library

### Navigation & Structure

**Sidebar Navigation**:
- Fixed left sidebar (64px icon-only collapsed, 256px expanded)
- Sections: Dashboard, Devices, Chats, Logic Editor, Billing, Settings
- Active state with left border accent (border-l-4)
- Icon + label layout with smooth transitions
- Bottom section: User profile, logout, plan badge

**Top Bar**:
- Height: h-16
- Breadcrumbs on left
- Right: Notification bell, plan indicator, user avatar dropdown
- Search bar for larger screens (hidden on mobile)

### Dashboard Components

**Metrics Cards** (Real-time Stats):
- Grid layout: 4 cards on desktop (Active Chats, Messages Today, Response Rate, Uptime)
- Card structure: Icon (top-left) + Number (large, font-bold) + Label + Trend indicator
- Padding: p-6
- Border radius: rounded-lg
- Subtle elevation: shadow-sm

**Status Indicators**:
- Connection Status: Badge with pulse animation (Gemini AI, WhatsSckt)
- QR Code Display: Centered card with max-w-sm
- Device Info: List items with icon, name, status dot, timestamp

**Activity Feed**:
- Timeline layout with left border
- Items: Avatar + Message preview + Timestamp
- Max height with scroll: max-h-96 overflow-y-auto

### Chat Interface

**Conversation List** (Left Panel):
- Search bar at top (p-4)
- List items: Avatar + Name + Last message preview + Unread badge + Timestamp
- Active conversation: Background highlight
- Height: calc(100vh - header) with overflow-y-auto

**Chat Window** (Main Panel):
- Header: Contact name + Status + Actions (archive, mute, more)
- Messages area: flex flex-col-reverse for bottom-up rendering
- Message bubbles: Rounded (rounded-2xl), max-w-md, with tail indicator
- Input area: Sticky bottom, p-4, textarea with send button + attachments

### JSON Logic Editor

**Editor Layout**:
- Two-panel split: Visual editor (left 50%) + Code preview (right 50%)
- Top toolbar: Save, Load, Upload, Generate Template buttons
- Visual Editor: Form-based builder with drag-and-drop triggers/actions
- Code Panel: Monaco-like syntax highlighting, line numbers, validation errors

**Template Library**:
- Grid of template cards: grid-cols-1 md:grid-cols-2 lg:grid-cols-3
- Card content: Icon + Title + Description + "Use Template" button
- Categories filter: Tabs or sidebar navigation

### Billing & Plans

**Plan Comparison Table**:
- Three columns: Free, Básico (R$29,90), Full (R$99)
- Header: Plan name + Price + Billing cycle
- Feature rows: Checkmarks/crosses with feature descriptions
- CTA buttons: Different prominence (outline for current, solid for upgrade)

**Payment Forms**:
- Stripe Elements integration
- Card layout: Single column on mobile, two-column on desktop
- Field spacing: space-y-4
- Clear labels with helper text (text-sm text-gray-500)

### Forms & Inputs

**Standard Form Fields**:
- Label: text-sm font-medium mb-1
- Input: p-3 rounded-lg border focus:ring-2 focus:ring-offset-2
- Helper text: text-xs mt-1
- Error states: Red border + error message below

**Toggle Switches**: 
- Feature flags, settings
- Label on left, switch on right
- Size: h-6 w-11

**Dropdowns/Selects**:
- Custom styled with chevron icon
- Menu: absolute, rounded-lg, shadow-lg, max-h-60 overflow-auto

### Modals & Overlays

**Modal Structure**:
- Backdrop: fixed inset-0 bg-black/50 backdrop-blur-sm
- Container: max-w-lg mx-auto mt-20
- Content: rounded-xl shadow-2xl p-6
- Header: Title + Close button (top-right)
- Footer: Action buttons (right-aligned, gap-3)

**Toast Notifications**:
- Fixed bottom-right: bottom-8 right-8
- Slide-in animation from right
- Auto-dismiss after 5s
- Types: Success, Error, Warning, Info with icons

---

## Page-Specific Layouts

### Login Page
- Centered card layout: max-w-md mx-auto mt-24
- Logo at top
- Form fields with social login options below
- "Create account" / "Forgot password" links
- Background: Gradient or subtle pattern

### Dashboard Home
- Top: 4 metric cards in grid
- Middle: Connection status cards (2-column on desktop)
- Bottom: Recent activity feed + Quick actions

### Device Management
- Header: "Add Device" button (top-right)
- Grid of device cards showing QR codes when not connected
- Connected devices: List with status, metrics, actions

### Chat Management
- Split layout: Conversations list (30%) + Active chat (70%)
- Filters/search above conversation list
- Bulk actions toolbar when items selected

### Logic Editor
- Full-height split panel layout
- Sticky toolbar at top
- Template library in slide-out drawer (right side)

### Billing/Plans
- Current plan card at top (highlighted)
- Plan comparison table below
- Payment history section (collapsible)
- Invoice download links

---

## Responsive Behavior

**Breakpoints**:
- Mobile: < 640px - Stack all layouts, hamburger menu
- Tablet: 640px-1024px - 2-column grids, collapsible sidebar
- Desktop: > 1024px - Full multi-column layouts, expanded sidebar

**Mobile Adaptations**:
- Sidebar becomes bottom navigation bar or hamburger
- Cards stack to single column
- Chat: Full-screen conversation view (back button to list)
- Tables: Horizontal scroll or card-based layout
- Forms: Full-width inputs with larger touch targets (min-h-12)

---

## Animations

**Minimal, Purposeful Motion**:
- Page transitions: Subtle fade (150ms)
- Sidebar expand/collapse: Smooth width transition (200ms)
- Modal entry: Scale + fade (300ms)
- Toast notifications: Slide-in from right (250ms)
- Loading states: Subtle pulse on skeleton screens
- Connection status: Gentle pulse on active indicator

**Avoid**: Excessive hover effects, distracting parallax, auto-playing animations

---

## Accessibility

- All interactive elements: min-h-11 for touch targets
- Form fields: Explicit labels, aria-labels for icon buttons
- Focus indicators: Visible ring on all focusable elements
- Color contrast: WCAG AA minimum for all text
- Keyboard navigation: Full support with visible focus states
- Screen reader: Semantic HTML, ARIA landmarks, live regions for real-time updates