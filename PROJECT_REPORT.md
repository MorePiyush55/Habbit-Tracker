# 📋 Solo Leveling Habit Tracker — Full Project Report

> **Generated:** 2026-03-22 | **Version:** 0.1.0 | **Status:** Active Development

---

## 🎯 Project Overview

**Solo Leveling Habit Tracker** is a full-stack gamified productivity web application. Inspired by the *Solo Leveling* manhwa/anime universe, it transforms daily tasks and habits into an immersive RPG-style quest system. Users gain XP, level up, earn achievements, fight weekly boss raids, and receive AI-powered coaching — all while building real-world discipline.

---

## 🌐 Live Deployment

| Item | Details |
|---|---|
| **Live URL** | https://habbit-tracker-omega-inky.vercel.app |
| **Platform** | Vercel (auto-deploy from GitHub `main`) |
| **Repo** | GitHub: `Habbit-Tracker` → `solo-leveling-tracker` |

---

## 🛠️ Tech Stack

### Frontend
| Technology | Version | Purpose |
|---|---|---|
| **Next.js** | 16.1.6 | React framework with App Router, SSR/SSG |
| **React** | 19.2.3 | UI component library |
| **TypeScript** | ^5.x | Type-safe development |
| **Vanilla CSS** | — | Custom Solo Leveling dark-mode design system (no Tailwind) |
| **SWR** | ^2.4.1 | Data fetching, caching, optimistic updates |
| **Lucide React** | ^0.577.0 | Icon library |
| **Chart.js + react-chartjs-2** | ^4.5.1 / ^5.3.1 | Analytics charts |
| **@uiw/react-heat-map** | ^2.3.3 | GitHub-style habit heatmap visualization |
| **react-tooltip** | ^5.30.0 | Hover tooltips |

### Backend
| Technology | Version | Purpose |
|---|---|---|
| **Next.js API Routes** | 16.1.6 | REST API (serverless functions on Vercel) |
| **MongoDB** | Cloud Atlas | Primary database |
| **Mongoose** | ^9.2.4 | ODM for MongoDB schema/queries |
| **next-auth** | ^4.24.13 | OAuth authentication (Google) |
| **OpenAI SDK** | ^6.27.0 | AI coaching via OpenRouter (free models) |
| **rate-limiter-flexible** | ^9.1.1 | API rate limiting |
| **Zod** | ^4.3.6 | Request schema validation |

### Testing
| Technology | Purpose |
|---|---|
| **Jest + ts-jest** | Unit & integration testing |
| **mongodb-memory-server** | In-memory MongoDB for tests |
| **next-test-api-route-handler** | Test API routes in isolation |
| **supertest** | HTTP integration tests |

---

## 📁 Project Structure

```
solo-leveling-tracker/
├── src/
│   ├── app/                   # Next.js App Router pages + API
│   │   ├── api/               # 17 REST API endpoint groups
│   │   ├── profile/           # /profile page
│   │   ├── tasks/             # /tasks page
│   │   ├── layout.tsx         # Root layout (sessions, fonts)
│   │   ├── page.tsx           # Root page (auth redirect)
│   │   └── globals.css        # Global CSS design system (~36KB)
│   ├── components/            # Reusable UI components
│   │   ├── game/              # 9 core game UI components
│   │   ├── ai/                # AI chat / system UI
│   │   ├── analytics/         # Charts, analytics views
│   │   ├── system/            # System banners, notifications
│   │   ├── AppNav.tsx         # Top navigation bar
│   │   ├── Dashboard.tsx      # Main dashboard layout
│   │   └── LoginPage.tsx      # Google sign-in page
│   ├── lib/                   # Business logic + utilities
│   │   ├── core/              # 27 AI Brain engine modules
│   │   ├── game-engine/       # 6 RPG game mechanics modules
│   │   ├── ai/                # 5 AI client modules
│   │   ├── system/            # Rule engine
│   │   ├── mongodb.ts         # DB connection singleton
│   │   ├── auth.ts            # NextAuth helper
│   │   ├── rankConfig.ts      # Rank XP configuration
│   │   ├── validation.ts      # Shared Zod schemas
│   │   └── defaultTasks.ts    # Default seed tasks
│   ├── models/                # 21 Mongoose data models
│   ├── services/              # External service wrappers
│   ├── contexts/              # React context providers
│   └── types/                 # TypeScript type definitions
├── tests/                     # Integration/unit tests
├── public/                    # Static assets
├── package.json               # Dependencies
├── next.config.ts             # Next.js config
├── vercel.json                # Vercel deployment config
└── tsconfig.json              # TypeScript config
```

