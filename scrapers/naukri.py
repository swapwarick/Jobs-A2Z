import os
from playwright.sync_api import sync_playwright

def scrape_naukri(url: str) -> str:
    """Scrapes a Naukri job URL and returns a structured markdown representation."""
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False)
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

def auto_apply_naukri(url: str) -> str:
    """Uses the user's running Chrome browser to automatically apply for a job on Naukri."""
    with sync_playwright() as p:
        try:
            # Connect to the running Chrome instance over CDP
            browser = p.chromium.connect_over_cdp("http://localhost:9222")
            context = browser.contexts[0]
            page = context.new_page()
            
            page.goto(url, wait_until="networkidle", timeout=30000)
            
            # Look for the Apply button
            apply_btn = page.locator("button:has-text('Apply')").first
            
            if apply_btn.count() > 0:
                apply_text = apply_btn.inner_text().lower()
                if "company website" in apply_text:
                    result = "Redirect: This job requires applying on the external company website."
                else:
                    apply_btn.click()
                    try:
                        page.wait_for_selector(".apply-message, .msg-text", timeout=5000)
                        result = "Success: Application submitted successfully!"
                    except:
                        result = "Partial Success: Apply button clicked, but confirmation message not detected."
            else:
                result = "Failed: Apply button not found. You may have already applied, or the layout changed."
                
            page.close()
            return result
            
        except Exception as e:
            if "TargetClosedError" in str(e) or "ECONNREFUSED" in str(e) or "connect_over_cdp" in str(e):
                return (
                    "CRITICAL: Chrome is not running in debug mode!\n"
                    "To use your active PC session, you MUST start Chrome from the terminal like this:\n"
                    "  Start-Process 'chrome.exe' -ArgumentList '--remote-debugging-port=9222'\n"
                    "Make sure all other Chrome windows are closed before running that command."
                )
            return f"Error during auto-apply: {e}"

if __name__ == "__main__":
    # Test execution
    print("Naukri Scraper initialized.")
