from textual.app import App, ComposeResult
from textual.widgets import Header, Footer, DataTable, Static, Log, Input
from textual.containers import Horizontal, Vertical
from textual.binding import Binding
from textual import work
import sys
import os

# Add local path to access scrapers folder properly
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from ai_brain import AIBrain

class JobDashboard(App):
    """A Textual terminal dashboard for Indian JoB A2Z."""
    
    jobs = [] # Store live jobs to map table rows back to URLs
    
    
    CSS = """
    Screen {
        background: $surface;
    }
    #search_input {
        dock: top;
        border: solid cyan;
    }
    DataTable {
        height: 60%;
        border: solid green;
    }
    #details_panel {
        height: 40%;
        border: solid blue;
        padding: 1;
    }
    """
    
    BINDINGS = [
        Binding("q", "quit", "Quit", show=True),
        Binding("s", "scan", "Scan Portals", show=True),
        Binding("e", "evaluate", "Evaluate Job", show=True),
        Binding("r", "tailor_resume", "Tailor Resume", show=True),
        Binding("c", "contact", "Cold Email", show=True),
    ]

    def compose(self) -> ComposeResult:
        """Create child widgets for the app."""
        yield Header(show_clock=True)
        
        with Vertical():
            yield Input(id="search_input", placeholder="Enter job title and location (e.g., AI Ops Engineer in Mumbai) and press Enter...")
            yield DataTable(id="jobs_table")
            yield Log(id="details_panel")
            
        yield Footer()

    def on_mount(self) -> None:
        """Called when app starts."""
        self.title = "Indian JoB A2Z"
        self.sub_title = "Autonomous Job Search Command Center"
        
        table = self.query_one(DataTable)
        table.add_columns("Date", "Company", "Role", "Match Score", "Status")
        
        # Load dummy data for scaffolding
        table.add_row("2026-05-15", "Example Tech", "Senior Backend Engineer", "A (92%)", "Pending")
        table.add_row("2026-05-14", "Startup Inc", "Python Developer", "B (85%)", "Applied")
        table.add_row("2026-05-13", "Big Corp", "Software Engineer", "C (70%)", "Rejected")
        
        log = self.query_one(Log)
        log.write_line("[bold green]System Initialized.[/bold green]")
        log.write_line("AI Brain configured. Press 's' to simulate a portal scan or 'e' to evaluate the selected job.")

    @work(thread=True)
    def do_background_scan(self, query: str = None) -> None:
        """Runs the Playwright scrapers in a background thread."""
        log = self.query_one(Log)
        table = self.query_one(DataTable)
        
        try:
            from scrapers.scanner import run_full_scan
            jobs = run_full_scan(query=query)
            
            if not jobs:
                self.app.call_from_thread(log.write_line, "[bold red]Scan completed, but no jobs found or scraping failed.[/bold red]")
                return
                
            self.jobs = jobs # Save to class state for evaluation mapping
            self.app.call_from_thread(log.write_line, f"[bold green]Scan complete! Found {len(jobs)} live jobs for '{query if query else 'Default Profile'}'.[/bold green]")
            
            # Clear existing rows and add new ones from the live scrape
            self.app.call_from_thread(table.clear)
            from datetime import datetime
            today = datetime.now().strftime("%Y-%m-%d")
            
            for job in jobs:
                self.app.call_from_thread(
                    table.add_row, 
                    today,
                    job["company"], 
                    job["title"], 
                    job["match_score"],
                    job["portal"]
                )
        except Exception as e:
            self.app.call_from_thread(log.write_line, f"[bold red]Scanner error:[/bold red] {e}")

    def on_input_submitted(self, event: Input.Submitted) -> None:
        """Called when user presses Enter in the Input widget."""
        if event.input.id == "search_input":
            query = event.value.strip()
            log = self.query_one(Log)
            if query:
                log.write_line(f"[bold cyan]Searching for: {query}...[/bold cyan]")
                log.write_line("Please wait... bypassing bot protections. This may take ~15 seconds.")
                self.do_background_scan(query)
            else:
                log.write_line("[bold red]Please enter a valid search query.[/bold red]")

    def action_scan(self) -> None:
        """Called when 's' is pressed."""
        # Focus the search input instead of auto-scanning
        self.query_one(Input).focus()
        
    @work(thread=True)
    def do_background_evaluate(self, row_index: int) -> None:
        log = self.query_one(Log)
        table = self.query_one(DataTable)
        
        if not self.jobs or row_index >= len(self.jobs) or row_index < 0:
            self.app.call_from_thread(log.write_line, "[bold red]Error: No job data found for this row. Please run a scan first.[/bold red]")
            return
            
        job = self.jobs[row_index]
        self.app.call_from_thread(log.write_line, f"[bold cyan]Scraping full JD for {job['title']} at {job['company']}...[/bold cyan]")
        
        try:
            jd_markdown = ""
            if job["portal"] == "Naukri":
                from scrapers.naukri import scrape_naukri
                jd_markdown = scrape_naukri(job["url"])
            elif job["portal"] == "Instahyre":
                from scrapers.instahyre import scrape_instahyre
                jd_markdown = scrape_instahyre(job["url"])
            else:
                jd_markdown = "No scraper available for this portal."
                
            # Read CV
            with open("cv.md", "r", encoding="utf-8") as f:
                cv_text = f.read()
                
            self.app.call_from_thread(log.write_line, "[bold yellow]Sending JD & CV to AI Brain for Deep Evaluation...[/bold yellow]")
            
            prompt = f"""
            You are an expert technical recruiter evaluating a candidate for the Indian tech market.
            
            CANDIDATE CV:
            {cv_text}
            
            JOB DESCRIPTION:
            {jd_markdown}
            
            Please provide a structured 6-block evaluation:
            1. Match Score (A, B, C, D, or F)
            2. Top 3 Matching Skills
            3. Missing/Weak Skills
            4. Indian Market Context (e.g. typical CTC for this role/experience in LPA)
            5. Recommended action (Apply / Skip / Upskill)
            6. A short 1-line personalized hook for a cold email.
            
            Keep your response concise and formatted cleanly for a terminal UI.
            """
            
            brain = AIBrain()
            evaluation = brain.evaluate(prompt, task_type="evaluator")
            
            self.app.call_from_thread(log.write_line, "\n[bold magenta]--- AI EVALUATION RESULT ---[/bold magenta]")
            self.app.call_from_thread(log.write_line, evaluation)
            self.app.call_from_thread(log.write_line, "[bold magenta]--------------------------[/bold magenta]\n")
            
            # We need the RowKey and ColumnKey to update cells in Textual.
            # Instead of crashing, we will just skip updating the table cell for now,
            # as the evaluation result is printed to the log panel perfectly.
            # (To update: we would need to store the row_key returned by add_row)
            
        except Exception as e:
            self.app.call_from_thread(log.write_line, f"[bold red]Evaluation failed:[/bold red] {e}")

    def action_evaluate(self) -> None:
        """Called when 'e' is pressed."""
        table = self.query_one(DataTable)
        try:
            row_index = table.cursor_row
            self.do_background_evaluate(row_index)
        except Exception:
            log = self.query_one(Log)
            log.write_line("[bold red]Please select a job from the table first.[/bold red]")

    @work(thread=True)
    def do_background_tailor(self, row_index: int) -> None:
        log = self.query_one(Log)
        
        if not self.jobs or row_index >= len(self.jobs) or row_index < 0:
            self.app.call_from_thread(log.write_line, "[bold red]Error: No job data found for this row. Please run a scan first.[/bold red]")
            return
            
        job = self.jobs[row_index]
        self.app.call_from_thread(log.write_line, f"[bold cyan]Scraping full JD for {job['title']} at {job['company']} to tailor resume...[/bold cyan]")
        
        try:
            jd_markdown = ""
            if job["portal"] == "Naukri":
                from scrapers.naukri import scrape_naukri
                jd_markdown = scrape_naukri(job["url"])
            elif job["portal"] == "Instahyre":
                from scrapers.instahyre import scrape_instahyre
                jd_markdown = scrape_instahyre(job["url"])
                
            # Read CV
            with open("cv.md", "r", encoding="utf-8") as f:
                cv_text = f.read()
                
            self.app.call_from_thread(log.write_line, "[bold yellow]Generating ATS-Optimized Resume using Groq...[/bold yellow]")
            
            prompt = f"""
            You are an expert ATS resume optimizer. 
            Rewrite the provided candidate CV to perfectly match the provided Job Description.
            Optimize keywords, reframe experience to highlight relevant skills, and ensure high ATS compatibility.
            
            CRITICAL INSTRUCTIONS:
            1. DO NOT include any conversational text, introductory remarks, or explanations.
            2. DO NOT write phrases like "Here is the tailored resume based on the job role."
            3. OUTPUT STRICTLY AND ONLY the raw markdown of the new resume.
            
            CANDIDATE CV:
            {cv_text}
            
            JOB DESCRIPTION:
            {jd_markdown}
            """
            
            brain = AIBrain()
            tailored_resume = brain.evaluate(prompt, task_type="resume")
            
            # Clean up any potential markdown code block wrappers
            if tailored_resume.startswith("```markdown"):
                tailored_resume = tailored_resume[11:]
            if tailored_resume.startswith("```"):
                tailored_resume = tailored_resume[3:]
            if tailored_resume.endswith("```"):
                tailored_resume = tailored_resume[:-3]
                
            tailored_resume = tailored_resume.strip()
            
            import os
            import re
            
            # Create directory if it doesn't exist
            os.makedirs("tailored_resumes", exist_ok=True)
            
            # Safe filename
            safe_company = re.sub(r'[^a-zA-Z0-9]', '_', job["company"])
            filepath = os.path.join("tailored_resumes", f"CV_{safe_company}.md")
            
            with open(filepath, "w", encoding="utf-8") as f:
                f.write(tailored_resume)
                
            self.app.call_from_thread(log.write_line, f"[bold green]Success! Tailored resume saved to: {filepath}[/bold green]")
            
        except Exception as e:
            self.app.call_from_thread(log.write_line, f"[bold red]Resume tailoring failed:[/bold red] {e}")

    def action_tailor_resume(self) -> None:
        """Called when 'r' is pressed."""
        table = self.query_one(DataTable)
        try:
            row_index = table.cursor_row
            self.do_background_tailor(row_index)
        except Exception:
            log = self.query_one(Log)
            log.write_line("[bold red]Please select a job from the table first.[/bold red]")

    @work(thread=True)
    def do_background_contact(self, row_index: int) -> None:
        log = self.query_one(Log)
        
        if not self.jobs or row_index >= len(self.jobs) or row_index < 0:
            self.app.call_from_thread(log.write_line, "[bold red]Error: No job data found for this row. Please run a scan first.[/bold red]")
            return
            
        job = self.jobs[row_index]
        self.app.call_from_thread(log.write_line, f"[bold cyan]Drafting personalized cold email for {job['title']} at {job['company']}...[/bold cyan]")
        
        try:
            jd_markdown = ""
            if job["portal"] == "Naukri":
                from scrapers.naukri import scrape_naukri
                jd_markdown = scrape_naukri(job["url"])
            elif job["portal"] == "Instahyre":
                from scrapers.instahyre import scrape_instahyre
                jd_markdown = scrape_instahyre(job["url"])
                
            # Read CV
            with open("cv.md", "r", encoding="utf-8") as f:
                cv_text = f.read()
                
            prompt = f"""
            You are an expert career strategist. Write a highly personalized, compelling, and concise cold email (under 150 words) 
            to the hiring manager at {job['company']} for the {job['title']} position.
            
            Use the candidate's CV to highlight exactly 1 or 2 overlapping skills/projects.
            
            CRITICAL INSTRUCTIONS:
            1. Line 1 MUST BE the Subject Line (e.g., "Subject: Application for ...").
            2. Line 2 MUST BE BLANK.
            3. The rest is the email body.
            4. DO NOT include placeholders like [Your Name], use the actual name from the CV.
            5. Output ONLY the Subject and Body. No conversational meta-text.
            
            CANDIDATE CV:
            {cv_text}
            
            JOB DESCRIPTION:
            {jd_markdown}
            """
            
            brain = AIBrain()
            response = brain.evaluate(prompt, task_type="evaluator")
            
            lines = response.strip().split("\n")
            subject = lines[0].replace("Subject: ", "").strip()
            body = "\n".join(lines[1:]).strip()
            
            self.app.call_from_thread(log.write_line, f"[bold green]Email drafted! Opening Gmail compose window...[/bold green]")
            
            import urllib.parse
            import webbrowser
            
            # Create Gmail compose URL
            encoded_subject = urllib.parse.quote(subject)
            encoded_body = urllib.parse.quote(body)
            gmail_url = f"https://mail.google.com/mail/?view=cm&fs=1&to=hiring@{job['company'].lower().replace(' ', '')}.com&su={encoded_subject}&body={encoded_body}"
            
            webbrowser.open(gmail_url)
            
        except Exception as e:
            self.app.call_from_thread(log.write_line, f"[bold red]Email drafting failed:[/bold red] {e}")

    def action_contact(self) -> None:
        """Called when 'c' is pressed."""
        table = self.query_one(DataTable)
        try:
            row_index = table.cursor_row
            self.do_background_contact(row_index)
        except Exception:
            log = self.query_one(Log)
            log.write_line("[bold red]Please select a job from the table first.[/bold red]")

if __name__ == "__main__":
    app = JobDashboard()
    app.run()
