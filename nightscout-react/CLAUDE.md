# CLAUDE.md - Nightscout React Frontend

Dieses Dokument bietet umfassende Anleitungen für AI-Assistenten (wie Claude), die am **Nightscout React Frontend** arbeiten.

**Last Updated:** 2025-11-20
**React Version:** 19.2.0
**Build Tool:** Vite 7.2.2
**TypeScript Version:** 5.9.3

---

## ✅ Du bist im richtigen Projekt!

**Dies ist das moderne React/TypeScript Frontend für Nightscout.**

- ✅ **Hier arbeiten:** `/nightscout-react/` - Modernes React Frontend
- ❌ **NICHT bearbeiten:** `/lib/` - Legacy Node.js/jQuery Frontend

**Alle Frontend-Änderungen erfolgen ausschließlich in diesem Verzeichnis!**

---

## Inhaltsverzeichnis

1. [Technologie-Stack](#technologie-stack)
2. [Projektstruktur](#projektstruktur)
3. [Entwicklungsworkflow](#entwicklungsworkflow)
4. [Code-Konventionen](#code-konventionen)
5. [Komponenten-Architektur](#komponenten-architektur)
6. [State Management](#state-management)
7. [Styling mit Tailwind CSS](#styling-mit-tailwind-css)
8. [Chart-Implementierung](#chart-implementierung)
9. [Häufige Aufgaben](#häufige-aufgaben)
10. [Testing](#testing)
11. [Troubleshooting](#troubleshooting)

---

## Technologie-Stack

### Core

- **React 19.2.0** - UI Framework
- **TypeScript 5.9.3** - Type-safe JavaScript
- **Vite 7.2.2** - Build Tool & Dev Server
- **React DOM 19.2.0** - DOM Rendering

### State Management

- **Zustand 5.0.8** - Lightweight state management
  - `/stores/bgStore.ts` - Blood glucose data state
  - `/stores/settingsStore.ts` - User preferences & settings

### UI & Styling

- **Tailwind CSS 3.4.17** - Utility-first CSS framework
- **Framer Motion 12.23.24** - Animation library
- **clsx 2.1.1** + **tailwind-merge 3.4.0** - Class name utilities
- **Lucide React 0.554.0** - Icon library

### Charts & Visualization

- **uPlot 1.6.32** - High-performance chart library (aktuell verwendet)
- **Recharts 3.4.1** - Alternative React chart library (verfügbar)

### Real-time Communication

- **Socket.io Client 4.8.1** - WebSocket communication für live updates

### Utilities

- **Day.js 1.11.19** - Date/time library (leichtgewichtiger als Moment.js)

---

## Projektstruktur

```
nightscout-react/
├── src/
│   ├── components/          # React-Komponenten
│   │   ├── bg-display/     # Blutzucker-Anzeige Komponenten
│   │   │   └── BgDisplay.tsx
│   │   ├── chart/          # Chart-Komponenten
│   │   │   ├── VirtualChart.tsx      # Haupt-Chart mit Virtualisierung
│   │   │   ├── ChartTooltip.tsx      # Custom Tooltip
│   │   │   ├── VerticalCursorLine.tsx # Cursor für Chart
│   │   │   └── CurrentValueWindow.tsx # Aktueller Wert Overlay
│   │   ├── pills/          # Status Pills (IOB, COB, etc.)
│   │   │   └── Pills.tsx
│   │   ├── settings/       # Einstellungen Modal
│   │   │   └── SettingsModal.tsx
│   │   ├── layout/         # Layout-Komponenten
│   │   └── ui/             # Wiederverwendbare UI-Komponenten
│   │
│   ├── hooks/              # Custom React Hooks
│   │   ├── useBgData.ts   # Hook für BG-Daten laden
│   │   └── useSocket.ts   # Socket.io Connection Hook
│   │
│   ├── stores/             # Zustand State Stores
│   │   ├── bgStore.ts     # BG-Daten State
│   │   └── settingsStore.ts # Einstellungen State
│   │
│   ├── lib/                # Utility Functions & API
│   │   ├── api.ts         # REST API Client
│   │   ├── socket.ts      # Socket.io Setup
│   │   └── utils.ts       # Helper Functions
│   │
│   ├── types/              # TypeScript Type Definitions
│   │   └── index.ts       # Gemeinsame Types
│   │
│   ├── assets/             # Statische Assets (Bilder, etc.)
│   ├── pages/              # Page Components (falls Routing hinzugefügt wird)
│   │
│   ├── App.tsx             # Haupt-App-Komponente
│   ├── App.css             # App-spezifische Styles
│   ├── main.tsx            # React Entry Point
│   └── index.css           # Globale Styles & Tailwind
│
├── public/                 # Öffentliche statische Dateien
│
├── .env.development        # Development Environment Variables
├── .env.development.local  # Lokale Overrides (nicht in Git)
├── vite.config.ts          # Vite Konfiguration
├── tsconfig.json           # TypeScript Base Config
├── tsconfig.app.json       # TypeScript App Config
├── tsconfig.node.json      # TypeScript Node Config
├── tailwind.config.js      # Tailwind CSS Konfiguration
├── postcss.config.js       # PostCSS Konfiguration
├── eslint.config.js        # ESLint Konfiguration
└── package.json            # Dependencies & Scripts
```

---

## Entwicklungsworkflow

### Installation

```bash
cd nightscout-react
npm install
```

### Development Server starten

```bash
npm run dev
```

Server läuft auf: `http://localhost:5173`

### Build für Production

```bash
npm run build
```

Build-Output: `dist/`

### Preview Production Build

```bash
npm run preview
```

### Linting

```bash
npm run lint
```

---

## Code-Konventionen

### TypeScript

**Datei-Endungen:**
- `.tsx` - React-Komponenten mit JSX
- `.ts` - TypeScript-Dateien ohne JSX

**Type-Safety:**
- ✅ **DO:** Immer explizite Types definieren
- ✅ **DO:** Interface für Komponenten-Props verwenden
- ❌ **DON'T:** `any` verwenden (außer in Ausnahmefällen)
- ❌ **DON'T:** `@ts-ignore` ohne guten Grund

**Beispiel:**

```typescript
// ✅ Good
interface BgDisplayProps {
  value: number;
  timestamp: Date;
  trend?: string;
}

export const BgDisplay: React.FC<BgDisplayProps> = ({ value, timestamp, trend }) => {
  // ...
}

// ❌ Bad
export const BgDisplay = (props: any) => {
  // ...
}
```

### Komponenten-Struktur

**Datei-Organisation:**
```
component-name/
├── ComponentName.tsx       # Haupt-Komponente
├── SubComponent.tsx        # Sub-Komponente (falls nötig)
└── index.ts               # Re-export (optional)
```

**Komponenten-Template:**

```typescript
import { useState, useEffect } from 'react';
import { clsx } from 'clsx';

interface ComponentNameProps {
  // Props hier definieren
  value: number;
  className?: string;
}

export const ComponentName: React.FC<ComponentNameProps> = ({
  value,
  className
}) => {
  // State
  const [localState, setLocalState] = useState<number>(0);

  // Effects
  useEffect(() => {
    // Effect logic
  }, [value]);

  // Handlers
  const handleClick = () => {
    // Handler logic
  };

  // Render
  return (
    <div className={clsx('base-classes', className)}>
      {/* JSX hier */}
    </div>
  );
};
```

### Naming Conventions

**Dateien:**
- Komponenten: `PascalCase.tsx` (z.B. `BgDisplay.tsx`)
- Utilities: `camelCase.ts` (z.B. `formatDate.ts`)
- Hooks: `useCamelCase.ts` (z.B. `useBgData.ts`)
- Stores: `camelCaseStore.ts` (z.B. `bgStore.ts`)

**Variablen & Funktionen:**
- `camelCase` für Variablen, Funktionen
- `PascalCase` für Komponenten, Interfaces, Types
- `UPPER_SNAKE_CASE` für Konstanten

**Beispiele:**

```typescript
// Komponenten
export const BgDisplay: React.FC = () => { };

// Interfaces
interface BgEntry {
  sgv: number;
  date: number;
}

// Funktionen
const formatBgValue = (value: number): string => { };

// Konstanten
const MAX_BG_VALUE = 400;
const MIN_BG_VALUE = 40;
```

### Import-Reihenfolge

```typescript
// 1. React & externe Libraries
import { useState, useEffect } from 'react';
import { clsx } from 'clsx';

// 2. Stores & Hooks
import { useBgStore } from '@/stores/bgStore';
import { useSocket } from '@/hooks/useSocket';

// 3. Components
import { BgDisplay } from '@/components/bg-display/BgDisplay';

// 4. Utils & Types
import { formatBgValue } from '@/lib/utils';
import type { BgEntry } from '@/types';

// 5. Styles (falls separate CSS-Dateien)
import './styles.css';
```

---

## Komponenten-Architektur

### Haupt-Komponenten

#### 1. App.tsx

Die Root-Komponente, die das Layout und die Hauptstruktur definiert.

**Verantwortlichkeiten:**
- Socket-Verbindung initialisieren
- Initiale Daten laden
- Theme Management
- Layout-Struktur

**Struktur:**
```typescript
- Header (Titel + Settings Button)
- BG Display + Pills (Grid Layout)
- VirtualChart (Full Width)
- Footer
- SettingsModal
```

#### 2. BgDisplay

Zeigt den aktuellen Blutzuckerwert an.

**Features:**
- Großer, farbcodierter BG-Wert
- Trend-Pfeil (↑ ↗ → ↘ ↓)
- Delta-Berechnung
- "vor X Minuten" Zeitstempel
- Stale-Data-Warnung

**Farben:**
- Grün: In Range (70-180 mg/dL)
- Gelb: Leicht außerhalb
- Rot: Kritisch (<55 oder >250)

#### 3. VirtualChart

Interaktiver Glukose-Chart mit Virtualisierung.

**Features:**
- Zeit-Range-Buttons (2h, 6h, 12h, 24h)
- Farbcodierte BG-Werte nach Range
- Target-Zonen (High/Low Lines)
- Custom Tooltip
- Auto-Scaling Y-Achse
- Virtualisierung für Performance

**Sub-Komponenten:**
- `ChartTooltip` - Custom Tooltip für Datenpunkte
- `VerticalCursorLine` - Vertikale Cursor-Linie
- `CurrentValueWindow` - Aktueller Wert Overlay

#### 4. Pills

Zeigt Status-Informationen in Pill-Form.

**Anzeigen:**
- IOB (Insulin on Board)
- COB (Carbs on Board)
- Pump Battery %
- Reservoir ml
- Uploader Battery %

**Farben:**
- Grün: Normal
- Gelb: Warnung
- Rot: Kritisch

#### 5. SettingsModal

Modal für Benutzereinstellungen.

**Einstellungen:**
- Theme (Dark/Light/Auto)
- Units (mg/dL / mmol/L)
- Time Format (12h / 24h)
- Target Ranges
- Sound Alerts

---

## State Management

### Zustand Stores

Das Projekt verwendet **Zustand** für State Management - eine leichtgewichtige Alternative zu Redux.

#### bgStore.ts - Blood Glucose State

**Zuständig für:**
- BG-Einträge (entries)
- Treatments
- Device Status
- Profile-Daten

**Struktur:**

```typescript
interface BgStore {
  // Data
  entries: BgEntry[];
  treatments: Treatment[];
  devicestatus: DeviceStatus[];
  profile: Profile | null;

  // Status
  isLoading: boolean;
  lastUpdate: Date | null;

  // Actions
  setEntries: (entries: BgEntry[]) => void;
  addEntry: (entry: BgEntry) => void;
  setTreatments: (treatments: Treatment[]) => void;
  setDeviceStatus: (status: DeviceStatus[]) => void;
  setProfile: (profile: Profile) => void;

  // Computed
  latestEntry: () => BgEntry | null;
  entriesInRange: (hours: number) => BgEntry[];
}
```

**Verwendung:**

```typescript
import { useBgStore } from '@/stores/bgStore';

const MyComponent = () => {
  // Selektive Subscriptions (nur re-render bei Änderung)
  const entries = useBgStore(state => state.entries);
  const latestEntry = useBgStore(state => state.latestEntry());

  // Actions
  const setEntries = useBgStore(state => state.setEntries);

  return <div>{latestEntry?.sgv}</div>;
};
```

#### settingsStore.ts - User Settings

**Zuständig für:**
- Theme
- Units
- Time Format
- Target Ranges
- Alert Settings

**Persistence:**
- Speichert in `localStorage`
- Auto-load beim App-Start

**Struktur:**

```typescript
interface SettingsStore {
  // Display
  theme: 'dark' | 'light' | 'auto';
  units: 'mg/dl' | 'mmol/l';
  timeFormat: '12h' | '24h';

  // Ranges
  targetLow: number;
  targetHigh: number;
  urgentLow: number;
  urgentHigh: number;

  // Alerts
  soundAlerts: boolean;

  // Actions
  setTheme: (theme: Theme) => void;
  setUnits: (units: Units) => void;
  // ...
}
```

---

## Styling mit Tailwind CSS

### Theme-System

Das Projekt verwendet ein **Custom Tailwind Theme** mit CSS Custom Properties für Dark/Light Mode.

**Definition in `index.css`:**

```css
:root {
  /* Light Mode */
  --color-bg-primary: #f8fafc;
  --color-text-primary: #1e293b;
  /* ... */
}

body:not(.light) {
  /* Dark Mode (default) */
  --color-bg-primary: #0f172a;
  --color-text-primary: #f1f5f9;
  /* ... */
}
```

**Tailwind Konfiguration:**

```javascript
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      colors: {
        // BG Colors
        'surface-0': 'var(--color-surface-0)',
        'surface-1': 'var(--color-surface-1)',
        'surface-2': 'var(--color-surface-2)',

        // Text Colors
        'text-primary': 'var(--color-text-primary)',
        'text-secondary': 'var(--color-text-secondary)',

        // BG Status Colors
        'bg-in-range': 'var(--color-bg-in-range)',
        'bg-urgent-low': 'var(--color-bg-urgent-low)',
        'bg-urgent-high': 'var(--color-bg-urgent-high)',
      }
    }
  }
}
```

### Styling-Konventionen

**DO's:**
- ✅ Verwende Tailwind Utility Classes
- ✅ Nutze Custom Colors aus Theme
- ✅ Verwende `clsx()` für bedingte Classes
- ✅ Responsive Design mit `md:` `lg:` Prefixes
- ✅ Dark Mode berücksichtigen

**DON'Ts:**
- ❌ Inline Styles vermeiden
- ❌ Keine Hardcoded Colors (#fff, rgb(), etc.)
- ❌ Keine Custom CSS-Dateien ohne Grund

**Beispiel:**

```typescript
import { clsx } from 'clsx';

// ✅ Good
<div className={clsx(
  'rounded-lg p-4 transition-colors',
  'bg-surface-1 hover:bg-surface-2',
  'text-text-primary',
  isActive && 'ring-2 ring-blue-500'
)}>
  Content
</div>

// ❌ Bad
<div style={{
  backgroundColor: '#1e293b',
  color: 'white',
  padding: '16px'
}}>
  Content
</div>
```

### Responsive Design

**Breakpoints:**
- `sm`: 640px
- `md`: 768px (Tablet)
- `lg`: 1024px (Desktop)
- `xl`: 1280px

**Mobile-First Approach:**

```typescript
<div className="
  grid
  grid-cols-1        // Mobile: 1 Spalte
  md:grid-cols-2     // Tablet: 2 Spalten
  lg:grid-cols-3     // Desktop: 3 Spalten
  gap-3
">
  {/* Content */}
</div>
```

---

## Chart-Implementierung

### Aktuelle Implementierung: uPlot

Das Projekt verwendet **uPlot** für die Glukose-Visualisierung - eine hochperformante Canvas-basierte Chart-Library.

**Hauptdatei:** `src/components/chart/VirtualChart.tsx`

**Features:**
- High-performance Canvas-Rendering mit uPlot
- Farbcodierte Datenpunkte nach BG-Range
- Farbcodierte Hintergrund-Zonen (Urgent Low/Low/Normal/High/Urgent High)
- Custom Tooltip mit Vertical Cursor Line
- Pan & Zoom mit Maus-Drag
- Zeit-Range-Auswahl (2h, 6h, 12h, 24h)
- Viewport-basierte Datenvirtualisierung
- Automatisches Nachladen älterer/neuerer Daten
- Responsive Sizing

**uPlot Setup:**

```typescript
const opts: uPlot.Options = {
  width: chartRef.current.clientWidth,
  height: 500,
  plugins: [bgZonesPlugin, coloredPointsPlugin],
  scales: {
    x: {
      time: true,
      range: [
        (viewport.center - viewport.rangeMs / 2) / 1000,
        (viewport.center + viewport.rangeMs / 2) / 1000,
      ],
    },
    y: {
      range: [
        Math.max(40, alarmUrgentLow - 20),
        Math.min(400, alarmUrgentHigh + 20),
      ],
    },
  },
  series: [
    {},
    {
      label: 'BG',
      stroke: 'transparent', // No line
      points: { show: false }, // Custom points via plugin
    },
  ],
  axes: [
    {
      stroke: '#ffffff',
      grid: { show: true, stroke: 'rgba(255, 255, 255, 0.1)' },
    },
    {
      stroke: '#ffffff',
      grid: { show: true, stroke: 'rgba(255, 255, 255, 0.1)' },
    },
  ],
  cursor: { show: false }, // Custom cursor implementation
};
```

**Custom Plugins:**

Das Chart verwendet zwei Custom uPlot Plugins:

1. **bgZonesPlugin** - Zeichnet farbcodierte Hintergrund-Zonen:
   ```typescript
   const bgZonesPlugin: uPlot.Plugin = {
     hooks: {
       draw: [(u) => {
         const { ctx } = u;
         const { left, top, width, height } = u.bbox;

         ctx.save();
         ctx.beginPath();
         ctx.rect(left, top, width, height);
         ctx.clip(); // Wichtig: Clipping!

         // Zonen zeichnen...
         ctx.restore();
       }],
     },
   };
   ```

2. **coloredPointsPlugin** - Zeichnet farbcodierte Datenpunkte:
   ```typescript
   const coloredPointsPlugin: uPlot.Plugin = {
     hooks: {
       drawSeries: [(u, seriesIdx) => {
         if (seriesIdx !== 1) return;

         const { ctx } = u;
         const { left, top, width, height } = u.bbox;

         ctx.save();
         ctx.beginPath();
         ctx.rect(left, top, width, height);
         ctx.clip(); // Wichtig: Clipping!

         // Punkte zeichnen...
         for (let i = 0; i < xData.length; i++) {
           const cx = u.valToPos(xData[i], 'x', true);
           const cy = u.valToPos(yData[i], 'y', true);
           const color = getColorForValue(yData[i]);

           ctx.fillStyle = color;
           ctx.beginPath();
           ctx.arc(cx, cy, 3, 0, 2 * Math.PI); // Radius 3 = Durchmesser 6px
           ctx.fill();
         }

         ctx.restore();
       }],
     },
   };
   ```

**BG-Farbcodierung:**

```typescript
const getBgColor = (sgv: number, targetLow: number, targetHigh: number) => {
  if (sgv < 55) return '#ef4444';        // Rot: Urgent Low
  if (sgv < targetLow) return '#f59e0b'; // Orange: Low
  if (sgv <= targetHigh) return '#10b981'; // Grün: In Range
  if (sgv <= 250) return '#f59e0b';      // Orange: High
  return '#ef4444';                       // Rot: Urgent High
};
```

### Performance-Optimierung

**uPlot ist bereits hochperformant!** Die Verwendung von Canvas und die effizienten Rendering-Hooks machen es ideal für große Datenmengen.

**Implementierte Optimierungen:**

1. **Viewport-basierte Datenvirtualisierung:**
   - Nur sichtbare Datenpunkte werden geladen (`useVisibleEntries`)
   - Store filtert Einträge basierend auf aktuellem Viewport
   ```typescript
   const visibleEntries = useVisibleEntries(); // Nur Daten im sichtbaren Bereich
   ```

2. **Lazy Loading:**
   - Automatisches Nachladen beim Scrollen
   - Proaktives Laden wenn Viewport-Rand nahe kommt
   - Siehe `checkAndLoadOlderData()` / `checkAndLoadNewerData()`

3. **Memoization:**
   - Chart-Daten werden nur bei Änderung neu berechnet
   ```typescript
   const chartData = useMemo(() => {
     // Konvertierung nur wenn visibleEntries sich ändert
   }, [visibleEntries]);
   ```

4. **Canvas Clipping:**
   - Verhindert unnötiges Zeichnen außerhalb des sichtbaren Bereichs
   - In beiden Plugins implementiert (`bgZonesPlugin`, `coloredPointsPlugin`)

5. **Chart Update ohne Destroy:**
   - Daten-Updates erfolgen über `setData()` statt Chart neu zu erstellen
   - Nur bei Setting-Änderungen wird Chart neu erstellt

**Typische Performance:**
- ✅ 1000+ Datenpunkte: Smooth (dank Viewport-Virtualisierung)
- ✅ Pan/Zoom: Instant
- ✅ Data Updates: < 16ms (60 FPS)

---

## Häufige Aufgaben

### 1. Neue Komponente hinzufügen

```bash
# Erstelle Komponenten-Verzeichnis
mkdir src/components/my-component

# Erstelle Komponente
touch src/components/my-component/MyComponent.tsx
```

**Template:**

```typescript
// src/components/my-component/MyComponent.tsx
import { clsx } from 'clsx';

interface MyComponentProps {
  className?: string;
}

export const MyComponent: React.FC<MyComponentProps> = ({ className }) => {
  return (
    <div className={clsx('bg-surface-1 rounded-lg p-4', className)}>
      {/* Content */}
    </div>
  );
};
```

### 2. Neuen Custom Hook hinzufügen

```typescript
// src/hooks/useMyHook.ts
import { useState, useEffect } from 'react';

export const useMyHook = () => {
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    // Logic
  }, []);

  return { data };
};
```

### 3. Store erweitern

```typescript
// src/stores/myStore.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface MyStore {
  value: number;
  setValue: (value: number) => void;
}

export const useMyStore = create<MyStore>()(
  persist(
    (set) => ({
      value: 0,
      setValue: (value) => set({ value }),
    }),
    {
      name: 'my-store', // localStorage key
    }
  )
);
```

### 4. API-Endpoint hinzufügen

```typescript
// src/lib/api.ts

export const fetchMyData = async (): Promise<MyData> => {
  const response = await fetch('/api/v1/mydata.json');
  if (!response.ok) {
    throw new Error('Failed to fetch data');
  }
  return response.json();
};
```

### 5. Neue TypeScript Type definieren

```typescript
// src/types/index.ts

export interface MyType {
  id: string;
  value: number;
  timestamp: Date;
}

export type MyStatus = 'active' | 'inactive' | 'pending';
```

### 6. Theme Color hinzufügen

**1. CSS Variable definieren:**

```css
/* src/index.css */
:root {
  --color-my-new-color: #3b82f6;
}

body:not(.light) {
  --color-my-new-color: #60a5fa;
}
```

**2. Tailwind Config erweitern:**

```javascript
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      colors: {
        'my-new-color': 'var(--color-my-new-color)',
      }
    }
  }
}
```

**3. Verwenden:**

```typescript
<div className="bg-my-new-color text-white">
  Content
</div>
```

### 7. Chart-Datenpunkt-Größe ändern

**Datei:** `src/components/chart/VirtualChart.tsx`

**Suche nach dem `coloredPointsPlugin`:**

```typescript
// In der drawSeries Funktion
ctx.arc(cx, cy, 3, 0, 2 * Math.PI); // ← Radius hier ändern
```

**Beispiel - Größere Punkte:**
```typescript
// Radius 3 = Durchmesser 6px (aktuell)
ctx.arc(cx, cy, 3, 0, 2 * Math.PI);

// Radius 4 = Durchmesser 8px (größer)
ctx.arc(cx, cy, 4, 0, 2 * Math.PI);

// Radius 2 = Durchmesser 4px (kleiner)
ctx.arc(cx, cy, 2, 0, 2 * Math.PI);
```

**Voller Context:**
```typescript
const coloredPointsPlugin: uPlot.Plugin = {
  hooks: {
    drawSeries: [(u, seriesIdx) => {
      // ...
      for (let i = 0; i < xData.length; i++) {
        const cx = u.valToPos(xData[i], 'x', true);
        const cy = u.valToPos(yData[i], 'y', true);
        const color = getColorForValue(yData[i]);

        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(cx, cy, 3, 0, 2 * Math.PI); // ← HIER
        ctx.fill();
      }
    }],
  },
};
```

### 8. Socket.io Event Handler hinzufügen

```typescript
// src/hooks/useSocket.ts

socket.on('my-event', (data) => {
  console.log('Received data:', data);
  // Handle event
});
```

---

## Testing

### Testing Stack (TODO)

Das Projekt hat **noch keine Tests** implementiert. Hier ist die empfohlene Stack:

**Empfohlene Libraries:**
- **Vitest** - Unit/Integration Tests (Vite-native)
- **React Testing Library** - Component Tests
- **@testing-library/user-event** - User Interactions
- **MSW (Mock Service Worker)** - API Mocking

**Installation:**

```bash
npm install -D vitest @testing-library/react @testing-library/user-event @testing-library/jest-dom msw
```

**Beispiel Test:**

```typescript
// src/components/bg-display/BgDisplay.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BgDisplay } from './BgDisplay';

describe('BgDisplay', () => {
  it('renders BG value', () => {
    render(<BgDisplay value={120} timestamp={new Date()} />);
    expect(screen.getByText('120')).toBeInTheDocument();
  });

  it('shows green color for in-range value', () => {
    render(<BgDisplay value={120} timestamp={new Date()} />);
    const element = screen.getByText('120');
    expect(element).toHaveClass('text-bg-in-range');
  });
});
```

---

## Troubleshooting

### "No data available"

**Mögliche Ursachen:**
1. Backend läuft nicht
2. Keine Daten in MongoDB
3. Falsche `VITE_API_URL` in `.env.development`

**Debug-Schritte:**
1. Browser DevTools öffnen (F12) → Console Tab
2. Nach Fehlermeldungen suchen
3. Network Tab → `/api/v1/entries.json` Request prüfen
4. Backend-URL testen: `curl http://localhost:1337/api/v1/entries.json`

### Socket.io verbindet nicht

**Ursachen:**
- Backend nicht erreichbar
- Falsche `VITE_API_URL`
- CORS-Probleme

**Lösung:**
- Vite Proxy prüfen in `vite.config.ts`
- Backend-Socket.io-Server prüfen
- Browser Console auf Errors prüfen

### Build schlägt fehl

**TypeScript Errors:**
```bash
npm run build
```

- Alle Type Errors beheben
- `any` Types vermeiden
- Fehlende Type Definitions installieren

**Beispiel:**
```typescript
// Error: Parameter 'event' implicitly has an 'any' type
const handleClick = (event) => { }  // ❌

// Fix:
const handleClick = (event: React.MouseEvent) => { }  // ✅
```

### Hot Reload funktioniert nicht

**Lösung:**
1. Vite Dev Server neu starten
2. Browser Cache leeren
3. `.env.development` Änderungen erfordern Neustart

### Tailwind Classes werden nicht angewendet

**Ursachen:**
- Tailwind nicht korrekt importiert
- PurgeCSS entfernt Classes
- CSS Variable nicht definiert

**Fix:**
1. `index.css` prüfen: `@tailwind base; @tailwind components; @tailwind utilities;`
2. `tailwind.config.js` Content-Pfade prüfen
3. Dev Server neu starten

### Performance-Probleme im Chart

**Symptome:**
- Langsames Rendering
- Verzögertes Pan/Zoom
- Browser freezt bei vielen Daten

**Ursachen & Lösungen:**

1. **Zu viele Datenpunkte im Viewport:**
   ```typescript
   // Problem: Alle Einträge werden geladen
   const entries = useBgStore(state => state.entries);

   // Lösung: Nur sichtbare verwenden (bereits implementiert)
   const visibleEntries = useVisibleEntries();
   ```

2. **Chart wird zu oft neu erstellt:**
   - Chart sollte NUR bei Setting-Änderungen neu erstellt werden
   - Daten-Updates über `setData()` (bereits implementiert)
   - Prüfe dass Dependencies im `useEffect` korrekt sind

3. **Kein Canvas Clipping:**
   - Canvas Clipping ist bereits implementiert (Stand: 2025-11-20)
   - Falls entfernt: Siehe `bgZonesPlugin` und `coloredPointsPlugin`
   ```typescript
   ctx.beginPath();
   ctx.rect(left, top, width, height);
   ctx.clip(); // Wichtig!
   ```

4. **Browser DevTools sind offen:**
   - Performance Profiler kann Chart verlangsamen
   - DevTools schließen für echte Performance-Tests

**Debug:**
```typescript
// Performance messen
console.time('chart-render');
uplotRef.current.setData(chartData);
console.timeEnd('chart-render');
// Sollte < 16ms sein für 60 FPS
```

---

## Best Practices

### Do's ✅

1. **TypeScript nutzen:**
   - Alle Types explizit definieren
   - Interfaces für Props verwenden
   - `any` vermeiden

2. **Komponenten klein halten:**
   - Single Responsibility Principle
   - Bei >200 Zeilen aufteilen
   - Sub-Komponenten extrahieren

3. **Custom Hooks verwenden:**
   - Wiederverwendbare Logik in Hooks
   - Prefix `use` verwenden

4. **Zustand für State:**
   - Zentraler State in Stores
   - Lokaler State in Komponenten
   - Selektive Subscriptions

5. **Tailwind für Styling:**
   - Utility Classes nutzen
   - Custom Theme verwenden
   - Responsive Design

6. **Performance beachten:**
   - React.memo für teure Komponenten
   - useMemo/useCallback wo sinnvoll
   - Data Downsampling für Charts

7. **Accessibility:**
   - Semantisches HTML
   - ARIA Labels wo nötig
   - Keyboard Navigation

### Don'ts ❌

1. **Keine `/lib/` Änderungen:**
   - Legacy Code nicht anfassen
   - Alles in React neu implementieren

2. **Keine Global State Pollution:**
   - Nicht alles in Stores packen
   - Lokaler State für UI-State

3. **Keine Inline Styles:**
   - Tailwind verwenden
   - CSS Variables nutzen

4. **Keine ungetypten Komponenten:**
   - Immer Props Interface
   - Return Types definieren

5. **Keine direkten DOM Manipulations:**
   - React State verwenden
   - Refs nur wenn nötig

6. **Keine riesigen Komponenten:**
   - Aufteilen bei >200 Zeilen
   - Extract Sub-Components

---

## Wichtige Dateien Referenz

### Konfiguration

| Datei | Zweck |
|-------|-------|
| `vite.config.ts` | Vite Build & Dev Server Config |
| `tsconfig.json` | TypeScript Base Config |
| `tailwind.config.js` | Tailwind Theme Config |
| `.env.development` | Development Environment Variables |
| `eslint.config.js` | ESLint Linting Rules |

### Entry Points

| Datei | Zweck |
|-------|-------|
| `index.html` | HTML Entry Point |
| `src/main.tsx` | React Entry Point |
| `src/App.tsx` | Root Component |
| `src/index.css` | Global Styles & Tailwind |

### Core Files

| Datei | Zweck |
|-------|-------|
| `src/stores/bgStore.ts` | BG Data State Management |
| `src/stores/settingsStore.ts` | Settings State Management |
| `src/lib/api.ts` | REST API Client |
| `src/lib/socket.ts` | Socket.io Setup |
| `src/types/index.ts` | TypeScript Type Definitions |

---

## Nützliche Links

**Dokumentation:**
- [React 19 Docs](https://react.dev/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Vite Guide](https://vitejs.dev/guide/)
- [Tailwind CSS Docs](https://tailwindcss.com/docs)
- [Zustand Docs](https://zustand-demo.pmnd.rs/)
- [Recharts Docs](https://recharts.org/)

**Nightscout:**
- [Nightscout Main Repo](https://github.com/nightscout/cgm-remote-monitor)
- [Nightscout Docs](https://nightscout.github.io/)

---

## Changelog

| Datum | Version | Änderungen |
|-------|---------|------------|
| 2025-11-20 | 1.0.0 | Initial CLAUDE.md für React Frontend erstellt |

---

**Dieses Dokument ist für AI-Assistenten gedacht. Für End-User Dokumentation siehe README.md.**
