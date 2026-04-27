# Complete Deployment Guide
# Word Search Battle — MongoDB Atlas + Render

---

## Overview

This guide walks you through:
1. Setting up a free MongoDB Atlas database in the cloud
2. Seeding it with your word pool
3. Pushing the project to GitHub correctly
4. Deploying the app on Render (free tier)
5. Managing your word pool after launch

Everything is free. No credit card required for either service.

---

## PART 0 — Project structure check (read this first)

Before doing anything, confirm your local project looks exactly like this:

```
wordsearch/              ← your root folder (where server.js lives)
├── config/
│   └── db.js
├── models/
│   ├── Game.js
│   └── Word.js
├── routes/
│   ├── game.js
│   └── index.js
├── utils/
│   └── puzzle.js
├── views/
│   ├── 404.ejs
│   ├── game.ejs
│   ├── index.ejs
│   └── word-search-battle.ejs
├── public/              ← can be empty, that's fine
├── .gitignore
├── .env.example
├── package.json
├── render.yaml
└── server.js
```

If any subfolder is missing, that is why Render fails with "Cannot find module".

---

## PART 1 — MongoDB Atlas Setup

### Step 1 — Create a free Atlas account

1. Go to https://www.mongodb.com/cloud/atlas/register
2. Sign up with email or Google.
3. After login, Atlas shows the "Deploy a cluster" screen.

### Step 2 — Create a free cluster

1. Choose **M0 Free** (the default free tier).
2. Pick any cloud provider and region close to you.
3. Give the cluster any name (e.g. `WordSearchCluster`).
4. Click **Create Deployment**.
5. Wait 1–3 minutes for the cluster to provision.

### Step 3 — Create a database user

Atlas will prompt you right after the cluster is created.

1. Username: choose something memorable (e.g. `wsadmin`).
2. Password: click **Autogenerate** and copy it somewhere safe.
3. Click **Create Database User**.

> ⚠️ Save this password — you will need it in Step 5.

### Step 4 — Allow network access

1. In the left sidebar click **Network Access**.
2. Click **Add IP Address**.
3. Click **Allow Access From Anywhere** (adds `0.0.0.0/0`).
4. Click **Confirm**.

### Step 5 — Get your connection string

1. In the left sidebar click **Database** (under Deployment).
2. Click **Connect** on your cluster.
3. Choose **Drivers**.
4. Select Driver: **Node.js**, Version: **5.5 or later**.
5. Copy the connection string. It looks like:

```
mongodb+srv://wsadmin:<password>@wordSearchCluster.xxxxx.mongodb.net/?retryWrites=true&w=majority
```

6. Replace `<password>` with the password you saved in Step 3.
7. Add the database name before the `?`:

```
mongodb+srv://wsadmin:YOURPASSWORD@wordSearchCluster.xxxxx.mongodb.net/wordsearchbattle?retryWrites=true&w=majority
```

> Save this full string — this is your `MONGODB_URI`.

---

## PART 2 — Seeding the Word Pool

The game picks words randomly from the `words` collection in MongoDB.
Add words before the first game (a built-in fallback runs if the DB is empty).

### Using the Atlas UI (easiest)

1. In Atlas, click **Browse Collections** on your cluster.
2. Click **+ Create Database**:
   - Database name: `wordsearchbattle`
   - Collection name: `words`
3. Click **Insert Document**, switch to the array/JSON view, and paste:

```json
[
  { "word": "ELEPHANT",   "category": "animals",  "active": true },
  { "word": "GIRAFFE",    "category": "animals",  "active": true },
  { "word": "DOLPHIN",    "category": "animals",  "active": true },
  { "word": "VOLCANO",    "category": "science",  "active": true },
  { "word": "HURRICANE",  "category": "science",  "active": true },
  { "word": "GRAVITY",    "category": "science",  "active": true },
  { "word": "PYTHON",     "category": "tech",     "active": true },
  { "word": "ALGORITHM",  "category": "tech",     "active": true },
  { "word": "DATABASE",   "category": "tech",     "active": true },
  { "word": "MARATHON",   "category": "sports",   "active": true },
  { "word": "CHAMPION",   "category": "sports",   "active": true },
  { "word": "CARNIVAL",   "category": "general",  "active": true },
  { "word": "TREASURE",   "category": "general",  "active": true },
  { "word": "COMPASS",    "category": "general",  "active": true },
  { "word": "JUNGLE",     "category": "nature",   "active": true },
  { "word": "CRYSTAL",    "category": "general",  "active": true },
  { "word": "FORTRESS",   "category": "general",  "active": true },
  { "word": "PYRAMID",    "category": "history",  "active": true },
  { "word": "GALAXY",     "category": "space",    "active": true },
  { "word": "NEBULA",     "category": "space",    "active": true },
  { "word": "ASTEROID",   "category": "space",    "active": true },
  { "word": "THUNDER",    "category": "nature",   "active": true },
  { "word": "BLIZZARD",   "category": "nature",   "active": true },
  { "word": "LABYRINTH",  "category": "general",  "active": true },
  { "word": "SCAFFOLD",   "category": "general",  "active": true }
]
```

