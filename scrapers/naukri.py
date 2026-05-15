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
    """Uses a persistent session to automatically apply for a job on Naukri."""
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False)
        
        state_file = "naukri_state.json"
        
        # If no saved session exists, force a manual login first.
        if not os.path.exists(state_file):
            context = browser.new_context(user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
            page = context.new_page()
            page.goto("https://login.naukri.com/")
            print("\n[!] PLEASE LOG IN TO NAUKRI IN THE OPEN BROWSER WINDOW.")
            print("[!] You have 60 seconds to complete the login...")
            
            try:
                # Wait for the user to log in (the user icon or homepage usually appears)
                page.wait_for_selector(".nI-gNb-drawer__icon", timeout=60000)
                print("[+] Login detected! Saving session state...")
                context.storage_state(path=state_file)
            except Exception:
                browser.close()
                return "Failed: Login timed out or was not completed successfully."
        else:
            # Load the saved session
            context = browser.new_context(
                storage_state=state_file,
                user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            )
            page = context.new_page()
            
        try:
            page.goto(url, wait_until="networkidle", timeout=30000)
            
            # Look for the Apply button
            # Naukri has multiple variations: "Apply", "Apply on company website", etc.
            apply_btn = page.locator("button:has-text('Apply')").first
            
            if apply_btn.count() > 0:
                apply_text = apply_btn.inner_text().lower()
                if "company website" in apply_text:
                    return "Redirect: This job requires applying on the external company website."
                
                apply_btn.click()
                
                # Wait for success message or popup
                try:
                    page.wait_for_selector(".apply-message, .msg-text", timeout=5000)
                    return "Success: Application submitted successfully!"
                except:
                    return "Partial Success: Apply button clicked, but confirmation message not detected."
            else:
                return "Failed: Apply button not found. You may have already applied, or the layout changed."
                
        except Exception as e:
            return f"Error during auto-apply: {e}"
        finally:
            browser.close()

if __name__ == "__main__":
    # Test execution
    print("Naukri Scraper initialized.")
