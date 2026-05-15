import os
from playwright.sync_api import sync_playwright
from playwright_stealth import stealth_sync
from playwright.sync_api import sync_playwright

def scrape_instahyre(url: str) -> str:
    """Scrapes an Instahyre job URL and returns a structured markdown representation."""
    with sync_playwright() as p:
        profile_dir = os.path.abspath("agent_profile")
        context = p.chromium.launch_persistent_context(
            user_data_dir=profile_dir,
            headless=False,
            channel="chrome",
            args=["--disable-blink-features=AutomationControlled"],
            ignore_default_args=["--enable-automation"]
        )
        page = context.pages[0] if context.pages else context.new_page()
        stealth_sync(page)
            
        try:
            page.goto(url, wait_until="networkidle", timeout=30000)
            
            title_elem = page.locator("h1, .job-title")
            title = title_elem.first.inner_text() if title_elem.count() > 0 else "Unknown Title"
            
            company_elem = page.locator("h2.company-name, .employer-name")
            company = company_elem.first.inner_text() if company_elem.count() > 0 else "Unknown Company"
            
            jd_elem = page.locator(".job-description, .description")
            jd_text = jd_elem.first.inner_text() if jd_elem.count() > 0 else "Description not found."
            
            markdown = f"# {title} at {company}\n\n"
            markdown += f"## Job Description\n{jd_text}\n"
            
            # Ensure the jds directory exists
            os.makedirs("jds", exist_ok=True)
            filename = f"jds/instahyre_{company.replace(' ', '_').lower()}.md"
            with open(filename, "w", encoding="utf-8") as f:
                f.write(markdown)
                
            return markdown
        
        except Exception as e:
            return f"Failed to scrape Instahyre: {e}"
        finally:
            if 'context' in locals():
                context.close()

if __name__ == "__main__":
    print("Instahyre Scraper initialized.")