Click **Insert**. Done!

**Word rules:**
- `word` must be UPPERCASE, 3–14 characters (the grid is 15×15).
- `active: false` hides a word without deleting it.
- `category` is optional — just for your own organization.

---

## PART 3 — Push to GitHub correctly

> This is where most deployment failures happen. Follow these steps exactly.

### Step 1 — Open a terminal inside the project folder

```bash
cd path/to/wordsearch    # ← the folder that contains server.js directly
```

Confirm you are in the right place:

```bash
ls
# You should see: server.js  package.json  config/  models/  routes/  utils/  views/
```

If you do NOT see `server.js` here, you are in the wrong folder. `cd` into the correct one.

### Step 2 — Initialize git and add ALL files

```bash
git init
git add .
git status
```

After `git status`, you must see entries like:

```
new file:   config/db.js
new file:   models/Game.js
new file:   models/Word.js
new file:   routes/game.js
new file:   routes/index.js
new file:   utils/puzzle.js
new file:   views/game.ejs
new file:   views/index.ejs
new file:   server.js
new file:   package.json
...
```

If `config/db.js`, `models/`, `utils/`, or `views/` are **missing** from this list — stop. Your project files are not in the right folder. Do not proceed until they appear.

### Step 3 — Commit

```bash
git commit -m "Initial commit"
```

### Step 4 — Create a GitHub repository

1. Go to https://github.com/new
2. Name it `word-search-battle` (or anything).
3. Leave it **empty** — do NOT add a README or .gitignore via GitHub.
4. Click **Create repository**.
5. GitHub shows you the push commands. Run them:

```bash
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
git branch -M main
git push -u origin main
```

### Step 5 — Verify on GitHub

Open your repo on GitHub and confirm you can see folders like `config/`, `models/`, `utils/`, and `views/` in the file browser. If you only see `server.js` and `package.json`, the subfolders did not get pushed — go back to Step 1.

---

## PART 4 — Deploy on Render

### Step 1 — Create a Render account

Go to https://render.com and sign up (GitHub login is easiest).

### Step 2 — Create a new Web Service

1. In the Render dashboard click **New → Web Service**.
2. Click **Connect a repository** and select your GitHub repo.
3. If your repo is not listed, click **Configure GitHub access** and grant permission.

### Step 3 — Configure the service

| Field | Value |
|-------|-------|
| Name | `word-search-battle` (or anything) |
| Region | Closest to you |
| Branch | `main` |
| Runtime | `Node` |
| Build Command | `npm install` |
| Start Command | `node server.js` |
| Instance Type | **Free** |

### Step 4 — Add the environment variable

1. Scroll down to **Environment Variables**.
2. Click **Add Environment Variable**.
3. Key: `MONGODB_URI`
4. Value: paste your full connection string from Part 1 Step 5.
5. Click **Save**.

### Step 5 — Deploy

Click **Create Web Service**. Render will pull your code, run `npm install`, and start the server.

Watch the log for:

```
MongoDB Connected: wordSearchCluster.xxxxx.mongodb.net
Server running on http://localhost:10000
```

Your app is live at `https://word-search-battle.onrender.com` (or similar URL shown in the dashboard).

---

## PART 5 — After Deployment

### Automatic redeploys

Every `git push` to `main` triggers an automatic redeploy on Render.

### Adding or editing words

Edit the `words` collection in Atlas any time. Changes take effect for the next game created — no restart needed.

- **Add words**: Insert new documents.
- **Disable a word temporarily**: Set `active: false`.
- **Remove permanently**: Delete the document.

### Viewing game records

All games are stored in the `games` collection. Browse them in Atlas under Browse Collections → wordsearchbattle → games.

### Free tier note

Render's free tier spins the server down after 15 minutes of inactivity. The next request after that takes ~30 seconds to boot back up. Upgrade to a paid plan for always-on availability.

---

## Troubleshooting

| Error | Cause | Fix |
|-------|-------|-----|
| `Cannot find module './config/db'` | Subfolders not pushed to GitHub | Re-read Part 3 and verify `git status` shows all files |
| `MongoServerError: bad auth` | Wrong password in URI | Re-copy connection string from Atlas |
| `[puzzle] Word collection is empty` | No words added yet | Follow Part 2 |
| App loads but game code doesn't work | Players using localhost vs deployed URL | Make sure everyone uses the same URL |
| First request is slow | Render free tier cold start | Normal — wait 30s, then it's fast |

---

*Happy battling! 🎯*
