# 🎨 KonvaCraft Studio

A full-stack design editor built with **React**, **Konva.js**, **Node.js/Express**, **PostgreSQL**, **Cloudinary**, and **Firebase Auth**.

---

## 📸 Live Demo

| | |
|---|---|
| **Login / landing** — Google or email sign-in, with the marketing pitch alongside | ![Login](docs/screenshots/login.png) |
| **Dashboard** — all of a user's designs in one grid, with thumbnails, search, and a New Design button | ![Dashboard](docs/screenshots/dashboard.png) |
| **New design picker** — start from a blank canvas or a Social Post / Presentation / Banner / Poster / Thumbnail / Images-to-Video preset | ![Design types](docs/screenshots/designtypes.png) |
| **Shapes panel** — rectangles, circles, ellipses, triangles, polygons, stars, arrows, and lines, placed straight onto the canvas | ![Shapes panel](docs/screenshots/shapespanel.png) |
| **Text styles** — one-click preset styles (Heading, Elegant, Modern, Script, Display, Typewriter...) built on Google Fonts | ![Font styles](docs/screenshots/fontstyles.png) |
| **Image settings** — position, size, rotation, opacity, border radius, brightness, contrast, and blur, all live on the selected image | ![Image settings](docs/screenshots/imagesettings.png) |
| **Video library** — upload and drop clips onto the canvas (up to 10 minutes / 500MB) alongside the rest of the design | ![Video panel](docs/screenshots/videopanel.png) |
| **Images to Video editor** — turn a set of images into a narrated slideshow with per-clip audio tracks, trim, duration, and transitions (Ken Burns, zoom, slide, fade) | ![Images to Video](docs/screenshots/imagestovideo.png) |
| **Audio library** — upload and preview background tracks or voiceovers (MP3/WAV/OGG/M4A) to layer into a design | ![Audio panel](docs/screenshots/audiopanel.png) |
| **Export formats** — PNG (transparent), JPG, PDF, or an image-slideshow video (.webm), at 1x/2x/3x scale | ![Export formats](docs/screenshots/exportformats.png) |
| **Export Code** — turn the canvas into real React, Next.js, Vue 3, or HTML source, with inline-style or CSS-class output | ![Code export](docs/screenshots/codeexport.png) |

---

## Tech Stack

| Layer      | Technology                        |
|------------|-----------------------------------|
| Frontend   | React 18, Vite, TailwindCSS       |
| Canvas     | Konva.js + react-konva            |
| State      | Zustand                           |
| Auth       | Firebase Authentication           |
| Backend    | Node.js + Express                 |
| Database   | PostgreSQL                        |
| File Store | Cloudinary (images + thumbnails)  |

---

## Project Structure

```
design-editor/
├── client/                  # React + Vite frontend
│   ├── src/
│   │   ├── auth/            # Firebase auth context
│   │   ├── components/
│   │   │   ├── canvas/      # Konva Stage + shape renderers
│   │   │   ├── panels/      # Properties, Layers, Assets panels
│   │   │   └── toolbar/     # Toolbar with tools + export
│   │   ├── lib/             # Firebase + Axios config
│   │   ├── pages/           # Login, Dashboard, Editor
│   │   └── store/           # Zustand stores (auth, editor)
│   └── .env.example
└── server/                  # Node.js + Express API
    ├── src/
    │   ├── db/              # PostgreSQL pool
    │   ├── middleware/      # Auth (Firebase Admin), Cloudinary
    │   └── routes/          # /api/designs, /api/assets
    ├── schema.sql           # Database schema (run once)
    └── .env.example
```

---

## Setup Guide

### Step 1 — Clone & Install

```bash
git clone <your-repo>
cd design-editor
npm install          # root concurrently
cd client && npm install
cd ../server && npm install
```

---

### Step 2 — Firebase Setup