---

## 📄 Pages

### `/` — Root Page (`src/app/page.tsx`)
- Entry point of the application
- Redirects authenticated users to `/tasks` dashboard
- Shows login page for unauthenticated users

### `/tasks` — Daily Quest Board (`src/app/tasks/page.tsx`)
- Main daily task management page
- Displays all daily quests sorted by rank (highest XP first, completed last)
- Inline rank changing with optimistic UI updates
- Celebration animation fires when ALL quests are completed
- Full CRUD: create, edit, delete quests
- Background sync every 30 seconds

### `/profile` — Hunter Profile (`src/app/profile/page.tsx`)
- Premium **Solo Leveling** styled profile editor
- Edit life missions, learning progress, skill self-ratings
- Sticky save bar (always visible while scrolling)
- Holographic input fields with glowing focus effects
- All sections: Core Missions, Training Logs, Recurring Quotas, Skill Proficiency, Temporal Protocols, Vulnerabilities

---

## 🎮 Game Components (`src/components/game/`)

| Component | Size | Description |
|---|---|---|
| **QuestPanel.tsx** | 17.7KB | Renders all daily quests. Handles inline rank picking, subtask checkboxes, progress bars, delete/edit actions. Color-coded by rank. |
| **CreateQuestModal.tsx** | 17KB | Full-featured quest creation form. Schedule types (daily/today/custom), category picker, rank selector with custom XP from API. |
| **EditQuestModal.tsx** | 16.9KB | Quest editing form. Supports changing title, category, rank, schedule, subtasks. Reads rank configs from MongoDB. |
| **RankCustomizerModal.tsx** | 11.4KB | Configure custom name/label/XP for each rank tier. Saves to MongoDB (persistent across all devices). |
| **CelebrationOverlay.tsx** | 11KB | Full-screen celebration when all daily quests are completed. Canvas-based particle confetti, trophy animation, XP summary, fade-exit. |
| **PlayerStats.tsx** | 9.1KB | Sidebar player card: level, XP, streak, HP bar, gold, 6 core stats (STR/VIT/INT/AGI/PER/CHA), hunter rank badge. |
| **BossBattle.tsx** | 4.9KB | Weekly Boss Raid widget. Tracks boss HP (500), progress bar, displays defeat status, resets weekly. |
| **HabitHeatmap.tsx** | 3.1KB | GitHub-style contribution heatmap showing habit completion history. |
| **AchievementBadges.tsx** | 1.7KB | Displays unlocked achievement badges/icons. |

---

## 🗄️ Database Models (`src/models/`) — 21 Schemas

| Model | Purpose |
|---|---|
| **User** | Core user account: Google OAuth, XP, level, streak, stats (STR/VIT/INT/AGI/PER/CHA), HP, gold, jobClass, rankConfigs |
| **Habit** | A task/quest: title, category, rank, xpReward, subtasks, isDaily, deadline, primaryStat |
| **Subtask** | Subtask of a Habit: title, order, completed, xpEarned |
| **DailyProgress** | Records which habits were completed on a given date |
| **ProgressEntry** | Individual progress entry for a habit on a date |
| **HunterProfile** | Deep user context: missions, learning paths, skill ratings, time availability, weaknesses, 6-month vision |
| **Goal** | Long-term goals linked to habits |
| **SkillMastery** | Per-skill mastery tracking with levels and XP |
| **SkillNode** | Nodes in the user's skill graph |
| **SkillScore** | Score per skill category |
| **LearningPath** | Structured learning roadmap |
| **KnowledgeNode** | Knowledge graph nodes (topics learned) |
| **SystemMemory** | AI's long-term memory about the user |
| **SystemEvent** | Event log for AI system events (SESSION_START, etc.) |
| **SystemDecision** | Records decisions made by the AI brain |
| **SystemMessage** | Chat messages between user and AI system |
| **BehaviorLog** | Logs of detected behavioral patterns |
| **GeneratedQuest** | AI-generated quest suggestions |
| **Reward** | In-game purchasable rewards |
| **Item** | Inventory items (weapon, armor, accessory) |
| **WeeklyReport** | Weekly performance summary reports |

