import { chromium } from 'playwright';

const PORTAL_SELECTORS = {
  Naukri:     { selector: 'a.title, a[href*="job-listings"], a[href*="-jobs?"]', urlCheck: 'job-listings' },
  Instahyre:  { selector: 'a[href*="/job/"]', urlCheck: '/job/' },
  LinkedIn:   { selector: 'a.base-card__full-link, a[href*="/jobs/view/"]', urlCheck: '/jobs/view/' },
  Wellfound:  { selector: 'a[href*="/jobs/"]', urlCheck: '/jobs/' },
  Indeed:     { selector: 'a[data-jk], a[href*="/viewjob"]', urlCheck: '/viewjob' },
  TimesJobs:  { selector: 'a[href*="job-detail"], a.srp-title', urlCheck: 'job-detail' },
  Shine:      { selector: 'a[href*="/job/"], h2.job-title a', urlCheck: '/job/' },
  Hirist:     { selector: 'a[href*="/jobs/"]', urlCheck: '/jobs/' },
};

const TECH_KEYWORDS = [
  'engineer', 'developer', 'manager', 'lead', 'designer', 'architect',
  'data', 'ai', 'machine learning', 'frontend', 'backend', 'full stack',
  'react', 'node', 'python', 'software', 'tech', 'associate', 'analyst',
  'devops', 'cloud', 'mobile', 'android', 'ios', 'qa', 'sre', 'platform'
];

const NAV_NOISE = ['skip to', 'sign in', 'login', 'apply', 'register', 'sign up', 'forgot password'];

function buildSearchUrl(portal) {
  const query = portal.searchQuery || 'Software Engineer';
  const location = portal.location || 'India';

  if (portal.name.includes('Naukri')) {
    return `https://www.naukri.com/${query.replace(/ /g, '-').toLowerCase()}-jobs?k=${encodeURIComponent(query)}&l=${encodeURIComponent(location)}`;
  }
  if (portal.name.includes('Instahyre')) {
    return 'https://www.instahyre.com/search-jobs/';
  }
  if (portal.name.includes('LinkedIn')) {
    return `https://www.linkedin.com/jobs/search?keywords=${encodeURIComponent(query)}&location=${encodeURIComponent(location)}&f_TPR=r86400`;
  }
  if (portal.name.includes('Wellfound')) {
    return `https://wellfound.com/jobs?q=${encodeURIComponent(query)}&l=${encodeURIComponent(location)}`;
  }
  if (portal.name.includes('Indeed')) {
    return `https://in.indeed.com/jobs?q=${encodeURIComponent(query)}&l=${encodeURIComponent(location)}`;
  }
  if (portal.name.includes('TimesJobs')) {
    return `https://www.timesjobs.com/candidate/job-search.html?searchType=personalizedSearch&sequence=0&txtKeywords=${encodeURIComponent(query)}`;
  }
  if (portal.name.includes('Shine')) {
    return `https://www.shine.com/job-search/${query.replace(/ /g, '-').toLowerCase()}-jobs/`;
  }
  if (portal.name.includes('Hirist')) {
    return `https://www.hirist.tech/search?query=${encodeURIComponent(query)}`;
  }
  return portal.url;
}

function getSelector(portalName) {
  for (const key of Object.keys(PORTAL_SELECTORS)) {
    if (portalName.includes(key)) return PORTAL_SELECTORS[key];
  }
  return { selector: 'a', urlCheck: null };
}

export async function scanPortals(portals, logCallback) {
  const log = (msg) => {
    if (logCallback) logCallback(msg);
    else console.log(msg);
  };

  const jobs = [];
  log("Starting Playwright scanner...");

  // Non-headless mode significantly improves Cloudflare/Akamai bypass rates on Indian portals.
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    locale: 'en-IN',
    timezoneId: 'Asia/Kolkata'
  });

  for (const portal of portals) {
    log(`Scanning ${portal.name}...`);
    try {
      const page = await context.newPage();
      const searchUrl = buildSearchUrl(portal);
      const { selector, urlCheck } = getSelector(portal.name);
      const query = portal.searchQuery || 'Software Engineer';
      const searchWords = query.toLowerCase().split(' ').filter(w => w.length > 2);

      await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 25000 });
      await page.waitForTimeout(3500);

      const listings = await page.$$eval(selector, (elements) => {
        return elements
          .filter(el => el.innerText && el.innerText.trim().length > 3)
          .map(el => {
            const container = el.closest('.srp-jobtuple-wrapper, .job-card-container, .base-card, .job-tuple, .job-container, .jobTuple');
            const snippet = container ? container.innerText.trim() : el.innerText.trim();
            return { title: el.innerText.trim(), href: el.href, snippet };
          });
      });

      let portalJobs = listings.filter(job => {
        const text = job.title.toLowerCase();
        if (NAV_NOISE.some(n => text.includes(n))) return false;
        if (urlCheck && job.href.includes(urlCheck)) return true;
        return TECH_KEYWORDS.some(kw => text.includes(kw)) || searchWords.some(sw => text.includes(sw));
      });

      // Deduplicate by title
      const seen = new Set();
      portalJobs = portalJobs.filter(job => {
        const cleanTitle = job.title.split('\n')[0].trim();
        if (seen.has(cleanTitle) || cleanTitle.length < 4) return false;
        seen.add(cleanTitle);
        job.cleanTitle = cleanTitle;
        return true;
      });

      // Up to 5 real listings per portal
      portalJobs.slice(0, 5).forEach(job => {
        let company = 'Unknown Company';
        if (job.cleanTitle.includes(' at ')) {
          company = job.cleanTitle.split(' at ')[1].trim();
        } else if (job.snippet.includes('\n')) {
          const lines = job.snippet.split('\n').map(l => l.trim()).filter(l => l.length > 2);
          if (lines.length > 1 && !lines[1].toLowerCase().includes('engineer') && !lines[1].toLowerCase().includes('developer')) {
            company = lines[1];
          }
        }
        jobs.push({
          title: `${job.cleanTitle} at ${company} - ${portal.name}`,
          company,
          description: `Company: ${company}\nExtracted Snippet:\n${job.snippet.substring(0, 600)}\n\nURL: ${job.href}`,
          portal: portal.name,
          url: job.href
        });
      });

      if (portalJobs.length === 0) {
        log(`⚠️ ${portal.name}: Bot protection active or no results found. Visit manually: ${searchUrl}`);
      } else {
        log(`✅ ${portal.name}: Found ${Math.min(portalJobs.length, 5)} listings.`);
      }

      await page.close();
    } catch (error) {
      log(`❌ Failed to scan ${portal.name}: ${error.message}`);
    }
  }

  await browser.close();
  return jobs;
}
