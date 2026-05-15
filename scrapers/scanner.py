import os
import yaml
import time
from playwright.sync_api import sync_playwright

def load_profile():
    with open(os.path.join("config", "profile.yml"), "r") as f:
        return yaml.safe_load(f)

def scan_naukri(role: str, location: str):
    """Searches Naukri for the given role and location and returns basic job listings."""
    # Convert spaces to hyphens for URL: software-engineer-jobs-in-bangalore
    role_url = role.lower().replace(" ", "-")
    loc_url = location.lower().replace(" ", "-")
    url = f"https://www.naukri.com/{role_url}-jobs-in-{loc_url}"
    
    jobs = []
    try:
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
                
            page.goto(url, wait_until="domcontentloaded", timeout=30000)
            
            # Wait for job cards to load
            page.wait_for_selector(".srp-jobtuple-wrapper", timeout=15000)
            
            job_cards = page.locator(".srp-jobtuple-wrapper").all()
            for card in job_cards[:5]:  # Limit to top 5 for speed
                try:
                    title_elem = card.locator(".title")
                    title = title_elem.inner_text().strip()
                    job_url = title_elem.get_attribute("href")
                    
                    company = card.locator(".comp-name").inner_text().strip()
                    loc = card.locator(".locWdth").inner_text().strip()
                    
                    jobs.append({
                        "portal": "Naukri",
                        "title": title,
                        "company": company,
                        "location": loc,
                        "url": job_url,
                        "match_score": "Pending"
                    })
                except Exception as e:
                    continue
            if 'context' in locals():
                context.close()
    except Exception as e:
        print(f"Naukri scan failed: {e}")
    return jobs

def scan_instahyre(role: str):
    """Searches Instahyre (location is usually global or handled by their internal search)."""
    # Instahyre's main search page
    url = f"https://www.instahyre.com/search-jobs/"
    
    jobs = []
    try:
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
                
            page.goto(url, wait_until="domcontentloaded", timeout=30000)
            
            page.wait_for_selector(".employer-block", timeout=15000)
            
            job_cards = page.locator(".employer-block").all()
            for card in job_cards[:5]:
                try:
                    title_elem = card.locator(".employer-job-name")
                    title = title_elem.inner_text().strip()
                    
                    # Instahyre links usually wrap the card or are in a specific button
                    link_elem = card.locator("a[href*='/job/']")
                    job_url = "https://www.instahyre.com" + link_elem.first.get_attribute("href") if link_elem.count() > 0 else ""
                    
                    company = card.locator(".employer-notes").first.inner_text().strip()
                    loc = card.locator(".employer-locations").inner_text().strip()
                    
                    jobs.append({
                        "portal": "Instahyre",
                        "title": title,
                        "company": company,
                        "location": loc,
                        "url": job_url,
                        "match_score": "Pending"
                    })
                except Exception as e:
                    continue
            if 'context' in locals():
                context.close()
    except Exception as e:
        print(f"Instahyre scan failed: {e}")
    return jobs

def run_full_scan(query: str = None):
    if query:
        # Simple extraction: if " in " is typed, split into role and location
        if " in " in query.lower():
            parts = query.lower().split(" in ", 1)
            role = parts[0].strip()
            loc = parts[1].strip()
        else:
            role = query.strip()
            loc = "India" # default to India if no location specified
    else:
        profile = load_profile()
        roles = profile.get("target_roles", ["Software Engineer"])
        locations = profile.get("target_locations", ["Bangalore"])
        role = roles[0]
        loc = locations[0]
    
    all_jobs = []
    all_jobs.extend(scan_naukri(role, loc))
    
    # Instahyre usually has an internal search, we just pass the role
    all_jobs.extend(scan_instahyre(role))
    
    return all_jobs
