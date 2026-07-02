<div align="center">

<img src="./public/favicon-dark.png" alt="ForkSpace Logo" width="96" height="96" />

# ForkSpace

### One shared room for DSA practice, mock interviews, and mentoring.

[![MIT License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-18%2B-43853d?logo=node.js&logoColor=white)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-18-61dafb?logo=react&logoColor=white)](https://react.dev/)
[![Socket.IO](https://img.shields.io/badge/Socket.IO-4.x-white?logo=socket.io&logoColor=black)](https://socket.io/)

**[Quick Start](#quick-start)** | **[Latest Updates](#latest-updates)** | **[Features](#features)** | **[Architecture](#architecture)** | **[License](#license)**

</div>

---

## What is ForkSpace?

ForkSpace is a realtime collaborative workspace for interview-style problem solving.

It is built for:

- peer DSA practice
- mock interviews
- mentor-led sessions

Instead of splitting the session across a call, a notes doc, a compiler, and a separate review tool, ForkSpace keeps the shared brief, code editor, runs, hidden tests, AI review, and session reporting in one room.

It is intentionally narrow: one problem, one shared solution, one focused workflow.

---

## Latest Updates

Recent product and workflow improvements reflected in this repo:

- Refined the landing, workspace, analysis, and report surfaces so the main workflow reads more clearly
- Expanded Codeforces support with browsable catalog filters plus room-side URL import helpers
- Improved hidden test generation so room test sets refresh cleanly and useful failures can be promoted into sample tests
- Added stronger session intelligence and standalone solution analysis flows with shareable links
- Improved execution feedback, sample comparison, and room-side report visibility
- Added cleaner fallback handling when AI quota or provider availability is limited
- Kept guest-first entry intact while improving signed-in history and report persistence

---

## Features

### Realtime collaboration

- Shared room-based coding with Socket.IO
- Live participant list and presence
- Driver / Navigator role support
- Session modes: `Peer Practice`, `Mock Interview`, `Mentoring`
- Remote cursor positions, usernames, colors, and selection highlights
- Shared run results so both users can debug the same execution outcome
- Theme and avatar personalization without changing the core room workflow

### Interview workflow

- Shared problem brief, prompt, constraints, notes, and sample I/O
- Codeforces-first workflow with browsable catalog and room problem selection
- URL import helpers for supported problem pages, with manual editing kept available
- Manual statement/sample copy flow for reliable external problem setup
- Edge-case checklist for interview-style validation
- Recent run history stored in the room session
- Timer support for timed practice blocks

### Execution and testing

- Run C++, Python, and JavaScript solutions
- Judge0-backed code execution for normal runs/submissions
- Hidden test generation from the current problem statement
- Verified tests and stress tests shown separately
- Promote a hidden test into the visible sample suite when it is worth debugging in the room
- Output diffing for expected vs actual sample output
- Clear labels for pass, fail, timeout, crash, and stress-only results

### Analysis and reports

- AI hints in the editor
- AI solution review with complexity, bug-risk, style, and optimization feedback
- Standalone analysis page with shareable analysis links
- Session intelligence reports with strengths, gaps, next steps, and session score
- Shareable session cards and report pages for recap, screenshots, or follow-up
- Shareable report pages and a signed-in report history screen

### Auth and persistence

- Continue as guest for fast entry
- Sign up / sign in with JWT auth
- Avatar selection and profile persistence
- Saved room and run history for authenticated users
- Saved report history for authenticated users
- JSON-file persistence for room state and fallback intelligence logs
- MongoDB-backed persistence when configured

---

## Architecture

```text
Client (React + CodeMirror)
        |
        |  WebSocket (Socket.IO)
        v
Express + Socket Server
        |
        |-- Room/session persistence
        |   (JSON files + MongoDB when available)
        |
        |-- Auth/history
        |   (JWT + MongoDB)
        |
        |-- AI analysis/hints
        |   (Groq / Gemini / Mistral with fallbacks)
        |
        |-- Codeforces catalog
        |
        |-- Hidden tests
        |   (LLM-assisted planning + Piston execution)
        |
        `-- Judge0 API
            (standard code execution)
```

### Notes

- `server/server.js` is the main backend for auth, sockets, execution, analysis, reports, Codeforces import/catalog, and hidden tests
- Room state is persisted locally under `server/data/`
- Redis pub/sub is supported for horizontal Socket.IO scaling when `REDIS_URL` is set
- MongoDB is optional for local boot, but needed for full auth/history/report persistence

---

## Tech Stack

| Layer | Technology |
| --- | --- |
| Frontend | React 18, Vite, Tailwind CSS |
| Editor | CodeMirror |
| Realtime | Socket.IO |
| Backend | Node.js, Express |
| Auth | JWT, bcryptjs, MongoDB / Mongoose |
| AI | Groq, Gemini, Mistral |
| Execution | Judge0, Piston |
| Optional scaling | Redis adapter for Socket.IO |

---

## Quick Start

### Prerequisites

- Node.js 18+
- npm
- MongoDB if you want authentication, report history, and saved user data
- A Judge0 API key for standard code execution
- At least one AI provider key if you want AI hints/review/report assistance

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

Root `.env`

```env
VITE_SERVER_URL=http://localhost:5000
```

`server/.env`

```env
PORT=5000
CLIENT_URL=http://localhost:5173

APP_NAME=ForkSpace
APP_URL=http://localhost:5173

JUDGE0_API_URL=https://judge0-ce.p.rapidapi.com
JUDGE0_API_KEY=your_judge0_key_here

GROQ_API_KEY=your_groq_key_here
GEMINI_API_KEY=your_gemini_key_here
MISTRAL_API_KEY=your_mistral_key_here

JWT_SECRET=replace_this_with_a_real_secret
MONGODB_URI=mongodb://localhost:27017/forkspace

# Optional
REDIS_URL=redis://localhost:6379
```

### 3. Start the backend

```bash
npm run dev:server
```

### 4. Start the frontend

```bash
npm run dev:client
```

### 5. Open the app

```text
http://localhost:5173
```

### Optional production start

```bash
npm run build
npm run start
```

---

## How To Use It

1. Open the home page and continue as guest or sign in.
2. Create a room or join an existing room ID.
3. Pick a session mode: `Peer Practice`, `Mock Interview`, or `Mentoring`.
4. Add the problem manually, browse Codeforces, or use a supported problem URL import helper.
5. Choose the room language and solve together in the shared editor.
6. Use `Run` and `Submit` to compare output against visible sample tests.
7. Use `Generate Tests` to create verified and stress-style hidden tests, then promote useful failures into the sample suite when needed.
8. Use `Analyze` for solution review and `Report` for the room/session summary.
9. Copy a share link for analysis, report, or session card pages if you want to send the result elsewhere.

---

## Project Structure

```text
ForkSpace/
|-- src/
|   |-- components/
|   |   |-- Workspace/
|   |   |-- codeforces/
|   |   |-- common/
|   |   |-- sessionIntelligence/
|   |   `-- sidebar/
|   |-- lib/
|   |-- pages/
|   `-- socket.js
|-- server/
|   |-- data/
|   |-- hidden-tests/
|   |-- models/
|   |-- services/
|   |-- ai-server.js
|   `-- server.js
|-- public/
`-- README.md
```

---

## Known Boundaries

ForkSpace is intentionally not:

- a multi-file IDE
- a LeetCode-native platform clone
- a video-call platform
- a generic compiler playground

It is optimized for collaborative problem-solving sessions around one solution at a time.

---

## Roadmap Snapshot

- [x] Realtime shared rooms
- [x] Multi-language collaboration and execution
- [x] Live cursors and shared run awareness
- [x] Codeforces catalog workflow
- [x] Supported problem URL import helpers
- [x] Hidden tests and stress runs
- [x] AI hints and solution review
- [x] Standalone solution analysis pages
- [x] Session intelligence reports and share links
- [x] Shareable session cards
- [x] Signed-in report history
- [x] Room persistence across restart
- [ ] Deeper room history UX
- [ ] More structured mentoring/session note flows

---

## License

MIT - see [LICENSE](LICENSE).
