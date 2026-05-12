# ⚡ Jobs-A2Z — Autonomous Career-Ops Agent

> An enterprise-grade, agentic AI platform that automates the entire Indian tech job hunt — from live scraping to personalized outreach — powered by Google Gemini and Playwright.

[![Node.js](https://img.shields.io/badge/Node.js-18%2B-green?logo=node.js)](https://nodejs.org/)
[![Gemini CLI](https://img.shields.io/badge/Gemini-3.1%20Pro-blue?logo=google)](https://github.com/google-gemini/gemini-cli)
[![Playwright](https://img.shields.io/badge/Playwright-Chromium-orange?logo=playwright)](https://playwright.dev/)
[![License](https://img.shields.io/github/license/swapwarick/Jobs-A2Z)](LICENSE)

---

## 🌟 What is Jobs-A2Z?

**Jobs-A2Z** is a fully autonomous, terminal-based career operations platform built specifically for the **Indian tech job market**. Instead of manually browsing Naukri, LinkedIn, Instahyre, and Wellfound every day — this agent does it all for you in a single keystroke.

It scrapes live listings, evaluates each role against your CV using the Gemini AI brain, drafts ATS-optimized tailored resumes, discovers recruiter contacts, writes hyper-personalized cold emails, and dispatches them directly over Gmail SMTP — all from a sleek TUI dashboard running inside your terminal.

---

## 🧠 Architecture Overview

```
┌─────────────────────────────────────────────────┐
│          Onboarding Setup (CLI Prompts)          │
│  Name → Designation → CV → Auth → Target Role   │
└───────────────────┬─────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────┐
│         Playwright Web Scraper Engine            │
│  Naukri · LinkedIn · Instahyre · Wellfound       │
└───────────────────┬─────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────┐
│       Blessed TUI Master Dashboard               │
│  Jobs Pipeline · Eval · Resume · Logs tabs       │
└───────────────────┬─────────────────────────────┘
                    │
         ┌──────────┼──────────┐
         ▼          ▼          ▼
    [Enter]        [R]        [P]
  Gemini Eval   AI Resume   ATS PDF
                            Export
                    │
              ┌─────┴──────┐
              ▼            ▼
             [C]          [A]
        Contact +     Full Auto-Pilot
        Cold Email    (All steps at once)
```

---

## 🚀 Key Features

| Feature | Description |
|---|---|
| 🔍 **Live Job Scraping** | Playwright Chromium bypasses bot protection and scrapes real listings from Naukri, LinkedIn India, Instahyre, and Wellfound |
| 🧠 **Gemini AI Evaluation** | Each role is evaluated against your CV for skill gaps, match score, and recommendation |
| ✍️ **Tailored Resume Drafting** | AI generates a fully customized resume for each specific job description |
| 📄 **ATS-Optimized PDF Export** | Headless Chromium renders your resume into a professional, parser-friendly PDF |
| 🎯 **Recruiter Contact Discovery** | Hunter.io / Apollo.io APIs + algorithmic fallback to find real hiring manager emails |
| ✉️ **Cold Email Outreach** | Gemini drafts personalized cold emails; Nodemailer dispatches them over Gmail SMTP |
| 🤖 **Full Auto-Pilot Arc** | One key `[A]` executes the entire pipeline end-to-end autonomously |
| 🔬 **Glass-Box Observability** | Real-time logs tab streams all agent events, cache hits, and scraper progress |
| 💾 **Agent Diaries Caching** | LLM results are cached locally to avoid redundant API calls and reduce cost |

---

## 📋 Prerequisites

Before installing, ensure you have the following:

- **Node.js** v18 or higher — [Download](https://nodejs.org/)
- **npm** (comes with Node.js)
- **Google Account** (for Gemini CLI authentication)
- **Gmail App Password** (for outreach email dispatch)
- **Git** installed and configured

---

## 🛠️ Installation

### 1. Clone the Repository

```bash
git clone https://github.com/swapwarick/Jobs-A2Z.git
cd Jobs-A2Z
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Install Playwright Chromium Browser

```bash
npx playwright install chromium
```

### 4. Create your CV Profile

Create a file named `cv.md` in the project root and paste your resume/profile in Markdown format:

```bash
# Your Full Name
## Professional Summary
5+ years of experience in...

## Skills
- Node.js, React, Python...

## Experience
...
```

> This file is gitignored and stays 100% local to your machine.

### 5. Configure Environment Variables

Create a `.env` file in the project root:

```env
# Gmail SMTP (Required for automated email dispatch)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_USER=your.email@gmail.com
SMTP_PASS=your16charapppassword

# Optional: Contact Discovery APIs (leave blank to use Smart Fallback)
HUNTER_API_KEY=your_hunter_api_key
APOLLO_API_KEY=your_apollo_api_key
```

#### 📌 How to Get a Gmail App Password
1. Enable **2-Step Verification** on your Google Account.
2. Go to **[Google Account → Security → App passwords](https://myaccount.google.com/apppasswords)**.
3. Create a new app password for **Mail / Other (Jobs-A2Z)**.
4. Paste the 16-character password (without spaces) into `SMTP_PASS`.

#### 📌 Optional: Contact Discovery APIs
| API | Free Tier | Sign Up |
|---|---|---|
| [Hunter.io](https://hunter.io/) | 25 searches/month | [hunter.io](https://hunter.io/) |
| [Apollo.io](https://www.apollo.io/) | 50 contacts/month | [apollo.io](https://www.apollo.io/) |

> If both keys are left blank, the system uses a smart algorithmic fallback to deduce verified Indian corporate email patterns.

---

## ▶️ Running the Application

```bash
node index.js
```

You will be walked through a **5-step onboarding setup**:

```
================================================================
       ⚡ AGENT-HIRE : Indian Career-Ops Initialization
================================================================

👤 Enter your Name: Swapnil Netankar
💼 Enter your Current Designation/Headline: AI Infrastructure Engineer
📄 Base Profile loaded from ./cv.md (4316 characters)
✍️  Append specific focus/skills to resume? (Leave blank to keep base CV):

🔐 Initializing Google Gemini Agentic Cloud Authentication...
✅ Verified local OAuth / Environment Key access for Gemini.

🎯 Target Scrape Arc Pipeline Configuration
🔍 Enter specific Job Role to hunt: Senior MLOps Engineer

✅ Configured live scrapers on 4 regional portals targeting: "Senior MLOps Engineer"
🚀 Launching visual Master TUI Dashboard in 2 seconds...
```

---

## 🎮 Dashboard Controls

Once the TUI dashboard loads, use these keyboard shortcuts:

| Key | Action |
|---|---|
| `↑` / `↓` | Navigate the jobs list (left panel) |
| `←` / `→` | Switch focus between Jobs list and Workspace panel |
| `Tab` | Toggle panel focus |
| `Enter` | **Evaluate** selected job via Gemini AI |
| `R` | **Draft tailored resume** for selected job |
| `P` | **Export ATS-optimized PDF** of the tailored resume |
| `C` | **Discover recruiter contact** and draft + send cold email |
| `A` | **Full Auto-Pilot Arc** — runs all steps end-to-end autonomously |
| `S` | **Rescan** all portals for fresh listings |
| `1` | Switch to Evaluation tab |
| `2` | Switch to Tailored Resume tab |
| `3` | Switch to Base CV tab |
| `4` | Switch to Logs tab |
| `Q` / `Esc` | Exit the dashboard |

---

## 🔄 The Autonomous Arc Workflow (`[A]` key)

Pressing `[A]` on any job listing triggers the complete end-to-end pipeline:

```
Phase 1: 🧠 Gemini evaluates job vs. your CV (gap analysis + match score)
Phase 2: ✍️  AI drafts a customized tailored resume for this exact role
Phase 3: 📄 Headless Chromium renders a clean ATS-optimized PDF
Phase 4: 🎯 Hunter/Apollo (or fallback) resolves recruiter email
Phase 5: ✉️  Gemini writes cold outreach email + Gmail SMTP dispatches it
```

If SMTP credentials are not configured, the email payload is safely **spooled locally** to the `./outbox/` directory.

---

## 📁 Project Structure

```
Jobs-A2Z/
├── index.js          # Main TUI dashboard + onboarding setup
├── agent.js          # Gemini-powered AI skills (eval, resume, email)
├── scan.js           # Playwright web scraper for Indian job portals
├── auth.js           # Gemini CLI authentication helper
├── portals.yml       # Job portal configuration (auto-updated on launch)
├── package.json      # Project dependencies
├── .gitignore        # Protects .env, cv.md, PDFs from being committed
└── README.md         # This file
```

---

## 🔒 Privacy & Security

The following files are **permanently gitignored** and will **never be committed** to GitHub:

- `.env` — Your SMTP credentials and API keys
- `cv.md` — Your personal resume profile
- `*.pdf` — All generated ATS resume documents
- `outbox/` — Local email spool records
- `.agent-diaries/` — Local AI response cache

---

## 🧩 Tech Stack

| Layer | Technology |
|---|---|
| **Terminal UI** | [Blessed](https://github.com/chjj/blessed) + [Blessed-Contrib](https://github.com/yaronn/blessed-contrib) |
| **Web Scraping** | [Playwright](https://playwright.dev/) (Chromium) |
| **AI Brain** | [Google Gemini CLI](https://github.com/google-gemini/gemini-cli) |
| **PDF Generation** | Playwright headless + [Marked](https://marked.js.org/) (Markdown → HTML → PDF) |
| **Email Dispatch** | [Nodemailer](https://nodemailer.com/) over Gmail SMTP |
| **LLM Caching** | [Agent-Diaries](https://www.npmjs.com/package/agent-diaries) SDK |
| **Config** | YAML (`portals.yml`) + dotenv (`.env`) |

---

## 🤝 Contributing

Pull requests are welcome! For major changes, please open an issue first to discuss what you'd like to change.

1. Fork the repository
2. Create your feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'feat: add amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

---

## 📄 License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.

---

<div align="center">

**Built with ❤️ for the Indian tech job market**

*Stop scrolling job boards. Let the agent hunt for you.*

</div>