---

## 🔌 API Routes (`src/app/api/`) — 17 Endpoint Groups

| Endpoint | Methods | Description |
|---|---|---|
| `/api/auth/[...nextauth]` | GET, POST | Google OAuth via NextAuth |
| `/api/habits` | GET, POST | List all habits; Create new habit |
| `/api/habits/[id]` | GET, PUT, DELETE | Get/update/delete specific habit |
| `/api/progress` | GET, POST | Get daily completion status; Toggle subtask/task completion |
| `/api/analytics` | GET | User stats, XP totals, streaks, heatmap data |
| `/api/rank-config` | GET, PUT | Load/save custom rank configurations per user (MongoDB) |
| `/api/goals` | GET, POST | Manage long-term goals |
| `/api/hunter-profile` | GET, PUT | Load/save Hunter Profile (deep user context) |
| `/api/rewards` | GET, POST | Browse/purchase in-game rewards |
| `/api/skill-mastery` | GET, POST | Track and update skill mastery levels |
| `/api/learning-paths` | GET, POST | Learning roadmap management |
| `/api/knowledge` | GET, POST | Knowledge graph nodes |
| `/api/motivate` | POST | AI-generated motivational message |
| `/api/analyze` | POST | AI behavioral analysis |
| `/api/system/*` | Various | AI Brain events, chat, state, memory, metrics |
| `/api/user/stats` | POST | Upgrade character stats (spend stat points) |
| `/api/cron/system-check` | GET | Scheduled weekly resets, boss raid refresh |

---

## 🧠 AI Brain Engine (`src/lib/core/`) — 27 Modules

This is the intelligence layer of the application, a custom-built multi-module AI coaching system:

| Module | Description |
|---|---|
| **systemBrainV3.ts** (47KB) | Master orchestration controller — routes all events through the brain |
| **brainController.ts** (18KB) | High-level brain coordination and directive pipeline |
| **decisionEngine.ts** (17.6KB) | Makes strategic decisions based on user state |
| **systemScheduler.ts** (18.8KB) | Schedules automated checks, interventions, and weekly resets |
| **skillMasteryEngine.ts** (19.6KB) | Tracks skill development, levels, and mastery milestones |
| **knowledgeGraph.ts** (21KB) | Builds and queries the user's knowledge graph |
| **contextBuilder.ts** (11.5KB) | Builds rich context objects from user data for AI prompts |
| **behaviorAnalyzer.ts** (7.7KB) | Detects behavioral patterns (streaks, skips, consistency) |
| **interventionEngine.ts** (11.7KB) | Proactive interventions when user is struggling |
| **evolutionEngine.ts** (12.8KB) | Tracks user growth over time, evolves coaching style |
| **strategyGenerator.ts** (11KB) | Generates personalized strategies and action plans |
| **actionPlanner.ts** (14.7KB) | Creates daily action plans from goals and habits |
| **shadowCoach.ts** (8.4KB) | Background coaching layer — provides subtle nudges |
| **systemMemory.ts** (12.6KB) | Persistent memory store for AI context across sessions |
| **systemState.ts** (10.6KB) | Global system state management |
| **eventBus.ts** (11.5KB) | Internal event bus for cross-module communication |
| **personalityLayer.ts** (6.9KB) | Adjusts AI tone/style to match user personality |
| **cognitiveOptimizer.ts** (9.2KB) | Optimizes task scheduling for peak cognitive performance |
| **commandInterpreter.ts** (16KB) | Interprets user commands/intentions from chat input |
| **directiveGenerator.ts** (1.4KB) | Generates directives for daily action |
| **directiveFormatter.ts** (8.8KB) | Formats directives into readable output |
| **directiveExecutor.ts** (9.4KB) | Executes generated directives |
| **qualityControl.ts** (7.6KB) | Validates and scores AI outputs before display |
| **lifeSimulator.ts** (8.8KB) | Simulates life trajectory based on current habits |
| **observability.ts** (8.4KB) | Logging and monitoring of AI brain operations |
| **skillGraph.ts** (11.8KB) | Visual graph of skill relationships |
| **trainingEngine.ts** (8.9KB) | Manages structured training programs |

