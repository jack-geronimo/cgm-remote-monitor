# Nightscout React Frontend

Modern React 19 frontend for Nightscout CGM Remote Monitor.

## ✨ Features

- ⚛️ **React 19** with TypeScript
- ⚡ **Vite** for lightning-fast development
- 🎨 **Tailwind CSS v3** for modern styling
- 📊 **Recharts** for beautiful glucose charts
- 🔄 **Socket.io** for real-time updates
- 🎭 **Framer Motion** for smooth animations
- 💾 **Zustand** for lightweight state management

## 🚀 Quick Start

### Installation

```bash
npm install
```

### 🌐 Option 1: Connect to an existing Nightscout instance (Easiest!)

**No need to run MongoDB or the backend locally!** Just connect to your existing Nightscout instance:

1. Edit `.env.development` and add your Nightscout URL:
   ```bash
   VITE_API_URL=https://your-nightscout.herokuapp.com
   ```

2. Start the dev server:
   ```bash
   npm run dev
   ```

3. Open http://localhost:5173 and see your data! 🎉

**That's it!** The Vite proxy automatically handles CORS and proxies all requests to your backend.

### 💻 Option 2: Run with local backend

1. Start MongoDB:
   ```bash
   brew services start mongodb-community
   ```

2. Configure and start the Nightscout backend (in parent directory):
   ```bash
   cd ..
   # Create my.env with your configuration
   npm run dev
   ```

3. Keep `.env.development` as default:
   ```bash
   VITE_API_URL=http://localhost:1337
   ```

4. Start the React dev server:
   ```bash
   cd nightscout-react
   npm run dev
   ```

## ⚙️ Configuration

Edit `.env.development`:

```bash
# Option 1: Your existing Nightscout instance
VITE_API_URL=https://your-nightscout.herokuapp.com

# Option 2: Local backend (default)
VITE_API_URL=http://localhost:1337

# Option 3: Public demo (if available)
VITE_API_URL=https://demo.nightscout.io
```

The Vite dev server automatically proxies:
- `/api/*` → `${VITE_API_URL}/api/*`
- `/socket.io/*` → `${VITE_API_URL}/socket.io/*` (WebSocket support)

## 📦 Available Scripts

```bash
npm run dev       # Start development server (http://localhost:5173)
npm run build     # Build for production
npm run preview   # Preview production build
npm run lint      # Run ESLint
```

## 🏗️ Project Structure

```
src/
├── components/       # React components
│   ├── bg-display/  # Blood glucose display
│   ├── chart/       # Glucose chart (Recharts)
│   └── pills/       # Status pills (IOB, COB, etc.)
├── hooks/           # Custom React hooks
│   ├── useBgData.ts
│   └── useSocket.ts
├── lib/             # Utilities
│   ├── api.ts       # API client
│   ├── socket.ts    # Socket.io client
│   └── utils.ts     # Helper functions
├── stores/          # Zustand stores
│   ├── bgStore.ts   # Blood glucose state
│   └── settingsStore.ts # User preferences
├── types/           # TypeScript definitions
└── App.tsx          # Main app component
```

## 🎨 UI Components

### BG Display
- Large, color-coded glucose value
- Trend arrow (⇈ ↑ ↗ → ↘ ↓ ⇊)
- Delta calculation
- Time ago timestamp
- Stale data warning

### Chart
- 12-hour glucose visualization
- Color-coded target zones
- Reference lines
- Custom tooltip
- Auto-scaling

### Pills
- IOB (Insulin on Board)
- COB (Carbs on Board)
- Pump battery
- Reservoir level
- Status indicators

## 🎭 Theme Support

- 🌙 Dark mode (default)
- ☀️ Light mode
- 🔄 Auto (system preference)

## 🔧 Troubleshooting

### "No data available"
- Backend not running or no data in database
- Check browser console for errors
- Verify `VITE_API_URL` is accessible

### "Socket.io connection error"
- Backend not reachable
- Check `VITE_API_URL` in `.env.development`
- Vite proxy handles CORS automatically

### Empty blue page
- Open DevTools (F12) → Console tab
- Check Network tab for `/api/v1/entries.json` calls
- Verify backend is running and accessible

## 📝 License

AGPL-3.0 - Same as Nightscout
