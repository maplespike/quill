# CivicIntel — UX Refactor Plan

## Current State Assessment

### What's Working
- **6 views properly structured** with clear tab navigation
- **Keyboard shortcuts** (⌘K for search, 1-6 for tabs, Escape to close)
- **Theme system** with 5 variants working
- **Data layer** solid: real Canadian government data loaded
- **Pretext components** integrated for editorial layouts
- **Graph visualization** functional with hover states

### Critical UX Gaps

#### 1. No Clear User Journey
**Problem:** Users land on Monitor with no guidance on what to do next.

**Current flow:**
```
User opens app → Monitor dashboard → ??? → Maybe clicks tabs randomly
```

**Needed flow:**
```
User opens app → Onboarding modal (first visit) OR
                 Brief view (returning) with key insight highlighted →
                 Clear CTA to "Explore this thread" or "See all signals"
```

#### 2. Information Overload on Monitor
**Problem:** Monitor throws 7 stats, 3 charts, 4 panels at user simultaneously.

**Issues:**
- Header stats row competes with side panels
- Signal distribution chart buried in center
- No visual hierarchy — everything same visual weight
- Ticker is eye-catching but secondary information

#### 3. No Narrative Throughline
**Problem:** Each view is isolated. No thread connecting views.

**Example:** User sees a signal in Monitor → clicks it → …nothing happens. No drill-down.

**Needed:**
- Click signal card → opens in Explorer with that thread focused
- Click entity name → shows entity profile
- "View full brief" button from signal card

#### 4. Explorer Has Two Modes Hidden
**Problem:** Explorer has Graph/Contracts/Entities tabs but they feel like separate apps.

**Issues:**
- Graph tab doesn't show what to do
- Entity detail panel appears only on selection
- No relationship to other views

#### 5. Brief View Is Beautiful But Isolated
**Problem:** BriefView is a showcase but doesn't connect to actions.

**Needed:**
- "Explore this connection" button on each signal card
- Entity chips should link to Explorer
- Share/export CTAs

#### 6. Signals View Is a List, Not an Alert System
**Problem:** Signals view shows threads but lacks urgency hierarchy.

**Issues:**
- Dismissed signals disappear (no archive)
- No notification for new signals
- Filter state lost on navigation

---

## Refactoring Priorities

### Phase 1: Navigation & Drill-Down (Critical)

#### 1.1 Cross-View Linking
Make every clickable element navigate meaningfully:

```tsx
// Signal card in Monitor → Explorer with thread focused
<Button onClick={() => {
  setActiveView('explore');
  setExplorerFocusEntity(thread.primaryEntity);
  setExplorerThreadFilter(thread.id);
}}>
  Explore →
</Button>

// Entity chip in Brief → Entity profile panel
<IntelChip
  entity={entity}
  onClick={() => {
    setActiveView('explore');
    setExplorerFocusEntity(entity.id);
  }}
/>

// Signal in Signals → Brief focused on that thread
<Button onClick={() => {
  setActiveView('brief');
  setBriefFocusThread(thread.id);
}}>
  Read Brief →
</Button>
```

#### 1.2 URL State Sync
Enable deep linking:

```tsx
// URL structure: /?view=explore&entity=person-123&thread=thread-456
const [searchParams, setSearchParams] = useSearchParams();
const view = searchParams.get('view') || 'monitor';
const entity = searchParams.get('entity');
const thread = searchParams.get('thread');
```

---

### Phase 2: Visual Hierarchy Refactor (High)

#### 2.1 Monitor Dashboard Restructure

**Before:**
```
┌─────────────────────────────────────────────────┐
│ [Stats row: 6 numbers competing for attention]  │
├─────────────────────────────────────────────────┤
│ Left Panel    │   Center (charts)   │ Right     │
│ (anomalies)   │   (competing)       │ (signals) │
└─────────────────────────────────────────────────┘
```

