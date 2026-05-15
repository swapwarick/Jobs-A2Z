import os
from playwright.sync_api import sync_playwright

def scrape_naukri(url: str) -> str:
    """Scrapes a Naukri job URL and returns a structured markdown representation."""
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
        
        try:
            page.goto(url, wait_until="networkidle", timeout=30000)
            
            # Common Naukri CSS Selectors (these can change, but represent the standard layout)
            title_elem = page.locator("h1.jd-header-title, .job-title")
            title = title_elem.first.inner_text() if title_elem.count() > 0 else "Unknown Title"
            
            company_elem = page.locator(".jd-header-comp-name a, .company-name")
            company = company_elem.first.inner_text() if company_elem.count() > 0 else "Unknown Company"
            
            exp_elem = page.locator(".exp .locWdth, .experience")
            exp = exp_elem.first.inner_text() if exp_elem.count() > 0 else "Not specified"
            
            sal_elem = page.locator(".salary .locWdth, .salary-box")
            salary = sal_elem.first.inner_text() if sal_elem.count() > 0 else "Not specified"
            
            jd_elem = page.locator(".dang-inner-html, .job-desc")
            jd_text = jd_elem.first.inner_text() if jd_elem.count() > 0 else "Description not found."
            
            # Build Markdown
            markdown = f"# {title} at {company}\n"
            markdown += f"**Experience:** {exp} | **Salary:** {salary}\n\n"
            markdown += f"## Job Description\n{jd_text}\n"
            
            # Save to the jds directory for tracking
            os.makedirs("jds", exist_ok=True)
            filename = f"jds/naukri_{company.replace(' ', '_').lower()}.md"
            with open(filename, "w", encoding="utf-8") as f:
                f.write(markdown)
                
            return markdown
        
        except Exception as e:
            return f"Failed to scrape Naukri: {e}"
        finally:
            browser.close()

if __name__ == "__main__":
    # Test execution
    print("Naukri Scraper initialized.")
