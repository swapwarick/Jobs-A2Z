import os
from playwright_stealth import Stealth
from playwright.sync_api import sync_playwright
import time

def scrape_linkedin(url: str) -> str:
    """Scrapes a LinkedIn job URL and returns a structured markdown representation."""
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
        Stealth().apply_stealth_sync(page)
            
        try:
            page.goto(url, wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(3000) # Wait for JD to load fully
            
            title_elem = page.locator("h1.t-24, h1.top-card-layout__title")
            title = title_elem.first.inner_text() if title_elem.count() > 0 else "Unknown Title"
            
            company_elem = page.locator(".job-details-jobs-unified-top-card__company-name, .topcard__org-name-link")
            company = company_elem.first.inner_text() if company_elem.count() > 0 else "Unknown Company"
            
            jd_elem = page.locator("div#job-details, div.description__text, .jobs-description__content")
            jd_text = jd_elem.first.inner_text() if jd_elem.count() > 0 else "Description not found."
            
            markdown = f"# {title} at {company}\n\n"
            markdown += f"## Job Description\n{jd_text}\n"
            
            os.makedirs("jds", exist_ok=True)
            filename = f"jds/linkedin_{company.replace(' ', '_').lower()}.md"
            with open(filename, "w", encoding="utf-8") as f:
                f.write(markdown)
                
            return markdown
        
        except Exception as e:
            return f"Failed to scrape LinkedIn: {e}"
        finally:
            if 'context' in locals():
                context.close()

def auto_apply_linkedin(url: str) -> str:
    """Uses a persistent agent profile to apply for a job automatically on LinkedIn."""
    with sync_playwright() as p:
        try:
            profile_dir = os.path.abspath("agent_profile")
            context = p.chromium.launch_persistent_context(
                user_data_dir=profile_dir,
                headless=False,
                channel="chrome",
                args=["--disable-blink-features=AutomationControlled"],
                ignore_default_args=["--enable-automation"]
            )
            page = context.pages[0] if context.pages else context.new_page()
            Stealth().apply_stealth_sync(page)
            
            page.goto(url, wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(3000)
            
            # Vanilla JS click bypass for LinkedIn "Easy Apply"
            click_result = page.evaluate("""() => {
                let elements = Array.from(document.querySelectorAll('button'));
                let applyBtn = elements.find(el => {
                    let text = (el.innerText || "").trim().toLowerCase();
                    return text.includes('easy apply') || text === 'apply';
                });
                
                if (applyBtn) {
                    if (!applyBtn.innerText.toLowerCase().includes("easy apply") && applyBtn.innerText.toLowerCase() === 'apply') {
                        return "redirect";
                    }
                    applyBtn.click();
                    return "clicked";
                }
                return "not_found";
            }""")
            
            if click_result == "redirect":
                result = "Redirect: This job requires applying on an external company website."
            elif click_result == "clicked":
                try:
                    # Give it a bit of time to open the modal
                    page.wait_for_timeout(2000)
                    result = "Partial Success: Easy Apply modal opened! Full automation of LinkedIn flows requires complex form handling."
                except:
                    result = "Partial Success: Apply button clicked, but modal not detected."
            else:
                result = "Failed: Apply button not found. You may have already applied, or the layout changed."
                
            context.close()
            return result
            
        except Exception as e:
            return f"Error during auto-apply: {e}"

if __name__ == "__main__":
    print("LinkedIn Scraper initialized.")