---

## ⚙️ Game Engine (`src/lib/game-engine/`) — 6 Modules

| Module | Description |
|---|---|
| **engine.ts** (5.2KB) | Core game loop: XP awards, job class evaluation, stat tracking |
| **levelSystem.ts** (1.6KB) | XP thresholds per level, level-up logic |
| **xpSystem.ts** (0.5KB) | XP calculation utilities |
| **streakSystem.ts** (1.7KB) | Daily streak calculation and maintenance |
| **achievementSystem.ts** (2.9KB) | Achievement unlock detection and management |
| **difficultyScaler.ts** (1.2KB) | Dynamically scales task difficulty based on user performance |

---

## 🤖 AI Client (`src/lib/ai/`) — 5 Modules

| Module | Description |
|---|---|
| **aiClient.ts** | OpenRouter API client initialization |
| **aiRouter.ts** | Routes requests to the best available free AI model |
| **systemBrain.ts** (17.7KB) | AI prompt construction and response parsing |
| **eventPrompts.ts** | Prompt templates for system events (SESSION_START, MILESTONE, etc.) |
| **trainingPrompts.ts** | Prompt templates for training/coaching interactions |

---

## 🎨 Design System

The entire UI is built with **custom Vanilla CSS** (no Tailwind). Located in `src/app/globals.css` (~36KB).

**Visual Theme: Solo Leveling Neo-Futurism**
- **Dark Mode Only** — deep navy/black backgrounds (`#0a0a14`, `#0f0f2d`)
- **Glassmorphism** — `backdrop-filter: blur()` frosted glass cards
- **Rank Color Palette:**
  - `S-Rank` → **Hot Pink** `#ff0080` 
  - `A-Rank` → **Orange** `#ff8c00`
  - `B-Rank` → **Purple** `#8b5cf6`
  - `C-Rank` → **Cyan** `#00b4ff`
  - `D-Rank` → **Green** `#00ff88`
  - `E-Rank` → **Grey** `#a0a0a0`
- **Typography** — Monospace fonts for game UI, system-style letterSpacing
- **Micro-animations** — hover effects, glow transitions, scan-line inputs
- **Holographic Inputs** — colored box-shadow glows on focus

---

## 🏆 Key Features

### ✅ Quest Management
- Create daily/one-time/custom deadline quests
- Subtask-based completion tracking
- Inline rank switching directly from quest list
- Priority sorting: highest XP rank first, completed quests sink to bottom
- Full CRUD with optimistic UI (instant response, background sync)

### ⚡ XP & Leveling System
- Each rank tier awards custom XP (E=10, D=20, C=35, B=55, A=80, S=120 by default)
- Fully customizable per user via **Rank Customizer** (saved to MongoDB)
- Completing all subtasks of a quest awards full XP
- Leveling formula: XP thresholds increase progressively per level

### 🗡️ RPG Character System
- **6 Stats:** STR, VIT, INT, AGI, PER, CHA — each linked to task categories
- **Level-up** awards stat points to spend
- **Job Class Evolution** — career title evolves based on stat distribution
- **Hunter Rank** — weekly evaluated rank (E-Class → S-Class)
- **HP System** — HP depletes on missed daily quests

### 🏰 Weekly Boss Raid
- Weekly boss with 500 HP
- HP damage dealt by completing subtasks
- Boss resets every Monday
- Visual progress bar and defeat state

### 🔥 Streaks
- Daily streak counter (consecutive days with all tasks complete)
- Longest streak record
- Streak resets if daily tasks missed

### 🎊 Celebration System
- Full-screen particle celebration fires when all daily quests are completed
- Canvas-based multi-burst confetti (300+ particles)
- Trophy animation, XP summary badge, auto-dismiss after 5 seconds

