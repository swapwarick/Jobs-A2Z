# ⚡ Jobs-A2Z — Agentic Platform to Find the Right Jobs

> An enterprise-grade, agentic AI platform that finds, evaluates, and applies to the right jobs for you — powered by a **pluggable AI brain** (Groq · Gemini · OpenAI · Claude · Ollama) and **multi-provider SMTP dispatch** (Gmail · Outlook · Yahoo · SendGrid · Mailgun · Zoho).

[![Node.js](https://img.shields.io/badge/Node.js-18%2B-green?logo=node.js)](https://nodejs.org/)
[![Groq](https://img.shields.io/badge/Groq-LLaMA%203-FF6B35)](https://console.groq.com/)
[![Gemini](https://img.shields.io/badge/Gemini-REST%20%2F%20CLI-blue?logo=google)](https://aistudio.google.com/)
[![OpenAI](https://img.shields.io/badge/OpenAI-GPT--4o-412991?logo=openai)](https://platform.openai.com/)
[![Ollama](https://img.shields.io/badge/Ollama-Local%20LLM-black)](https://ollama.com/)
[![Playwright](https://img.shields.io/badge/Playwright-Chromium-orange?logo=playwright)](https://playwright.dev/)
[![License](https://img.shields.io/github/license/swapwarick/Jobs-A2Z)](LICENSE)

---

## 🌟 What is Jobs-A2Z?

**Jobs-A2Z** is a fully autonomous, terminal-based career operations platform built specifically for the **Indian tech job market**. Instead of manually browsing job sites every day — this agent does it all for you in a single keystroke.

It scrapes live listings from **8 Indian job portals**, evaluates each role against your CV, drafts ATS-optimized tailored resumes, discovers recruiter contacts, writes hyper-personalized cold emails, and dispatches them — all from a sleek TUI dashboard.

The AI brain and email dispatch are fully **pluggable**: use Groq's free LLaMA 3 (recommended), Google Gemini, OpenAI GPT-4o, Anthropic Claude, or even a fully offline local Ollama model. Send emails over Gmail, Outlook, Yahoo, SendGrid, Mailgun, Zoho, or any custom SMTP server.

---

## 🧠 Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│           Onboarding Setup (CLI Prompts)             │
│   Name → Designation → CV → Auth → Target Role      │
└─────────────────────┬───────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────┐
│          Playwright Web Scraper Engine               │
│  Naukri · LinkedIn · Indeed · Instahyre · Wellfound  │
│  TimesJobs · Shine · Hirist  (8 portals)            │
└─────────────────────┬───────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────┐
│         Blessed TUI Master Dashboard                 │
│   Jobs Pipeline · Eval · Resume · Logs tabs          │
└─────────────────────┬───────────────────────────────┘
                      │
           ┌──────────┼──────────┐
           ▼          ▼          ▼
      [Enter]        [R]        [P]
    AI Eval      AI Resume   ATS PDF
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
| 🔍 **Live Job Scraping** | Playwright Chromium scrapes real listings from 8 Indian portals — Naukri, LinkedIn, Indeed, Instahyre, Wellfound, TimesJobs, Shine, Hirist |
| 🧠 **Multi-Provider AI Brain** | Pluggable AI router: Groq LLaMA 3 (free, default) → Gemini → OpenAI → Claude → Ollama → Gemini CLI fallback chain |
| ✍️ **Tailored Resume Drafting** | AI generates a fully customized resume for each specific job description |
| 📄 **ATS-Optimized PDF Export** | Headless Chromium renders your resume into a professional, parser-friendly PDF |
| 🎯 **Recruiter Contact Discovery** | Hunter.io / Apollo.io APIs + algorithmic fallback to find hiring manager emails |
| ✉️ **Multi-Provider Email Dispatch** | Gmail, Outlook, Yahoo, SendGrid, Mailgun, Zoho, or custom SMTP — auto-selected from `.env` |
| 🤖 **Full Auto-Pilot Arc** | One key `[A]` executes the entire pipeline end-to-end autonomously |
| 🌐 **Open in Browser** | Press `[O]` to open any job listing URL directly in your default browser |
| ♻️ **Smart Deduplication** | Auto-scans skip already-seen listings so you only see fresh opportunities every run |
| 🔬 **Glass-Box Observability** | Real-time Logs tab streams all agent events, cache hits, and scraper progress |
| 💾 **Agent Diaries Caching** | LLM results are cached locally to avoid redundant API calls and reduce cost |

---

## 📋 Prerequisites

- **Node.js** v18 or higher — [Download](https://nodejs.org/)
- **npm** (comes with Node.js)
- **At least one AI provider key** — Groq is free and recommended ([get a key in 30 seconds](https://console.groq.com/keys))
- **An email account** for outreach dispatch (optional — emails spool locally if not configured)

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

### 3. Install Playwright Chromium

```bash
npx playwright install chromium
```

### 4. Create your CV Profile

Create `cv.md` in the project root with your resume in Markdown format:

```markdown
# Your Full Name
## Professional Summary
5+ years of experience in...

## Skills
- Node.js, React, Python...

## Experience
...
```

> `cv.md` is gitignored and stays 100% local to your machine.

### 5. Run it — the app sets up everything else interactively

```bash
npm start
```

No `.env` file needed upfront. On first launch the app walks you through a setup wizard that asks for your AI provider key and saves it to `.env` automatically:

```
================================================================
       ⚡ AGENT-HIRE : Indian Career-Ops Initialization
================================================================

👤 Enter your Name: Swapnil Netankar
💼 Enter your Current Designation/Headline: AI Infrastructure Engineer
📄 Base Profile loaded from ./cv.md (4316 characters)
✍️  Append specific focus/skills to resume? (Leave blank to keep base CV):

🎯 Target Scrape Arc Pipeline Configuration
🔍 Enter specific Job Role to hunt: Senior MLOps Engineer

╔══════════════════════════════════════════════════╗
║           🤖  AI PROVIDER SETUP                  ║
╠══════════════════════════════════════════════════╣
║  No API key found. Pick a provider to continue:  ║
╚══════════════════════════════════════════════════╝

  [1] Groq       FREE · ultra-fast LLaMA 3  ← recommended
                 Key at: https://console.groq.com/keys

  [2] Gemini     Free tier · Google's model
                 Key at: https://aistudio.google.com/app/apikey

  [3] OpenAI     GPT-4o · most capable (paid)
                 Key at: https://platform.openai.com/api-keys

  [4] Claude     Anthropic · strong reasoning (paid)
                 Key at: https://console.anthropic.com/

  [5] Ollama     100% local · offline · no key needed

  [6] Gemini CLI OAuth browser login · no API key needed

  Enter choice [1-6]: 1

  🔑 Paste your Groq API key (gsk_...): gsk_xxxxxxxxxxxx

  ✅ Groq key saved to .env — won't ask again next launch.

✅ Configured live scrapers on 8 regional portals targeting: "Senior MLOps Engineer"
🚀 Launching Master TUI Dashboard in 2 seconds...
```

On subsequent runs the saved key is detected automatically and onboarding is skipped.

**Advanced:** You can also pre-create a `.env` manually if you prefer — the wizard only triggers when no key is found:

```env
# ── AI PROVIDER (auto | groq | gemini | openai | claude | ollama) ──
AI_PROVIDER=auto

# Groq (FREE tier, ultra-fast) — https://console.groq.com/keys
GROQ_API_KEY=your_groq_key_here

# ── EMAIL DISPATCH (optional) ─────────────────────────────────────
SMTP_PROVIDER=gmail
SMTP_USER=your.email@gmail.com
SMTP_PASS=your16charapppassword

# ── CONTACT DISCOVERY (optional) ──────────────────────────────────
HUNTER_API_KEY=
APOLLO_API_KEY=
```

---

## 🎮 Dashboard Controls

| Key | Action |
|---|---|
| `↑` / `↓` | Navigate the jobs list |
| `←` / `→` | Switch focus between Jobs list and Workspace panel |
| `Tab` | Toggle panel focus |
| `Enter` | **Evaluate** selected job via AI |
| `R` | **Draft tailored resume** for selected job |
| `P` | **Export ATS-optimized PDF** of the tailored resume |
| `O` | **Open job URL** in your default browser |
| `C` | **Discover recruiter contact** and draft + send cold email |
| `A` | **Full Auto-Pilot Arc** — runs all steps end-to-end |
| `S` | **Rescan** all portals for fresh listings |
| `N` | **Change target role** on-the-fly without restarting |
| `1` | Evaluation tab |
| `2` | Tailored Resume tab |
| `3` | Base CV tab |
| `4` | Logs tab |
| `Q` / `Esc` | Exit |

---

## 🔄 The Autonomous Arc Workflow (`[A]` key)

Pressing `[A]` on any job listing triggers the complete end-to-end pipeline:

```
Phase 1: 🧠 AI evaluates job vs. your CV (gap analysis + match score)
           └─ Uses: Groq → Gemini → OpenAI → Claude → Ollama → Gemini CLI
Phase 2: ✍️  AI drafts a customized tailored resume for this exact role
Phase 3: 📄 Headless Chromium renders a clean ATS-optimized PDF
Phase 4: 🎯 Hunter/Apollo (or smart fallback) resolves recruiter email
Phase 5: ✉️  AI writes cold outreach email
Phase 6: 📤 Dispatches via configured SMTP (or spools to ./outbox/)
```

If SMTP credentials are not configured, the email payload is safely **spooled locally** to `./outbox/`.

---

## 🔌 Provider Configuration

### 🧠 AI Brain Providers

| Provider | `AI_PROVIDER` value | Speed | Cost | Requires |
|---|---|---|---|---|
| **Groq LLaMA 3** | `groq` | 🚀 Fastest | **Free tier** | `GROQ_API_KEY` |
| **Gemini REST API** | `gemini` | ⚡ Fast | Free / Pay-as-go | `GEMINI_API_KEY` |
| **OpenAI GPT-4o** | `openai` | ⚡ Fast | Paid | `OPENAI_API_KEY` |
| **Anthropic Claude** | `claude` | ⚡ Fast | Paid | `ANTHROPIC_API_KEY` |
| **Ollama (Local)** | `ollama` | Moderate | **100% Free** | Local install |
| **Gemini CLI** | *(fallback)* | Slow | Free | OAuth session |

> 💡 **Groq is the recommended default** — get your key in 30 seconds at [console.groq.com](https://console.groq.com/keys). No credit card required.

### ✉️ Email (SMTP) Providers

| Provider | `SMTP_PROVIDER` value | Notes |
|---|---|---|
| **Gmail** | `gmail` | Requires [App Password](https://myaccount.google.com/apppasswords) |
| **Outlook / Hotmail** | `outlook` | Use your Microsoft account password |
| **Yahoo Mail** | `yahoo` | Requires Yahoo App Password |
| **SendGrid** | `sendgrid` | Set `SENDGRID_API_KEY` — best for bulk sending |
| **Mailgun** | `mailgun` | Good for transactional emails |
| **Zoho Mail** | `zoho` | Popular with Indian businesses |
| **Office 365** | `office365` | Microsoft 365 Business accounts |
| **Custom SMTP** | `custom` | Also set `SMTP_HOST` and `SMTP_PORT` |

> 💡 If no SMTP is configured, all emails are saved to `./outbox/` as text files for manual review.

---

## 📁 Project Structure

```
Jobs-A2Z/
├── index.js          # Main TUI dashboard + onboarding setup
├── agent.js          # Multi-provider AI skills (eval, resume, email, SMTP)
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
- `user-profile.json` — Saved onboarding profile

---

## 🧩 Tech Stack

| Layer | Technology |
|---|---|
| **Terminal UI** | [Blessed](https://github.com/chjj/blessed) + [Blessed-Contrib](https://github.com/yaronn/blessed-contrib) |
| **Web Scraping** | [Playwright](https://playwright.dev/) (Chromium, locale: en-IN) |
| **AI Brain** | [Groq SDK](https://console.groq.com/) · [Gemini REST](https://ai.google.dev/) · [OpenAI SDK](https://github.com/openai/openai-node) · [Ollama](https://ollama.com/) · [Gemini CLI](https://github.com/google-gemini/gemini-cli) |
| **PDF Generation** | Playwright headless + [Marked](https://marked.js.org/) (Markdown → HTML → PDF) |
| **Email Dispatch** | [Nodemailer](https://nodemailer.com/) — Gmail · Outlook · Yahoo · SendGrid · Mailgun · Zoho · Custom |
| **LLM Caching** | [@swapwarick_n/agent-diaries](https://www.npmjs.com/package/@swapwarick_n/agent-diaries) |
| **Config** | YAML (`portals.yml`) + dotenv (`.env`) |

---

## 🤝 Contributing

Pull requests are welcome! For major changes, please open an issue first.

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
