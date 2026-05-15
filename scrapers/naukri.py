import os
from playwright_stealth import Stealth
from playwright.sync_api import sync_playwright

def scrape_naukri(url: str) -> str:
    """Scrapes a Naukri job URL and returns a structured markdown representation."""
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
            page.goto(url, wait_until="networkidle", timeout=30000)
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
            if 'context' in locals():
                context.close()

def auto_apply_naukri(url: str) -> str:
    """Uses a persistent agent profile to apply for a job automatically."""
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
            
            page.goto(url, wait_until="networkidle", timeout=30000)
            
            import re
            
            try:
                # Look for the Apply button and wait for it to appear
                apply_btn = page.get_by_role("button", name=re.compile(r"^(Apply|Apply Now)$", re.IGNORECASE)).first
                apply_btn.wait_for(timeout=10000)
            except:
                # Fallback to ID or class if role fails
                apply_btn = page.locator("#apply-button, .apply-button, button:has-text('Apply')").first
                try:
                    apply_btn.wait_for(timeout=5000)
                except:
                    pass
            
            if apply_btn.is_visible():
                apply_text = apply_btn.inner_text().lower()
                if "company website" in apply_text:
                    result = "Redirect: This job requires applying on the external company website."
                else:
                    apply_btn.click(force=True)
                    try:
                        # Wait for either the success banner, or for the Apply button to change its text to "Applied"
                        page.wait_for_selector(".apply-message, .msg-text, text='Applied', text='Successfully', text='successfully'", timeout=8000)
                        result = "Success: Application submitted successfully!"
                    except:
                        result = "Partial Success: Apply button clicked, but confirmation message not detected."
            else:
                result = "Failed: Apply button not found. You may have already applied, or the layout changed."
                
            context.close()
            return result
            
        except Exception as e:
            return f"Error during auto-apply: {e}"

if __name__ == "__main__":
    # Test execution
    print("Naukri Scraper initialized.")