### 📊 Analytics & Heatmap
- XP earned per day
- Completion rate statistics
- GitHub-style heatmap visualization of habit history (12-week view)
- Discipline score, focus score, skill growth score

### 🧠 AI Coaching System
- **Event-driven** — fires on SESSION_START, TASK_COMPLETE, MILESTONE, etc.
- **Behavioral analysis** — detects patterns in task completion
- **Proactive interventions** — suggests changes when you're struggling
- **Personalized directives** — daily action plans based on your goals
- **Knowledge graph** — maps your learning progress as a graph
- **Life simulation** — projects trajectory if current habits continue

### 👤 Hunter Profile
- Deep profile: life missions, learning paths, skill self-ratings
- Weekly targets (job applications, outreach, study hours, etc.)
- Time availability and best focus time
- 6-month vision declaration
- All data feeds into AI coaching context

### 🎖️ Rank Customization
- Rename any rank (e.g., change "S-Rank" to "Legend")
- Set custom XP per rank (e.g., S=500 XP)
- Add new custom ranks beyond the default 6
- Delete middle ranks (system auto-manages)
- **All stored in MongoDB** — syncs across all devices

### 🔐 Authentication
- Google OAuth via NextAuth
- Session-based authentication
- Server-side session validation on all API routes

---

## 🔒 Security

- All API routes validate user session before any DB operations
- Rate limiting on sensitive endpoints via `rate-limiter-flexible`
- Zod schema validation on all POST/PUT request bodies
- MongoDB query safety with Mongoose ODM
- No user data ever exposed in client-side code

---

## 🧪 Testing

```
tests/
├── Unit Tests (game-engine/)     — XP calc, level system, streaks
├── Integration Tests (api/)      — API route tests with in-memory MongoDB
└── DB Utilities (test-utils/)    — MongoDB test helpers
```

Run tests with:
```bash
npm test
npm run test:watch
```

---

## 🚀 Running Locally

```bash
# 1. Install dependencies
npm install

# 2. Set up environment variables
# Create .env.local with:
# MONGODB_URI=your_mongodb_atlas_uri
# NEXTAUTH_SECRET=your_secret
# NEXTAUTH_URL=http://localhost:3000
# GOOGLE_CLIENT_ID=your_google_client_id
# GOOGLE_CLIENT_SECRET=your_google_client_secret
# OPENROUTER_API_KEY=your_openrouter_key

# 3. Run dev server
npm run dev

# 4. Open http://localhost:3000
```

---

## 📦 Dependencies Summary

### Production (11 packages)
| Package | Purpose |
|---|---|
| `next@16.1.6` | Core framework |
| `react@19.2.3` | UI |
| `mongoose@9.2.4` | MongoDB ODM |
| `next-auth@4.24.13` | Authentication |
| `openai@6.27.0` | AI API client |
| `swr@2.4.1` | Data fetching |
| `zod@4.3.6` | Validation |
| `lucide-react@0.577.0` | Icons |
| `chart.js@4.5.1` | Charts |
| `react-chartjs-2@5.3.1` | Chart.js React wrapper |
| `rate-limiter-flexible@9.1.1` | Rate limiting |
| `@uiw/react-heat-map@2.3.3` | Heatmap |
| `react-tooltip@5.30.0` | Tooltips |

### Dev (9 packages)
`jest`, `ts-jest`, `typescript`, `eslint`, `@types/*`, `mongodb-memory-server`, `supertest`, `next-test-api-route-handler`, `cross-env`

---

## 📌 Key Design Decisions

1. **No Tailwind CSS** — pure CSS custom properties for full control over the Solo Leveling aesthetic
2. **Rank configs in MongoDB** — not localStorage, so they sync across all browsers/devices
3. **Optimistic UI everywhere** — instant visual feedback, background API calls
4. **Canvas-based confetti** — no external library; built from scratch for particle physics
5. **App Router** — uses Next.js App Router (not Pages Router) for better performance
6. **SWR for data fetching** — auto-revalidation, cache sharing between components
7. **Modular AI brain** — 27 separate modules instead of one monolithic AI file

---

*Report generated by Antigravity AI • 2026-03-22*