**After:**
```
┌─────────────────────────────────────────────────┐
│ ONE KEY METRIC: "7 signals detected" [pulse]    │
│ "3 require attention" → [View Signals]          │
├─────────────────────────────────────────────────┤
│ PRIORITY SIGNAL CARD (expanded, actionable)     │
│ ┌─────────────────────────────────────────────┐ │
│ │ ⚡ PROCUREMENT-LOBBYING OVERLAP             │ │
│ │ L3Harris holds DND contracts while          │ │
│ │ lobbying same department                    │ │
│ │ [Explore Thread] [Read Brief] [Dismiss]     │ │
│ └─────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────┤
│ Signal Distribution (small) │ Spending Trend   │
├─────────────────────────────────────────────────┤
│ [Ticker: Recent activity]                       │
└─────────────────────────────────────────────────┘
```

#### 2.2 Visual Weight System

```css
/* Tier 1: Hero (one per view) */
.hero-card {
  padding: 24px;
  border: 2px solid var(--primary);
  box-shadow: var(--glow-primary);
}

/* Tier 2: Primary actions */
.primary-card {
  padding: 16px;
  border: 1px solid var(--border);
  background: var(--card);
}

/* Tier 3: Context */
.context-panel {
  padding: 12px;
  opacity: 0.8;
  font-size: 0.875rem;
}

/* Tier 4: Background */
.ticker, .stats-row {
  font-size: 0.75rem;
  opacity: 0.6;
}
```

---

### Phase 3: User Journey Orchestration (Medium)

#### 3.1 First-Time User Experience

```tsx
// On first visit (no localStorage flag)
function OnboardingModal() {
  const [step, setStep] = useState(0);

  return (
    <Modal>
      {step === 0 && (
        <>
          <h1>CivicIntel watches Canadian government</h1>
          <p>Trace money, lobbying, and connections across:</p>
          <ul>
            <li>Federal contracts</li>
            <li>Lobbying activity</li>
            <li>Political donations</li>
            <li>Ethics disclosures</li>
          </ul>
          <Button onClick={() => setStep(1)}>See an example →</Button>
        </>
      )}
      {step === 1 && (
        <>
          <h2>A "signal" is a detected connection</h2>
          <SignalCard thread={exampleThread} expanded />
          <p>7 signal types detected automatically:</p>
          <SignalTypeGrid />
          <Button onClick={() => {
            localStorage.setItem('onboarded', 'true');
            onClose();
          }}>
            Start Exploring
          </Button>
        </>
      )}
    </Modal>
  );
}
```

#### 3.2 Returning User Experience

```tsx
// Returning user lands on Brief with highlighted insight
function BriefView() {
  const lastViewedThread = localStorage.getItem('lastThread');

  useEffect(() => {
    if (lastViewedThread) {
      // Scroll to that thread's card
      document.getElementById(`thread-${lastViewedThread}`)?.scrollIntoView();
    }
  }, []);
}
```

---

### Phase 4: Action System (Medium)

#### 4.1 Every Card Has Actions

```tsx
interface SignalCardProps {
  thread: IntelligenceThread;
  actions?: {
    explore?: boolean;    // Link to Explorer
    brief?: boolean;      // Link to Brief
    dismiss?: boolean;    // Hide from feed
    snooze?: boolean;     // Hide for 24h
    verify?: boolean;     // Social: verify (prototype)
    share?: boolean;      // Share brief
  };
}

function SignalCard({ thread, actions = { explore: true, brief: true } }) {
  return (
    <Card>
      {/* Content */}
      <div className="flex gap-2 mt-4">
        {actions.explore && (
          <Button size="sm" onClick={() => navigateToExplorer(thread)}>
            Explore →
          </Button>
        )}
        {actions.brief && (
          <Button size="sm" variant="ghost" onClick={() => navigateToBrief(thread)}>
            Read Brief
          </Button>
        )}
        {actions.dismiss && (
          <Button size="sm" variant="ghost" onClick={() => dismissThread(thread.id)}>
            Dismiss
          </Button>
        )}
      </div>
    </Card>
  );
}
```

#### 4.2 Entity Profile Actions

```tsx
function EntityProfilePanel({ entity }) {
  return (
    <Panel>
      <EntityHeader entity={entity} />
      <Tabs defaultValue="connections">
        <Tab value="connections">
          <ConnectionList entity={entity} />
        </Tab>
        <Tab value="timeline">
          <EntityTimeline entity={entity} />
        </Tab>
        <Tab value="signals">
          <EntitySignals entity={entity} />
        </Tab>
      </Tabs>
      <ActionBar>
        <Button onClick={() => shareEntity(entity)}>Share Profile</Button>
        <Button onClick={() => watchEntity(entity)}>Watch Entity</Button>
      </ActionBar>
    </Panel>
  );
}
```

