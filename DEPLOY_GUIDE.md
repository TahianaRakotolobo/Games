# Complete Deployment Guide
# Word Search Battle — MongoDB Atlas + Render

---

## Overview

This guide walks you through:
1. Setting up a free MongoDB Atlas database in the cloud
2. Seeding it with your word pool
3. Deploying the app on Render (free tier)
4. Managing your word pool after launch

Everything is free. No credit card required for either service.

---

## PART 1 — MongoDB Atlas Setup

### Step 1 — Create a free Atlas account

1. Go to https://www.mongodb.com/cloud/atlas/register
2. Sign up with email or Google.
3. After login, Atlas shows the "Deploy a cluster" screen.

### Step 2 — Create a free cluster

1. Choose **M0 Free** (the default free tier).
2. Pick any cloud provider and region close to you.
3. Give the cluster any name you like (e.g. `WordSearchCluster`).
4. Click **Create Deployment**.
5. Wait 1–3 minutes for the cluster to provision.

### Step 3 — Create a database user

Atlas will prompt you for credentials right after the cluster is created.

1. Username: choose something memorable (e.g. `wsadmin`).
2. Password: click **Autogenerate** and copy it somewhere safe.
3. Click **Create Database User**.

> ⚠️ Save this password — you will need it in Step 5.

### Step 4 — Allow network access

1. In the left sidebar click **Network Access**.
2. Click **Add IP Address**.
3. Click **Allow Access From Anywhere** (adds `0.0.0.0/0`).
4. Click **Confirm**.

> This lets Render reach your database. You can tighten this later if needed.

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
You need to add words before the first game (otherwise a built-in fallback list is used).

### Option A — Using MongoDB Atlas UI (easiest, no code)

1. In Atlas, click **Browse Collections** on your cluster.
2. Click **Create Database**:
   - Database name: `wordsearchbattle`
   - Collection name: `words`
3. Click **Insert Document** and add words one by one, or use **Insert Many**.

Each document must have this shape:

```json
{
  "word": "ELEPHANT",
  "category": "animals",
  "active": true
}
```

Fields explained:
- `word` — the word in UPPERCASE (required). Must be 3–14 characters to fit the 15×15 grid.
- `category` — optional label to group words (e.g. "animals", "science", "sports"). Default: `"general"`.
- `active` — set to `false` to hide a word without deleting it. Default: `true`.

To insert many at once, click **Insert Document → switch to JSON view** and paste an array:

```json
[
  { "word": "ELEPHANT",   "category": "animals",  "active": true },
  { "word": "GIRAFFE",    "category": "animals",  "active": true },
  { "word": "VOLCANO",    "category": "science",  "active": true },
  { "word": "HURRICANE",  "category": "science",  "active": true },
  { "word": "PYTHON",     "category": "tech",     "active": true },
  { "word": "ALGORITHM",  "category": "tech",     "active": true },
  { "word": "MARATHON",   "category": "sports",   "active": true },
  { "word": "CHAMPION",   "category": "sports",   "active": true },
  { "word": "CARNIVAL",   "category": "general",  "active": true },
  { "word": "TREASURE",   "category": "general",  "active": true },
  { "word": "LIGHTHOUSE", "category": "general",  "active": true },
  { "word": "COMPASS",    "category": "general",  "active": true },
  { "word": "JUNGLE",     "category": "nature",   "active": true },
  { "word": "AVALANCHE",  "category": "nature",   "active": true },
  { "word": "CRYSTAL",    "category": "general",  "active": true },
  { "word": "FORTRESS",   "category": "general",  "active": true },
  { "word": "PYRAMID",    "category": "history",  "active": true },
  { "word": "GLADIATOR",  "category": "history",  "active": true },
  { "word": "GALAXY",     "category": "space",    "active": true },
  { "word": "NEBULA",     "category": "space",    "active": true }
]
```

Click **Insert**. Done!

### Option B — Using mongosh (command line)

If you prefer a terminal, install mongosh: https://www.mongodb.com/try/download/shell

```bash
mongosh "YOUR_MONGODB_URI"

use wordsearchbattle

db.words.insertMany([
  { word: "ELEPHANT",  category: "animals", active: true },
  { word: "VOLCANO",   category: "science", active: true },
  // ... add as many as you want
])
```

### Word length guide

| Grid size | Max word length |
|-----------|----------------|
| 15 × 15   | 14 letters      |

Words longer than 14 characters are silently skipped. Aim for words between 4 and 12 letters for the best gameplay experience.

---

## PART 3 — Deploy on Render

### Step 1 — Push your code to GitHub

If you have not already:

```bash
cd wordsearch
git init
git add .
git commit -m "Initial commit"
```

Create a new repository on https://github.com/new (keep it public or private — both work).

```bash
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
git branch -M main
git push -u origin main
```

### Step 2 — Create a Render account

1. Go to https://render.com and sign up (GitHub login is easiest).

### Step 3 — Create a new Web Service

1. In the Render dashboard click **New → Web Service**.
2. Click **Connect a repository** and select your GitHub repo.
3. If your repo is not listed, click **Configure GitHub access** and grant permission.

### Step 4 — Configure the service

Fill in the fields:

| Field | Value |
|-------|-------|
| Name | `word-search-battle` (or anything) |
| Region | Closest to you |
| Branch | `main` |
| Runtime | `Node` |
| Build Command | `npm install` |
| Start Command | `node server.js` |
| Instance Type | **Free** |

### Step 5 — Add the environment variable

1. Scroll down to **Environment Variables**.
2. Click **Add Environment Variable**.
3. Key: `MONGODB_URI`
4. Value: paste your full connection string from Part 1 Step 5.
5. Click **Save**.

### Step 6 — Deploy

Click **Create Web Service**. Render will:
1. Pull your code from GitHub.
2. Run `npm install`.
3. Start the server.

The first deploy takes about 2–3 minutes. Watch the log for:

```
MongoDB Connected: wordSearchCluster.xxxxx.mongodb.net
Server running on http://localhost:10000
```

Your app is live at `https://word-search-battle.onrender.com` (or similar).

---

## PART 4 — After Deployment

### Automatic deploys

Every time you push to the `main` branch, Render automatically redeploys. No action needed.

### Adding or editing words after launch

Just edit the `words` collection in the Atlas UI at any time:
- **Add words**: Insert new documents.
- **Disable a word**: Set `active: false` — it won't appear in new games.
- **Delete a word**: Delete the document. Old games that used it are unaffected.

Changes take effect immediately for the next game created — no restart needed.

### Viewing game records

All played games are stored in the `games` collection in Atlas. You can browse them in the Atlas UI under Browse Collections → wordsearchbattle → games.

### Waking up the free Render instance

Render's free tier spins down the server after 15 minutes of inactivity. The first request after that takes ~30 seconds to respond while it boots back up. This is normal for free tier. Upgrade to a paid plan if you need always-on availability.

---

## Troubleshooting

**"Application failed to start"** — Check the Render logs. The most common cause is a wrong `MONGODB_URI`. Make sure the password has no special characters that need URL-encoding, or wrap problematic characters.

**"Word collection is empty — using built-in fallback words"** — You have not added words to Atlas yet. Follow Part 2.

**"MongoServerError: bad auth"** — Your Atlas password is wrong in the URI. Re-copy it from Step 3 of Part 1.

**Game code not working for other players** — Make sure you are both using the deployed URL, not localhost.

---

*Happy battling! 🎯*
