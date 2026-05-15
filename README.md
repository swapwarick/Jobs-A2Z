# Indian JoB A2Z - Autonomous Job Search Command Center

Welcome to the **Indian JoB A2Z** platform! This is a fully autonomous, terminal-based (TUI) job-hunting agent tailored for the Indian tech market. It handles the entire pipeline from job discovery and AI evaluation to ATS resume tailoring and personalized cold outreach.

## Features
- **Interactive TUI**: Built with Textual for a sleek, responsive, hacker-style terminal dashboard.
- **Autonomous Scraping**: Uses Playwright to bypass basic bot protections and scrape live Indian job postings directly from **Naukri** and **Instahyre**.
- **On-Demand Search**: Use the built-in search bar to type exactly what role and location you want (e.g., `AI Ops Engineer in Mumbai`).
- **AI Brain Evaluation**: Powered by **Groq** (Llama-3.3-70b). It automatically reads your `cv.md` and the full Job Description, providing a 6-block analysis (Match Score, Required Skills, Missing Skills, Indian Market/LPA Context, etc.).
- **ATS Resume Tailoring**: Press a single hotkey to rewrite your CV instantly. The AI strips all conversational text and outputs a clean, highly ATS-optimized markdown file in the `tailored_resumes/` folder.
- **Outreach Pipeline**: Automatically drafts a personalized 150-word cold email specifically targeted at the hiring manager, and automatically opens your browser's Gmail compose window with everything pre-filled.

## Tech Stack
- **Python** (Core Logic)
- **Textual** (TUI Dashboard)
- **Playwright** (Headless/Non-Headless Job Scraping)
- **Groq API** (Lightning-fast AI Evaluation)

## Installation

1. Clone the repository.
2. Create a virtual environment:
   ```bash
   python -m venv venv
   .\venv\Scripts\Activate
   ```
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   playwright install chromium
   ```
4. Configure your `.env` file (copy from a sample if provided) with your Groq API Key:
   ```
   GROQ_API_KEY=your_groq_key_here
   AI_PROVIDER=groq
   SCRAPER_AI_PROVIDER=groq
   EVALUATOR_AI_PROVIDER=groq
   RESUME_AI_PROVIDER=groq
   ```
5. Add your resume content to `cv.md`.

## Usage
Run the dashboard from your terminal:
```bash
python dashboard.py
```

### Hotkeys
- **`s`**: Focus the search bar. Type your query (e.g., "Python Developer Bangalore") and hit Enter to scan Naukri and Instahyre.
- **`e`**: Highlight a job in the table and press `e` to trigger the Deep AI Evaluation.
- **`r`**: Highlight a job and press `r` to generate a tailored ATS-friendly Resume (saved to `tailored_resumes/`).
- **`c`**: Highlight a job and press `c` to generate a Cold Email and open your Gmail compose window.
- **`q`**: Quit the dashboard.

## Disclaimer
This tool is for educational and personal workflow optimization purposes. Scraping websites should be done in compliance with the respective platform's Terms of Service.
