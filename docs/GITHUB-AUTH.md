# GitHub Authentication & Push Guide

You asked how to push changes from this project to your GitHub repo:
**https://github.com/Vtheonly/el-imtiyaz-school-system**

This guide covers the three standard ways to authenticate with GitHub from your local machine. Pick ONE that fits your workflow.

---

## Option 1: Personal Access Token (PAT) — Easiest

Use this if you want to push over HTTPS without setting up SSH keys.

### Step 1: Create a PAT on GitHub

1. Go to **GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)**
   (Direct link: https://github.com/settings/tokens)
2. Click **Generate new token (classic)**
3. Set a note like `el-imtiyaz-local-dev`
4. Set expiration (90 days is fine)
5. Tick the **`repo`** scope (this grants full repo read/write)
6. Click **Generate token**
7. **Copy the token immediately** — you won't see it again

### Step 2: Tell Git to use the token

You have two sub-options:

**Option A — Cache it in memory (recommended):**
```bash
git config --global credential.helper cache
git config --global credential.cacheexpiry 3600   # 1 hour
```
Next time you `git push`, Git will ask for username + password. Use:
- Username: `Vtheonly`
- Password: paste your PAT (not your GitHub password)

**Option B — Store the token in the repo URL:**
```bash
git remote set-url origin https://Vtheonly:<YOUR_PAT>@github.com/Vtheonly/el-imtiyaz-school-system.git
```
⚠️ This stores the token in plaintext in `.git/config`. Don't do this if the repo will be shared.

---

## Option 2: SSH Key — Most secure, best long-term

### Step 1: Generate an SSH keypair

```bash
ssh-keygen -t ed25519 -C "your_email@example.com"
# Press Enter to accept default path (~/.ssh/id_ed25519)
# Set a passphrase (optional but recommended)
```

### Step 2: Add the key to ssh-agent

```bash
eval "$(ssh-agent -s)"
ssh-add ~/.ssh/id_ed25519
```

### Step 3: Add the public key to GitHub

```bash
cat ~/.ssh/id_ed25519.pub
```
Copy the entire output (starts with `ssh-ed25519 AAAA…`).

Go to **GitHub → Settings → SSH and GPG keys → New SSH key**
- Title: `el-imtiyaz-local-dev`
- Key type: Authentication Key
- Key: paste the contents
- Click **Add SSH key**

### Step 4: Switch the repo to SSH

```bash
cd el-imtiyaz
git remote set-url origin git@github.com:Vtheonly/el-imtiyaz-school-system.git
git remote -v    # verify
```

### Step 5: Test the connection

```bash
ssh -T git@github.com
# Expected: "Hi Vtheonly! You've successfully authenticated..."
```

---

## Option 3: GitHub CLI (`gh`) — Modern, easiest for new repos

### Step 1: Install GitHub CLI

- macOS: `brew install gh`
- Ubuntu/Debian: `sudo apt install gh`
- Windows: download from https://cli.github.com/

### Step 2: Authenticate

```bash
gh auth login
```
Follow the interactive prompts:
- What account? **GitHub.com**
- Protocol? **HTTPS** (or SSH if you prefer)
- Authenticate Git with your GitHub credentials? **Yes**
- How to authenticate? **Login with a web browser**
- The CLI shows a one-time code — open the URL it gives you and paste the code

### Step 3: Verify

```bash
gh auth status
# Expected: ✓ Logged in to github.com as Vtheonly
```

---

## Pushing the El-Imtiyaz project to your repo

After authenticating with any of the three methods above:

### If the GitHub repo is empty (recommended)

```bash
cd /path/to/el-imtiyaz

# Initialise git (if not already)
git init
git branch -M main

# Add the remote
git remote add origin https://github.com/Vtheonly/el-imtiyaz-school-system.git
# Or SSH:
# git remote add origin git@github.com:Vtheonly/el-imtiyaz-school-system.git

# Stage everything
git add .

# First commit
git commit -m "Initial commit: El-Imtiyaz School System v1.0.0

- Complete Electron + React + TypeScript architecture
- SQLite offline-first persistence with migrations
- Student, Parent, Payment, Invoice, Receipt, Debt, Class,
  Employee, Attendance, Academic Year, Fee Template,
  Scholarship, Audit modules
- Drag-and-drop Workflow Builder with execution engine
- Notification Center with templates
- Dynamic particle logo system
- El-Imtiyaz Academic Brand Palette design system
- DataGrid, Command Palette, Global Search, Undo Manager,
  Activity Timeline, Smart Forms, State Visualization
- Persistent workspace state
- All amounts in Algerian Dinar (DZD)"

# Push
git push -u origin main
```

### If the GitHub repo already has commits

```bash
git pull origin main --allow-unrelated-histories
git push -u origin main
```

---

## .gitignore already configured

The included `.gitignore` excludes:
- `node_modules/`
- `dist/`, `dist-main/`, `dist-preload/`, `release/`
- `*.db`, `*.sqlite`, `data/`, `userdata/`
- `.env`, logs, IDE folders

So you can safely `git add .` without leaking secrets or committing build artifacts.

---

## Common issues

**"fatal: Authentication failed"**
- PAT: make sure you copied the entire token (no trailing whitespace) and selected `repo` scope
- SSH: make sure the public key is added to GitHub (not the private key)

**"Permission denied (publickey)"**
- `ssh-agent` not running — start it with `eval "$(ssh-agent -s)"`
- Key not added — `ssh-add ~/.ssh/id_ed25519`
- Wrong email in key comment — regenerate with correct email

**"Remote already exists"**
- `git remote remove origin` then re-add

**HTTPS prompts every time**
- `git config --global credential.helper store` (stores in plaintext at `~/.git-credentials`)
- Or switch to SSH (Option 2)

---

## Recommended workflow

1. Use **SSH (Option 2)** for personal dev — it's a one-time setup and never prompts again
2. Clone via SSH: `git clone git@github.com:Vtheonly/el-imtiyaz-school-system.git`
3. Make changes locally, commit, `git push`
4. The `.gitignore` keeps the repo clean

After the first push, day-to-day workflow is just:
```bash
git add .
git commit -m "describe change"
git push
```