---

### Phase 5: Polish & Responsiveness (Lower)

#### 5.1 Mobile Layout

Current: Views don't adapt well below 768px.

Needed:
- Collapsible sidebar (hamburger)
- Stacked panels on mobile
- Touch-friendly card heights (min 48px tap targets)
- Swipe gestures for tab navigation

#### 5.2 Loading States

```tsx
// Skeleton loaders for each view
function MonitorSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="h-8 w-64 bg-[var(--border)] rounded mb-4" />
      <div className="h-48 bg-[var(--border)] rounded mb-4" />
      <div className="grid grid-cols-3 gap-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-32 bg-[var(--border)] rounded" />
        ))}
      </div>
    </div>
  );
}
```

#### 5.3 Empty States

```tsx
function EmptySignalsState() {
  return (
    <div className="flex flex-col items-center justify-center h-64 text-center">
      <div className="text-4xl mb-4">✓</div>
      <h3 className="text-lg font-medium mb-2">All caught up</h3>
      <p className="text-[var(--muted)]">
        No signals match your current filters.
      </p>
      <Button onClick={() => resetFilters()} className="mt-4">
        Clear Filters
      </Button>
    </div>
  );
}
```

---

## Implementation Order

| Phase | Priority | Effort | Impact |
|-------|----------|--------|--------|
| 1. Cross-view linking | Critical | Medium | High |
| 2. Visual hierarchy | High | Medium | High |
| 3. User journey | Medium | High | High |
| 4. Action system | Medium | Medium | Medium |
| 5. Polish | Lower | Medium | Medium |

---

## Files to Modify

### Phase 1
- `packages/web/lib/store.ts` — Add `setBriefFocusThread`, `setExplorerThreadFilter`
- `packages/web/app/page.tsx` — Add URL state sync with `useSearchParams`
- `packages/web/components/MonitorDashboard.tsx` — Add action buttons to signal cards
- `packages/web/components/SignalsView.tsx` — Add navigate-to-brief button
- `packages/web/components/BriefView.tsx` — Handle focus thread prop

### Phase 2
- `packages/web/app/globals.css` — Add visual weight tier classes
- `packages/web/components/MonitorDashboard.tsx` — Restructure layout
- `packages/web/components/*.tsx` — Apply visual weight classes

### Phase 3
- `packages/web/components/OnboardingModal.tsx` — New component
- `packages/web/app/page.tsx` — Add onboarding check

### Phase 4
- `packages/web/components/SignalCard.tsx` — Extract as reusable component
- `packages/web/components/EntityProfilePanel.tsx` — New component
- `packages/web/components/ActionButtons.tsx` — New component

### Phase 5
- `packages/web/app/globals.css` — Mobile breakpoints
- All view components — Add skeletons and empty states

---

## Success Metrics

After refactoring, users should be able to:

1. **Land with purpose** — Know what to do within 5 seconds of opening app
2. **Drill down naturally** — Click any entity/signal and end up in the right view
3. **Understand hierarchy** — Know what's most important on each screen
4. **Take action** — Every card has a clear next step
5. **Return easily** — Deep links work; state persists

## Progress Log

### Phase 1: Cross-View Linking — DONE

**Commit:** `7b2f637`

- ✅ Store updated with `focusThread`, `focusEntity`, `navigateTo()`
- ✅ `useURLSync` hook for deep linking (`?view=explore&entity=person-123`)
- ✅ Reusable `SignalCard` component with Explore →, Read Brief, Share, Dismiss actions
- ✅ MonitorDashboard using shared SignalCard
- ✅ URL state sync in main page

### Pre-existing Issues Found

**`packages/core/src/sweep/engine.ts`** — This file has never compiled:
1. Missing closing brace for `for filing` loop in `extractPersons` (off-by-one indentation)
2. Parser API mismatches throughout — calls `parseCsv()`/`parseXml()` instead of actual method names (`parseProactiveDisclosure()`, `parseRegistrations()`, etc.)
3. `runAllDetectors()` called with 2 args but expects 9

The tests pass because they don't import engine.ts. This file needs a full rewrite to match the actual parser APIs.