1. Go to [https://console.firebase.google.com](https://console.firebase.google.com)
2. Create a new project (or use existing)
3. **Enable Authentication:**
   - Click **Authentication** → **Get Started**
   - Enable **Email/Password** provider
   - Enable **Google** provider
4. **Get client config:**
   - Project Settings → Your apps → Add web app
   - Copy the `firebaseConfig` values
5. **Get Admin SDK credentials:**
   - Project Settings → **Service Accounts**
   - Click **Generate new private key** → download JSON
   - Extract `project_id`, `client_email`, `private_key` from the JSON

---

### Step 3 — Cloudinary Setup

1. Sign up at [https://cloudinary.com](https://cloudinary.com) (free tier is generous)
2. Go to your **Dashboard**
3. Copy your **Cloud name**, **API Key**, and **API Secret**

---

### Step 4 — PostgreSQL Setup

**Option A — Local (Docker)**
```bash
docker run --name design-db -e POSTGRES_PASSWORD=password -e POSTGRES_DB=design_editor -p 5432:5432 -d postgres:16
```

**Option B — Hosted (recommended)**
- [Neon](https://neon.tech) — free serverless Postgres
- [Supabase](https://supabase.com) — free tier with extras

**Run the schema:**
```bash
psql "postgresql://user:password@localhost:5432/design_editor" -f server/schema.sql
```
Or paste the contents of `server/schema.sql` into the Neon/Supabase SQL editor.

---

### Step 5 — Configure Environment Variables

**Client** — copy and fill in:
```bash
cp client/.env.example client/.env
```

```env
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

**Server** — copy and fill in:
```bash
cp server/.env.example server/.env
```

```env
PORT=4000
DATABASE_URL=postgresql://user:password@localhost:5432/design_editor

CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxx@your-project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

> **Tip for FIREBASE_PRIVATE_KEY:** Open your downloaded JSON, copy the `private_key` value  
> (including the `-----BEGIN PRIVATE KEY-----` parts), and wrap it in double quotes.

---

### Step 6 — Run in Development

```bash
# From project root (runs both client + server)
npm run dev
```

- Client: [http://localhost:5173](http://localhost:5173)
- Server: [http://localhost:4000](http://localhost:4000)

---

## Features

| Feature               | Details                                      |
|-----------------------|----------------------------------------------|
| Auth                  | Email/Password + Google login via Firebase   |
| Canvas tools          | Rectangle, Circle, Text, Line, Image         |
| Drag & resize         | Konva Transformer handles resize + rotate    |
| Properties panel      | Fill, stroke, opacity, font, position, size  |
| Layers panel          | Reorder and delete shapes                    |
| Asset panel           | Upload images → Cloudinary, click to add     |
| Save / auto-save      | Saves canvas JSON to PostgreSQL every 30s    |
| Thumbnail             | Auto-generated on save, stored in Cloudinary |
| Export PNG            | `stage.toDataURL()` → download at 2x res     |
| Undo / Redo           | Full history stack (50 steps) in Zustand     |
| Keyboard shortcuts    | Ctrl+Z undo, Ctrl+Y redo, Delete to remove   |

---

## Deployment

### Client → Vercel
```bash
cd client && npm run build
# Then push to GitHub and import in Vercel
# Set VITE_* environment variables in Vercel dashboard
```

### Server → Railway / Render / Fly.io
```bash
# Push server/ to GitHub
# Set all server env vars in your hosting dashboard
# Set start command: node src/index.js
```

### Database → Neon (recommended)
- Create project at neon.tech
- Copy connection string to DATABASE_URL
- Run schema.sql once

---

## API Reference

| Method | Endpoint                  | Description               |
|--------|---------------------------|---------------------------|
| GET    | /api/designs              | List user's designs       |
| POST   | /api/designs              | Create new design         |
| GET    | /api/designs/:id          | Load design (canvas JSON) |
| PUT    | /api/designs/:id          | Save / auto-save design   |
| DELETE | /api/designs/:id          | Delete design             |
| GET    | /api/assets               | List user's assets        |
| POST   | /api/assets/upload        | Upload image to Cloudinary|
| POST   | /api/assets/upload-dataurl| Upload thumbnail           |
| DELETE | /api/assets/:id           | Delete asset              |

All endpoints require `Authorization: Bearer <firebase_id_token>` header.
