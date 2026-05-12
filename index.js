import blessed from 'blessed';
import fs from 'fs';
import yaml from 'yaml';
import { execSync } from 'child_process';
import path from 'path';
import os from 'os';
import readline from 'readline';
import { CareerAgent } from './agent.js';
import { scanPortals } from './scan.js';
import { marked } from 'marked';
import { chromium } from 'playwright';

// Persistent profile file — gitignored, stores session between runs
const PROFILE_PATH = './user-profile.json';
const AUTO_SCAN_INTERVAL_MS = 4 * 60 * 60 * 1000; // 4 hours

// Top-level global state variables
let cv = '';
const cvPath = './cv.md';
let stateJobs = [];
let activeTab = 'eval'; // 'eval', 'resume', 'cv', 'logs'
let appLogs = [];
let isScanning = false;
let focusedPanel = 'list'; // 'list' or 'content'
let nextScanAt = null;    // Date object for next scheduled auto-scan
let autoScanTimer = null; // setInterval handle
let countdownTicker = null; // setInterval for countdown display
let agent = null;
let globalUserName = '';
let globalUserDesignation = '';
let globalTargetRole = '';
let portalsConfig = [];

// UI Components variables
let screen, header, listBox, list, rightBox, tabHeader, contentBox, statusBar;

// Helper to push internal observability logs
function pushLog(msg) {
  const timestamp = new Date().toLocaleTimeString();
  appLogs.push(`[${timestamp}] ${msg}`);
  if (appLogs.length > 200) appLogs.shift(); // keep last 200 logs
  if (screen && activeTab === 'logs') {
    updateRightPanel();
  }
}

// Helper to convert Tailored Resume Markdown to ATS-optimized PDF using Playwright Chromium
async function exportResumeToPdf(markdownContent, safeTitle) {
  pushLog(`Launching headless Chromium to convert resume to PDF...`);
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  const htmlBody = marked.parse(markdownContent);
  
  // Clean standard formatting ensuring clear top-to-bottom text streams and high readability for ATS parsing
  const fullHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        @page { margin: 20mm; size: A4; }
        body { font-family: 'Arial', sans-serif; color: #111; line-height: 1.4; font-size: 11pt; }
        h1 { font-size: 22pt; margin-bottom: 4px; color: #0f172a; text-align: center; text-transform: uppercase; letter-spacing: 1px; }
        h2 { font-size: 13pt; color: #0f172a; border-bottom: 1.5px solid #0f172a; padding-bottom: 2px; margin-top: 18px; margin-bottom: 8px; text-transform: uppercase; }
        h3 { font-size: 11.5pt; margin-top: 10px; margin-bottom: 4px; color: #1e293b; }
        p { margin-top: 0; margin-bottom: 6px; }
        ul { margin-top: 0; margin-bottom: 8px; padding-left: 20px; }
        li { margin-bottom: 4px; }
        a { color: #0284c7; text-decoration: none; }
      </style>
    </head>
    <body>
      ${htmlBody}
    </body>
    </html>
  `;
  
  await page.setContent(fullHtml, { waitUntil: 'networkidle' });
  
  const filename = `Tailored_Resume_${safeTitle}.pdf`;
  const outputPath = path.join(process.cwd(), filename);
  
  await page.pdf({
    path: outputPath,
    format: 'A4',
    printBackground: true
  });
  
  await browser.close();
  return outputPath;
}

// Setup Questionnaire Interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});
const question = (query) => new Promise((resolve) => rl.question(query, resolve));

// Save user profile to disk so onboarding is skipped on next launch
function saveProfile() {
  const profile = {
    userName: globalUserName,
    userDesignation: globalUserDesignation,
    targetRole: globalTargetRole,
    savedAt: new Date().toISOString()
  };
  fs.writeFileSync(PROFILE_PATH, JSON.stringify(profile, null, 2), 'utf8');
}

// Load existing profile from disk
function loadProfile() {
  if (fs.existsSync(PROFILE_PATH)) {
    try {
      return JSON.parse(fs.readFileSync(PROFILE_PATH, 'utf8'));
    } catch (_) {}
  }
  return null;
}

async function initSetup() {
  console.clear();
  console.log("=================================================================");
  console.log("        ⚡ AGENT-HIRE : Indian Career-Ops Initialization         ");
  console.log("=================================================================\n");

  // Load Base CV if exists
  if (fs.existsSync(cvPath)) {
    cv = fs.readFileSync(cvPath, 'utf8');
  } else {
    cv = 'Full Stack Developer with 5 years of experience in Node.js, React, and Python.';
    fs.writeFileSync(cvPath, cv);
  }

  // Check for saved profile — skip onboarding if found
  const saved = loadProfile();
  if (saved && saved.userName && saved.userDesignation && saved.targetRole) {
    globalUserName = saved.userName;
    globalUserDesignation = saved.userDesignation;
    globalTargetRole = saved.targetRole;
    console.log(`✅ Loaded saved profile for: ${globalUserName} (${globalUserDesignation})`);
    console.log(`🎯 Resuming hunt for: "${globalTargetRole}"`);
    console.log(`   Saved on: ${new Date(saved.savedAt).toLocaleString()}`);
    console.log(`\n   Press [N] inside the dashboard to change your target role.`);
  } else {
    // ── First-time onboarding ──

    // Question 1: User Name
    let userName = '';
    while (!userName.trim()) {
      userName = await question("👤 Enter your Name: ");
    }
    globalUserName = userName.trim();

    // Question 2: Designation
    let userDesig = '';
    while (!userDesig.trim()) {
      userDesig = await question("💼 Enter your Current Designation/Headline: ");
    }
    globalUserDesignation = userDesig.trim();

    // Question 3: Append to Base Resume
    console.log(`\n📄 Base Profile loaded from ./cv.md (${cv.length} characters)`);
    let customAdditions = await question("✍️  Append specific focus/skills to resume? (Leave blank to keep base CV): ");
    if (customAdditions.trim()) {
      cv += `\n\n[Additions by ${globalUserName} - ${globalUserDesignation}]: ${customAdditions.trim()}`;
      fs.writeFileSync(cvPath, cv);
      console.log("✅ Custom criteria added to ./cv.md successfully!");
    }

    // Question 4: Target Role
    console.log("\n🎯 Target Scrape Arc Pipeline Configuration");
    let targetRole = '';
    while (!targetRole.trim()) {
      targetRole = await question("🔍 Enter specific Job Role to hunt: ");
    }
    globalTargetRole = targetRole.trim();

    // Save profile for future runs
    saveProfile();
    console.log(`\n💾 Profile saved — won't ask again on next launch!`);
  }

  rl.close();

  // Gemini CLI Auth check
  console.log("\n🔐 Verifying AI cloud authentication...");
  const credPath = path.join(os.homedir(), '.gemini', 'oauth_creds.json');
  if (!process.env.GEMINI_API_KEY && !process.env.OPENAI_API_KEY && !process.env.GROQ_API_KEY && !fs.existsSync(credPath)) {
    console.log("🔑 No API key found. Initiating Gemini CLI Auth...");
    try {
      execSync('npx @google/gemini-cli auth', { stdio: 'inherit' });
      console.log("✅ Cloud agent credentials synced successfully!");
    } catch (error) {
      console.error("❌ Authentication aborted/failed. System exiting.");
      process.exit(1);
    }
  } else {
    console.log("✅ AI provider credentials verified.");
  }

  // Rewrite portals.yml dynamically so all regional portal queries match precisely
  const file = fs.readFileSync('./portals.yml', 'utf8');
  const config = yaml.parse(file);
  if (config && config.portals) {
    config.portals.forEach(p => { p.searchQuery = globalTargetRole; });
    fs.writeFileSync('./portals.yml', yaml.stringify(config));
    portalsConfig = config.portals;
    console.log(`✅ Configured live scrapers on ${config.portals.length} regional portals targeting: "${globalTargetRole}"`);
  }

  // Instantiate Cloud Agent
  agent = new CareerAgent();
  pushLog(`Session started: ${globalUserName} hunting for "${globalTargetRole}".`);

  console.log("\n🚀 Launching Master TUI Dashboard in 2 seconds...");
  await new Promise(res => setTimeout(res, 2000));

  // Invoke Main Blessed Application Loop
  startDashboard();
}


function startDashboard() {
  // Initialize UI Screen
  screen = blessed.screen({
    smartCSR: true,
    title: `Career-Ops Dashboard: ${globalUserName} - ${globalTargetRole}`
  });

  // Top Header Box
  header = blessed.box({
    parent: screen,
    top: 0,
    left: 0,
    width: '100%',
    height: 3,
    content: `{center}{bold}{cyan-fg}⚡ AGENT-HIRE{/} : Autonomous Career-Ops Interface{/bold}{/center}\n{center}{yellow-fg}User: ${globalUserName} (${globalUserDesignation}){/}  |  {green-fg}Target: ${globalTargetRole}{/}  |  {magenta-fg}Market: India{/}{/center}`,
    tags: true,
    border: { type: 'line' },
    style: {
      fg: 'white',
      bg: 'black',
      border: { fg: 'blue' }
    }
  });

  // Left Panel: Jobs Pipeline Box
  listBox = blessed.box({
    parent: screen,
    top: 3,
    left: 0,
    width: '40%',
    height: '100%-5',
    label: ' {bold}{cyan-fg}💼 Jobs Pipeline{/} ',
    tags: true,
    border: { type: 'line' },
    style: {
      border: { fg: 'cyan' } // initially focused
    }
  });

  // List inside Left Panel
  list = blessed.list({
    parent: listBox,
    top: 0,
    left: 0,
    width: '100%-2',
    height: '100%-2',
    items: ['⏳ Initializing browser & scraper...'],
    keys: true,
    vi: true,
    mouse: true,
    tags: true,
    style: {
      fg: 'white',
      bg: 'black',
      selected: {
        bg: 'blue',
        fg: 'white',
        bold: true
      }
    },
    scrollbar: {
      ch: '│',
      track: { bg: 'black' },
      style: { fg: 'cyan' }
    }
  });

  // Right Panel: Multi-Tab Interactive View
  rightBox = blessed.box({
    parent: screen,
    top: 3,
    left: '40%',
    width: '60%',
    height: '100%-5',
    label: ' {bold}{yellow-fg}📊 Workspace View{/} ',
    tags: true,
    border: { type: 'line' },
    style: {
      border: { fg: 'blue' }
    }
  });

  // Navigation / Tabs Sub-header inside Right Box
  tabHeader = blessed.box({
    parent: rightBox,
    top: 0,
    left: 0,
    width: '100%-2',
    height: 1,
    content: '',
    tags: true,
    style: {
      bg: 'black'
    }
  });

  // Scrollable main content view inside Right Box
  contentBox = blessed.box({
    parent: rightBox,
    top: 1, // below tabHeader
    left: 0,
    width: '100%-2',
    height: '100%-3',
    content: 'Welcome. Scraping live job portals in the background...\n\nPlease wait while opportunities are fetched.',
    tags: true,
    scrollable: true,
    alwaysScroll: true,
    keys: true,
    vi: true,
    mouse: true,
    style: {
      fg: 'white',
      bg: 'black'
    },
    scrollbar: {
      ch: '█',
      track: { bg: 'black' },
      style: { fg: 'cyan' }
    }
  });

  // Bottom Status Bar
  statusBar = blessed.box({
    parent: screen,
    bottom: 0,
    left: 0,
    width: '100%',
    height: 2,
    content: '',
    tags: true,
    style: { bg: 'black' }
  });

  // Update status bar with countdown
  function updateStatusBar() {
    let countdown = '';
    if (nextScanAt && !isScanning) {
      const msLeft = nextScanAt - Date.now();
      if (msLeft > 0) {
        const h = Math.floor(msLeft / 3600000);
        const m = Math.floor((msLeft % 3600000) / 60000);
        const s = Math.floor((msLeft % 60000) / 1000);
        countdown = `  {gray-fg}⏱ Next scan: ${h}h ${m}m ${s}s{/}`;
      }
    } else if (isScanning) {
      countdown = `  {yellow-fg}⚡ Scanning now...{/}`;
    }
    statusBar.setContent(
      `{center}{cyan-bg}{black-fg}{bold} Keys: {/} [←/→] Panel  [↑/↓] Nav  [Enter] Eval  [R] Resume  [P] PDF  [C] Contact  [A] Auto-Arc  [S] Scan  [N] New Role  [Q] Exit ${countdown}{/center}`
    );
    if (screen) screen.render();
  }

  // Countdown ticker — updates every second
  countdownTicker = setInterval(updateStatusBar, 1000);
  updateStatusBar();


  // Wire events & rendering
  list.on('focus', () => { focusedPanel = 'list'; listBox.style.border.fg = 'cyan'; rightBox.style.border.fg = 'blue'; screen.render(); });
  contentBox.on('focus', () => { focusedPanel = 'content'; rightBox.style.border.fg = 'yellow'; listBox.style.border.fg = 'blue'; screen.render(); });

  list.on('select item', () => {
    if (activeTab === 'eval' || activeTab === 'resume') {
      contentBox.setScroll(0);
    }
    updateRightPanel();
  });

  // Action: Evaluate Job on Enter
  list.on('select', async (item, index) => {
    if (stateJobs.length === 0 || isScanning) return;
    const job = stateJobs[index];
    if (!job) return;

    activeTab = 'eval';
    job.isEvaluating = true;
    pushLog(`Triggered evaluation for: ${job.title}`);
    updateJobList();
    updateRightPanel();

    try {
      const result = await agent.evaluateJob(job.title, job.description, cv);
      job.evalResult = result;
      pushLog(`Successfully evaluated: ${job.title}`);
    } catch (error) {
      job.evalResult = `{red-fg}Evaluation Failed:{/} ${error.message}`;
      pushLog(`Evaluation error for ${job.title}: ${error.message}`);
    } finally {
      job.isEvaluating = false;
      updateJobList();
      updateRightPanel();
      setFocusPanel('content');
    }
  });

  // Action: Tailor Resume on 'R'
  screen.key(['r', 'R'], async () => {
    if (stateJobs.length === 0 || isScanning) return;
    const index = list.selected;
    const job = stateJobs[index];
    if (!job) return;

    activeTab = 'resume';
    job.isDrafting = true;
    pushLog(`Triggered resume draft for: ${job.title}`);
    updateJobList();
    updateRightPanel();

    try {
      const result = await agent.draftTailoredResume(job.title, job.description, cv);
      job.resumeResult = result;
      pushLog(`Successfully tailored resume for: ${job.title}`);
    } catch (error) {
      job.resumeResult = `{red-fg}Resume Tailoring Failed:{/} ${error.message}`;
      pushLog(`Resume draft error for ${job.title}: ${error.message}`);
    } finally {
      job.isDrafting = false;
      updateJobList();
      updateRightPanel();
      setFocusPanel('content');
    }
  });

  // Action: Export Tailored Resume to ATS-Optimized PDF on 'P'
  screen.key(['p', 'P'], async () => {
    if (stateJobs.length === 0 || isScanning) return;
    const index = list.selected;
    const job = stateJobs[index];
    if (!job) return;

    if (!job.resumeResult || job.isDrafting) {
      activeTab = 'resume';
      contentBox.setContent(`{bold}{yellow-fg}⚠️ No Tailored Resume Found{/}\n\nPlease draft a Tailored Resume first for {bold}${job.title}{/} by pressing {bold}[R]{/} before exporting to PDF.`);
      setFocusPanel('content');
      return;
    }

    activeTab = 'resume';
    job.isExportingPdf = true;
    updateRightPanel();
    pushLog(`Triggered PDF conversion for: ${job.title}`);

    try {
      const safeTitle = job.title.split(' - ')[0].replace(/[^a-zA-Z0-9]/g, '_').replace(/_+/g, '_');
      const pdfPath = await exportResumeToPdf(job.resumeResult, safeTitle);
      job.lastPdfPath = pdfPath;
      pushLog(`Successfully saved ATS-optimized PDF to: ${pdfPath}`);
    } catch (error) {
      pushLog(`PDF conversion failed for ${job.title}: ${error.message}`);
      job.pdfError = error.message;
    } finally {
      job.isExportingPdf = false;
      updateRightPanel();
      setFocusPanel('content');
    }
  });

  // Action: Discover Contacts & Draft Cold Outreach Email on 'C'
  screen.key(['c', 'C'], async () => {
    if (stateJobs.length === 0 || isScanning) return;
    const index = list.selected;
    const job = stateJobs[index];
    if (!job) return;

    const companyName = job.company || (job.title.includes(' at ') ? job.title.split(' at ')[1].split(' - ')[0].trim() : job.title.split(' - ')[1]?.replace(/\(.*?\)/g, '').trim() || "Razorpay");
    
    job.isDiscovering = true;
    updateRightPanel();
    pushLog(`Discovering regional hiring managers/POCs for: ${companyName}`);

    try {
      const contact = await agent.discoverContacts(companyName);
      job.contact = contact;
      pushLog(`Resolved POC for ${companyName}: ${contact.email}`);
      
      job.isDiscovering = false;
      job.isDraftingEmail = true;
      updateRightPanel();
      pushLog(`Drafting cold email using Gemini CLI for ${contact.name}...`);
      
      const emailStr = await agent.draftColdEmail(job.title, companyName, job.description, cv, contact.name);
      job.coldEmail = emailStr;
      pushLog(`Successfully drafted outreach email.`);
      
      const dispatchInfo = await agent.sendOutreachEmail(contact.email, `Direct Application: ${job.title}`, emailStr, job.lastPdfPath);
      job.outreachStatus = dispatchInfo;
      pushLog(`Dispatched email payload via: ${dispatchInfo.method}`);
    } catch (error) {
      pushLog(`Contact discovery/email pipeline failed: ${error.message}`);
    } finally {
      job.isDiscovering = false;
      job.isDraftingEmail = false;
      updateJobList();
      updateRightPanel();
      setFocusPanel('content');
    }
  });

  // Action: Full End-to-End Autonomous Arc on 'A'
  screen.key(['a', 'A'], async () => {
    if (stateJobs.length === 0 || isScanning) return;
    const index = list.selected;
    const job = stateJobs[index];
    if (!job) return;

    const companyName = job.company || (job.title.includes(' at ') ? job.title.split(' at ')[1].split(' - ')[0].trim() : job.title.split(' - ')[1]?.replace(/\(.*?\)/g, '').trim() || "Razorpay");
    const safeTitle = job.title.split(' - ')[0].replace(/[^a-zA-Z0-9]/g, '_').replace(/_+/g, '_');

    job.isAutoPiloting = true;
    pushLog(`🚀 Triggered Full Autonomous Arc for: ${job.title}`);
    
    try {
      // 1. Evaluate
      activeTab = 'eval';
      job.isEvaluating = true;
      updateRightPanel();
      if (!job.evalResult) {
        job.evalResult = await agent.evaluateJob(job.title, job.description, cv);
        pushLog(`Completed evaluation.`);
      }
      job.isEvaluating = false;

      // 2. Tailor Resume
      activeTab = 'resume';
      job.isDrafting = true;
      updateRightPanel();
      if (!job.resumeResult) {
        job.resumeResult = await agent.draftTailoredResume(job.title, job.description, cv);
        pushLog(`Completed resume tailoring.`);
      }
      job.isDrafting = false;

      // 3. Export PDF
      job.isExportingPdf = true;
      updateRightPanel();
      if (!job.lastPdfPath && job.resumeResult) {
        job.lastPdfPath = await exportResumeToPdf(job.resumeResult, safeTitle);
        pushLog(`Generated ATS-Optimized PDF.`);
      }
      job.isExportingPdf = false;

      // 4. Discover Contact & Email Outreach
      job.isDiscovering = true;
      updateRightPanel();
      if (!job.contact) {
        job.contact = await agent.discoverContacts(companyName);
        pushLog(`Discovered POC: ${job.contact.email}`);
      }
      job.isDiscovering = false;

      job.isDraftingEmail = true;
      updateRightPanel();
      if (!job.coldEmail) {
        job.coldEmail = await agent.draftColdEmail(job.title, companyName, job.description, cv, job.contact.name);
        pushLog(`Drafted highly convertible regional outreach email.`);
      }
      job.isDraftingEmail = false;

      // 5. Spool/Dispatch
      const dispatchInfo = await agent.sendOutreachEmail(job.contact.email, `Engineering Application: ${job.title}`, job.coldEmail, job.lastPdfPath);
      job.outreachStatus = dispatchInfo;
      pushLog(`Arc Complete. Dispatched payload via: ${dispatchInfo.method}`);

    } catch (error) {
      pushLog(`Autonomous Arc interrupted: ${error.message}`);
    } finally {
      job.isEvaluating = false;
      job.isDrafting = false;
      job.isExportingPdf = false;
      job.isDiscovering = false;
      job.isDraftingEmail = false;
      job.isAutoPiloting = false;
      updateJobList();
      updateRightPanel();
      setFocusPanel('content');
    }
  });

  // Focus navigation & switching
  screen.key(['tab'], () => { setFocusPanel(focusedPanel === 'list' ? 'content' : 'list'); });
  screen.key(['left'], () => { setFocusPanel('list'); });
  screen.key(['right'], () => { setFocusPanel('content'); });

  screen.key(['up', 'k'], () => {
    if (focusedPanel === 'content') { contentBox.scroll(-1); screen.render(); }
    else { list.up(1); screen.render(); }
  });

  screen.key(['down', 'j'], () => {
    if (focusedPanel === 'content') { contentBox.scroll(1); screen.render(); }
    else { list.down(1); screen.render(); }
  });

  // Hotkeys for tab mapping
  screen.key(['1'], () => { activeTab = 'eval'; contentBox.setScroll(0); updateRightPanel(); setFocusPanel('content'); });
  screen.key(['2'], () => { activeTab = 'resume'; contentBox.setScroll(0); updateRightPanel(); setFocusPanel('content'); });
  screen.key(['3'], () => { activeTab = 'cv'; contentBox.setScroll(0); updateRightPanel(); setFocusPanel('content'); });
  screen.key(['4'], () => { activeTab = 'logs'; updateRightPanel(); setFocusPanel('content'); });

  screen.key(['s', 'S'], () => { if (!isScanning) startBackgroundScan(); });

  // [N] hotkey: change target role on-the-fly without restarting
  screen.key(['n', 'N'], () => {
    // Show an inline prompt box to change the role
    const promptBox = blessed.prompt({
      parent: screen,
      top: 'center',
      left: 'center',
      width: '60%',
      height: 7,
      label: ' {bold}{cyan-fg}🎯 Change Target Job Role{/} ',
      tags: true,
      border: { type: 'line' },
      style: { border: { fg: 'cyan' }, fg: 'white', bg: 'black' }
    });
    promptBox.input('Enter new Job Role to hunt:', '', async (err, newRole) => {
      if (!err && newRole && newRole.trim()) {
        globalTargetRole = newRole.trim();
        // Update portals.yml
        try {
          const file = fs.readFileSync('./portals.yml', 'utf8');
          const config = yaml.parse(file);
          if (config && config.portals) {
            config.portals.forEach(p => { p.searchQuery = globalTargetRole; });
            fs.writeFileSync('./portals.yml', yaml.stringify(config));
            portalsConfig = config.portals;
          }
        } catch (_) {}
        // Save updated profile
        saveProfile();
        // Update header
        header.setContent(`{center}{bold}{cyan-fg}⚡ AGENT-HIRE{/} : Autonomous Career-Ops Interface{/bold}{/center}\n{center}{yellow-fg}User: ${globalUserName} (${globalUserDesignation}){/}  |  {green-fg}Target: ${globalTargetRole}{/}  |  {magenta-fg}Market: India{/}{/center}`);
        pushLog(`Target role changed to: "${globalTargetRole}". Triggering fresh scan...`);
        stateJobs = [];
        updateJobList();
        startBackgroundScan();
      }
      promptBox.destroy();
      setFocusPanel(focusedPanel);
    });
    screen.render();
  });

  screen.key(['pageup', 'S-up'], () => { contentBox.scroll(-3); screen.render(); });
  screen.key(['pagedown', 'S-down'], () => { contentBox.scroll(3); screen.render(); });

  screen.key(['escape', 'q', 'C-c'], () => { return process.exit(0); });

  // Present Initial Screen State
  setFocusPanel('list');
  startBackgroundScan();
}

function formatJobTitle(job) {
  let prefix = ' ';
  if (job.evalResult && job.resumeResult && job.coldEmail) prefix = '★✍✉ ';
  else if (job.evalResult && job.resumeResult) prefix = '★✍ ';
  else if (job.evalResult) prefix = '★ ';
  else if (job.resumeResult) prefix = '✍ ';
  else if (job.coldEmail) prefix = '✉ ';
  
  let pTag = '{white-fg}';
  if (job.portal.includes('Naukri')) pTag = '{cyan-fg}';
  else if (job.portal.includes('LinkedIn')) pTag = '{blue-fg}';
  else if (job.portal.includes('Instahyre')) pTag = '{magenta-fg}';
  else if (job.portal.includes('Wellfound')) pTag = '{yellow-fg}';
  
  return `${prefix}${pTag}[${job.portal}]{/} ${job.title.split(' - ')[0]}`;
}

function updateJobList() {
  if (!list) return;
  if (stateJobs.length === 0) {
    if (isScanning) list.setItems([`⏳ Hunting regional feeds for: "${globalTargetRole}"...`]);
    else list.setItems(['⚠️ No jobs available. Press [S] to scan.']);
  } else {
    const items = stateJobs.map(j => formatJobTitle(j));
    list.setItems(items);
  }
  if (screen) screen.render();
}

function updateRightPanel() {
  if (!tabHeader || !rightBox || !contentBox) return;

  const t1 = activeTab === 'eval' ? '{cyan-bg}{black-fg}{bold} [1] Evaluation ★ {/}' : ' [1] Evaluation ';
  const t2 = activeTab === 'resume' ? '{cyan-bg}{black-fg}{bold} [2] Tailored Resume ✍ {/}' : ' [2] Tailored Resume ';
  const t3 = activeTab === 'cv' ? '{cyan-bg}{black-fg}{bold} [3] Base CV {/}' : ' [3] Base CV ';
  const t4 = activeTab === 'logs' ? '{cyan-bg}{black-fg}{bold} [4] Logs 🔍 {/}' : ' [4] Logs ';
  
  tabHeader.setContent(`${t1}│${t2}│${t3}│${t4}`);
  
  let labelStr = ' Workspace View ';
  if (activeTab === 'eval') labelStr = ' {bold}{yellow-fg}★ Job Gap-Analysis & Agent Rating{/} ';
  else if (activeTab === 'resume') labelStr = ' {bold}{green-fg}✍ Tailored Markdown Resume{/} ';
  else if (activeTab === 'cv') labelStr = ` {bold}{cyan-fg}📄 Base Profile: ${globalUserName} (${globalUserDesignation}){/} `;
  else if (activeTab === 'logs') labelStr = ' {bold}{magenta-fg}🔍 Real-Time Scraper & Agent Logs{/} ';
  rightBox.setLabel(labelStr);

  const idx = list ? list.selected : 0;
  const job = stateJobs[idx];

  if (activeTab === 'cv') {
    contentBox.setContent(`{bold}{cyan-fg}=== User Base CV / Profile Document ==={/}\n{gray-fg}Loaded from ./cv.md{/}\n\n${cv}`);
  } else if (activeTab === 'logs') {
    contentBox.setContent(`{bold}{magenta-fg}=== Real-Time Observability & System Logs ==={/}\n{gray-fg}Displays setup info, Cloudflare bypass outputs, and local DIARIES task caching updates.{/}\n\n` + appLogs.join('\n'));
    contentBox.setScroll(contentBox.getScrollHeight());
  } else if (!job) {
    if (isScanning) {
      contentBox.setContent(`{center}\n\n\n{cyan-fg}🚀 Launching target Web Browsers...{/}\nAggregating regional job portals specifically matching:\n{bold}"${globalTargetRole}"{/}\n\nCheck {bold}[4] Logs{/} tab for immediate updates.{/center}`);
    } else {
      contentBox.setContent('{center}\n\n\nNo job selected. Press {bold}[S]{/} to scan portals.{/center}');
    }
  } else {
    let extraOutreachStr = '';
    if (job.isAutoPiloting || job.isDiscovering || job.isDraftingEmail) {
      extraOutreachStr += `\n{inverse}{bold}{magenta-fg} ⚙ Autonomous Outreach Arc Active... {/}\n`;
      if (job.isAutoPiloting) extraOutreachStr += `{yellow-fg}Orchestrating Complete Flow: Eval -> Resume -> PDF -> Contact Deduce -> Spool Outreach...{/}\n`;
      if (job.isDiscovering) extraOutreachStr += `{magenta-fg}Discovering regional hiring managers & constructing intelligent deep-search targets...{/}\n`;
      if (job.isDraftingEmail) extraOutreachStr += `{yellow-fg}✍ Crafting hyper-personalized regional cold email focused on technical scale...{/}\n`;
      extraOutreachStr += `\n`;
    } else {
      if (job.contact) {
        extraOutreachStr += `\n{bold}{magenta-fg}🎯 Discovered Indian Hiring Target / POC:{/}\n`;
        extraOutreachStr += `{magenta-fg}Name:{/} ${job.contact.name}  |  {magenta-fg}Email:{/} {underline}${job.contact.email}{/}\n`;
        extraOutreachStr += `{magenta-fg}Resolution Engine:{/} ${job.contact.discoveryMethod}\n`;
        extraOutreachStr += `{magenta-fg}Smart Deep-Search Dork:{/} {underline}${job.contact.queryUrl}{/}\n`;
      }
      if (job.coldEmail) {
        extraOutreachStr += `\n{bold}{yellow-fg}✉ Regional Cold Outreach Cover Letter:{/}\n`;
        if (job.outreachStatus) {
          extraOutreachStr += `{inverse}{bold}{green-fg} ✓ Outreach Payload Spooled: ${job.outreachStatus.method} {/}\n{green-fg}Output Spool:{/} ${job.outreachStatus.path || job.outreachStatus.messageId}\n`;
        }
        extraOutreachStr += `\n${job.coldEmail}\n`;
      }
      extraOutreachStr += `\n{green-fg}💡 Tip: Press [C] to resolve contacts & draft email independently, or press [A] for complete Auto-Pilot workflow.{/green-fg}\n`;
    }

    if (activeTab === 'eval') {
      let content = `{bold}{cyan-fg}Opportunity:{/} ${job.title}\n{cyan-fg}Portal Link:{/} {underline}${job.url}{/}\n\n`;
      
      if (job.isEvaluating) {
        content += `{yellow-fg}⚡ Agent is evaluating role alignment for ${globalUserName} via Gemini CLI...{/yellow-fg}\nQuerying local Agent Diaries memory cache...\n\n`;
      } else if (job.evalResult) {
        content += `{bold}{yellow-fg}=== Agent Evaluation Result ==={/}\n\n${job.evalResult}\n`;
      } else {
        content += `{gray-fg}Status: Not evaluated yet. Press {bold}[Enter]{/} to launch Gemini Agent evaluation.{/}\n\n`;
      }
      
      content += extraOutreachStr;
      content += `\n{bold}{gray-fg}--- Extracted Listing Details ---{/}\n${job.description}`;
      contentBox.setContent(content);
      
    } else if (activeTab === 'resume') {
      let content = `{bold}{cyan-fg}Tailored Resume Target:{/} ${job.title}\n\n`;
      
      if (job.isDrafting) {
        content += `{cyan-fg}✍ Agent is crafting custom tailored resume using Gemini CLI...{/cyan-fg}\nAligning user experiences with required skills...\nThis process takes 15-30 seconds. Please wait...`;
      } else if (job.resumeResult) {
        if (job.isExportingPdf) {
          content += `{inverse}{bold}{yellow-fg} ⚙ Converting Markdown to ATS-Optimized PDF... {/}\n{cyan-fg}Rendering standard fonts & typography via headless Playwright engine...{/}\n\n`;
        } else if (job.lastPdfPath) {
          content += `{inverse}{bold}{green-fg} ✓ Successfully Exported ATS-Optimized PDF! {/}\n{green-fg}Saved to:{/} {underline}${job.lastPdfPath}{/}\n\n`;
        } else if (job.pdfError) {
          content += `{inverse}{bold}{red-fg} ❌ PDF Export Failed {/}\n{red-fg}Error:{/} ${job.pdfError}\n\n`;
        } else {
          content += `{green-fg}💡 Tip: Press [P] to export this tailored resume into an ATS-optimized, fully parseable PDF document.{/green-fg}\n\n`;
        }
        
        content += extraOutreachStr;
        content += `{bold}{green-fg}=== Optimized Markdown Resume ==={/}\n\n${job.resumeResult}`;
      } else {
        content += `{gray-fg}No tailored resume drafted for this role yet.{/}\n\nPress {bold}[R]{/} to trigger AI resume tailoring based on your profile context.`;
      }
      contentBox.setContent(content);
    }
  }
  
  if (screen) screen.render();
}

function setFocusPanel(panel) {
  focusedPanel = panel;
  if (!listBox || !rightBox || !list || !contentBox) return;

  if (panel === 'list') {
    listBox.style.border.fg = 'cyan';
    rightBox.style.border.fg = 'blue';
    list.focus();
  } else {
    listBox.style.border.fg = 'blue';
    rightBox.style.border.fg = 'yellow';
    contentBox.focus();
  }
  if (screen) screen.render();
}

// Background Scan Executor
async function startBackgroundScan() {
  if (isScanning) return;
  isScanning = true;
  pushLog(`Initiating regional web scrapers matching target: "${globalTargetRole}"...`);
  updateJobList();
  updateRightPanel();

  try {
    const jobs = await scanPortals(portalsConfig, (logMsg) => {
      pushLog(`[Scraper] ${logMsg}`);
    });
    stateJobs = jobs;
    pushLog(`Scraping complete. Retrieved ${jobs.length} unique matched opportunities.`);
  } catch (error) {
    pushLog(`Scraping loop error: ${error.message}`);
  } finally {
    isScanning = false;
    // Schedule next automatic scan
    nextScanAt = new Date(Date.now() + AUTO_SCAN_INTERVAL_MS);
    pushLog(`Next automatic scan scheduled at: ${nextScanAt.toLocaleTimeString()}`);

    // Clear old timer and set fresh one
    if (autoScanTimer) clearTimeout(autoScanTimer);
    autoScanTimer = setTimeout(() => {
      pushLog('⏰ 4-hour auto-scan interval triggered. Refreshing job feeds...');
      startBackgroundScan();
    }, AUTO_SCAN_INTERVAL_MS);

    updateJobList();
    if (list && stateJobs.length > 0) { list.select(0); }
    updateRightPanel();
    setFocusPanel('list');
  }
}

// Call start sequence explicitly
initSetup();

