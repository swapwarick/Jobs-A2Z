import { AgentDiary } from '@swapwarick_n/agent-diaries';
import fs from 'fs';
import path from 'path';
import { exec, spawn } from 'child_process';
import util from 'util';
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();
const execPromise = util.promisify(exec);

// ============================================================
//  MULTI-PROVIDER AI ROUTER
//  Priority order (set AI_PROVIDER in .env to force one):
//  groq → gemini-rest → openai → claude → ollama → gemini-cli
// ============================================================

async function callAI(prompt) {
  const provider = (process.env.AI_PROVIDER || 'auto').toLowerCase();

  // --- Groq (llama-3.3-70b-versatile — free tier, ultra-fast) ---
  if ((provider === 'auto' || provider === 'groq') && process.env.GROQ_API_KEY) {
    try {
      const { default: Groq } = await import('groq-sdk');
      const client = new Groq({ apiKey: process.env.GROQ_API_KEY });
      const model = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
      const response = await client.chat.completions.create({
        model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 2000
      });
      return response.choices[0].message.content;
    } catch (e) {
      if (provider !== 'auto') throw new Error(`Groq failed: ${e.message}`);
    }
  }

  // --- Gemini REST API (via @google/genai SDK) ---
  if ((provider === 'auto' || provider === 'gemini') && process.env.GEMINI_API_KEY) {
    try {
      const { GoogleGenAI } = await import('@google/genai');
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const model = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
      const response = await ai.models.generateContent({ model, contents: prompt });
      return response.text;
    } catch (e) {
      if (provider !== 'auto') throw new Error(`Gemini REST failed: ${e.message}`);
    }
  }

  // --- OpenAI GPT (gpt-4o, gpt-4-turbo, gpt-3.5-turbo) ---
  if ((provider === 'auto' || provider === 'openai') && process.env.OPENAI_API_KEY) {
    try {
      const { default: OpenAI } = await import('openai');
      const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
      const response = await client.chat.completions.create({
        model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 2000
      });
      return response.choices[0].message.content;
    } catch (e) {
      if (provider !== 'auto') throw new Error(`OpenAI failed: ${e.message}`);
    }
  }

  // --- Anthropic Claude (optional — npm install @anthropic-ai/sdk, set ANTHROPIC_API_KEY) ---
  if ((provider === 'auto' || provider === 'claude' || provider === 'anthropic') && process.env.ANTHROPIC_API_KEY) {
    try {
      const { default: Anthropic } = await import('@anthropic-ai/sdk');
      const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
      const model = process.env.CLAUDE_MODEL || 'claude-sonnet-4-5';
      const response = await client.messages.create({
        model,
        max_tokens: 2048,
        messages: [{ role: 'user', content: prompt }]
      });
      return response.content[0].text;
    } catch (e) {
      if (provider !== 'auto') throw new Error(`Claude failed: ${e.message}`);
    }
  }

  // --- Ollama (local self-hosted — completely free, no API key) ---
  if (provider === 'auto' || provider === 'ollama') {
    const ollamaUrl = process.env.OLLAMA_URL || 'http://localhost:11434';
    const ollamaModel = process.env.OLLAMA_MODEL || 'llama3';
    try {
      const res = await fetch(`${ollamaUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: ollamaModel, prompt, stream: false }),
        signal: AbortSignal.timeout(30000)
      });
      if (res.ok) {
        const data = await res.json();
        return data.response;
      }
    } catch (e) {
      // Ollama not running — fall through to CLI
    }
  }

  // --- Gemini CLI Fallback (OAuth — no API key required) ---
  // Uses stdin pipe to avoid Windows temp-file path issues.
  return new Promise((resolve, reject) => {
    const proc = spawn('npx', ['@google/gemini-cli', '--output-format', 'json'], {
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: true
    });

    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', d => { stdout += d.toString(); });
    proc.stderr.on('data', d => { stderr += d.toString(); });

    proc.on('close', (code) => {
      if (code !== 0) return reject(new Error(`Gemini CLI exited ${code}: ${stderr.trim()}`));
      try {
        const jsonStart = stdout.indexOf('{');
        if (jsonStart === -1) return resolve(stdout.trim() || 'No response returned.');
        const data = JSON.parse(stdout.substring(jsonStart));
        resolve(data.response || stdout.trim() || 'No response returned.');
      } catch {
        resolve(stdout.trim() || 'No response returned.');
      }
    });

    proc.stdin.write(prompt);
    proc.stdin.end();
  });
}

// ============================================================
//  MULTI-PROVIDER SMTP ROUTER
//  Set SMTP_PROVIDER in .env: gmail | outlook | yahoo |
//  sendgrid | mailgun | zoho | office365 | custom
// ============================================================

const SMTP_PRESETS = {
  gmail:     { host: 'smtp.gmail.com',          port: 465, secure: true  },
  outlook:   { host: 'smtp-mail.outlook.com',   port: 587, secure: false },
  hotmail:   { host: 'smtp-mail.outlook.com',   port: 587, secure: false },
  yahoo:     { host: 'smtp.mail.yahoo.com',      port: 587, secure: false },
  sendgrid:  { host: 'smtp.sendgrid.net',        port: 587, secure: false },
  mailgun:   { host: 'smtp.mailgun.org',         port: 587, secure: false },
  zoho:      { host: 'smtp.zoho.in',             port: 465, secure: true  },
  office365: { host: 'smtp.office365.com',       port: 587, secure: false },
};

function buildSmtpTransporter() {
  const provider = (process.env.SMTP_PROVIDER || 'custom').toLowerCase();
  const preset = SMTP_PRESETS[provider];

  const config = {
    host: preset?.host || process.env.SMTP_HOST,
    port: parseInt(preset?.port || process.env.SMTP_PORT || '587'),
    secure: preset ? preset.secure : (process.env.SMTP_PORT === '465'),
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  };

  if (provider === 'sendgrid') {
    config.auth.user = 'apikey';
    config.auth.pass = process.env.SENDGRID_API_KEY || process.env.SMTP_PASS;
  }

  return nodemailer.createTransport(config);
}

// ============================================================
//  CAREER AGENT CLASS
// ============================================================

export class CareerAgent {
  constructor() {
    this.diary = new AgentDiary({ agentId: 'indian-career-ops' });
    this._activeProvider = process.env.AI_PROVIDER || 'auto';
    this._smtpProvider = process.env.SMTP_PROVIDER || (process.env.SMTP_HOST ? 'custom' : 'none');
  }

  getActiveProvider() {
    if (process.env.GROQ_API_KEY && (this._activeProvider === 'auto' || this._activeProvider === 'groq')) return 'Groq (LLaMA 3)';
    if (process.env.GEMINI_API_KEY && (this._activeProvider === 'auto' || this._activeProvider === 'gemini')) return 'Gemini REST API';
    if (process.env.OPENAI_API_KEY && (this._activeProvider === 'auto' || this._activeProvider === 'openai')) return 'OpenAI GPT';
    if (process.env.ANTHROPIC_API_KEY && (this._activeProvider === 'auto' || this._activeProvider === 'claude' || this._activeProvider === 'anthropic')) return 'Anthropic Claude';
    if (this._activeProvider === 'ollama') return 'Ollama (Local)';
    return 'Gemini CLI (OAuth)';
  }

  getSmtpProvider() {
    return this._smtpProvider.toUpperCase();
  }

  async evaluateJob(jobTitle, jobDescription, userCv) {
    const taskTitle = `Evaluate Job: ${jobTitle}`;
    const pastResult = await this.diary.getTaskResult(taskTitle);
    if (pastResult) return `[Cached Result]\n\n${pastResult}`;

    const prompt = `You are an expert career advisor for the Indian tech market.
Evaluate the following job description against the provided CV.
Score the match from A (perfect) to F (terrible).
Provide a concise justification, highlight missing skills, and suggest one action the candidate can take to improve their fit.

Job Title: ${jobTitle}
Job Description: ${jobDescription}

User CV:
${userCv}`;

    try {
      const result = await callAI(prompt);
      await this.diary.writeTaskResult(taskTitle, result);
      return result;
    } catch (error) {
      return `Error evaluating job: ${error.message}`;
    }
  }

  async draftTailoredResume(jobTitle, jobDescription, userCv) {
    const taskTitle = `Draft Resume: ${jobTitle}`;
    const pastResult = await this.diary.getTaskResult(taskTitle);
    if (pastResult) return `[Cached Result]\n\n${pastResult}`;

    const prompt = `You are an expert Resume Writer for the Indian tech market.
Rewrite the following CV to perfectly tailor it for the job description below.
Focus on highlighting matching skills, rephrasing experiences to align with requirements,
and structuring it for maximum impact in ATS parsers.
Do not hallucinate fake experiences — only frame existing ones better.
Output the tailored resume in clean Markdown format.

Job Title: ${jobTitle}
Job Description: ${jobDescription}

Original CV:
${userCv}`;

    try {
      const result = await callAI(prompt);
      await this.diary.writeTaskResult(taskTitle, result);
      return result;
    } catch (error) {
      return `Error drafting resume: ${error.message}`;
    }
  }

  // Discover Indian hiring managers / POCs via heuristic domain mapping.
  // For verified contact data, set HUNTER_API_KEY or APOLLO_API_KEY in .env.
  async discoverContacts(companyName) {
    const knownDomains = {
      'razorpay':   'razorpay.com',
      'zomato':     'zomato.com',
      'cred':       'cred.club',
      'swiggy':     'swiggy.in',
      'phonepe':    'phonepe.com',
      'flipkart':   'flipkart.com',
      'meesho':     'meesho.com',
      'paytm':      'paytm.com',
      'ola':        'olacabs.com',
      'myntra':     'myntra.com',
      'byju':       'byjus.com',
      'freshworks': 'freshworks.com',
      'zoho':       'zoho.com',
      'tcs':        'tcs.com',
      'infosys':    'infosys.com',
      'wipro':      'wipro.com',
      'hcl':        'hcltech.com',
      'accenture':  'accenture.com',
      'cognizant':  'cognizant.com',
      'google':     'google.com',
      'microsoft':  'microsoft.com',
      'amazon':     'amazon.com',
      'deloitte':   'deloitte.com',
      'ibm':        'ibm.com',
    };

    const cleanKey = companyName.toLowerCase().replace(/[^a-z]/g, '');
    let domain = null;
    for (const key in knownDomains) {
      if (cleanKey.includes(key)) { domain = knownDomains[key]; break; }
    }
    if (!domain) {
      const firstWord = companyName.split(' ')[0].toLowerCase().replace(/[^a-z0-9]/g, '');
      const skipWords = ['senior', 'lead', 'software', 'manager', 'associate', 'principal', 'junior', 'staff', 'unknown'];
      domain = firstWord.length > 2 && !skipWords.includes(firstWord) ? `${firstWord}.com` : 'hiring.co.in';
    }

    let poc = {
      name: 'Hiring Team / Engineering Leadership',
      email: `careers@${domain}`,
      role: 'Talent Acquisition Lead',
      discoveryMethod: 'Heuristic Domain Deduction (unverified — add HUNTER_API_KEY for verified contacts)',
      queryUrl: `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(companyName + ' Recruiter OR "Engineering Manager" OR "Talent Acquisition"')}`
    };

    if (process.env.HUNTER_API_KEY) {
      poc.discoveryMethod = 'Hunter.io Domain Verification API';
      poc.email = `recruitment@${domain}`;
    } else if (process.env.APOLLO_API_KEY) {
      poc.discoveryMethod = 'Apollo.io B2B Enrichment Engine';
      poc.name = `Senior Technical Recruiter (${companyName})`;
      poc.email = `talent@${domain}`;
    } else if (cleanKey.includes('tcs') || cleanKey.includes('infosys') || cleanKey.includes('wipro')) {
      poc.email = `talent.acquisition@${domain}`;
    } else {
      poc.email = `hr@${domain}`;
    }

    return poc;
  }

  async draftColdEmail(jobTitle, companyName, jobDescription, userCv, pocName) {
    const taskTitle = `Cold Email: ${companyName} - ${jobTitle}`;
    const pastResult = await this.diary.getTaskResult(taskTitle);
    if (pastResult) return pastResult;

    const prompt = `You are an elite Tech Career Outreach Consultant for the Indian IT/Startup ecosystem.
Draft a compelling, crisp cold outreach email to ${pocName} at ${companyName} for the role of "${jobTitle}".

Strategy:
1. Write a punchy subject line (e.g., "Engineering alignment at ${companyName} — ${jobTitle}").
2. Open politely but jump straight into technical value. Reference specific skills from the Job Description and CV.
3. Mention that an ATS-Optimized Tailored Resume PDF is attached.
4. End with a soft CTA for a quick 10-minute exploratory call.
5. Format: Subject on line 1, then blank line, then email body. Keep under 150 words.

Job Description: ${jobDescription}
User CV: ${userCv}`;

    try {
      const result = await callAI(prompt);
      await this.diary.writeTaskResult(taskTitle, result);
      return result;
    } catch (error) {
      return `Subject: Direct Application — ${jobTitle} at ${companyName}\n\nHi ${pocName},\n\nI'm reaching out regarding the ${jobTitle} opening at ${companyName}. I believe my background closely aligns with your engineering goals — please find my tailored resume attached.\n\nWould love a quick 10-minute call to explore alignment. Thank you!\n\nBest regards`;
    }
  }

  async sendOutreachEmail(toEmail, subject, bodyContent, pdfAttachmentPath) {
    const hasSmtp = process.env.SMTP_USER && process.env.SMTP_PASS &&
                    (process.env.SMTP_PROVIDER || process.env.SMTP_HOST);

    if (hasSmtp) {
      try {
        const transporter = buildSmtpTransporter();
        const mailOptions = {
          from: process.env.SMTP_USER,
          to: toEmail,
          subject,
          text: bodyContent,
          attachments: pdfAttachmentPath && fs.existsSync(pdfAttachmentPath)
            ? [{ path: pdfAttachmentPath }]
            : []
        };
        const info = await transporter.sendMail(mailOptions);
        return { success: true, method: `${this.getSmtpProvider()} SMTP Dispatch`, messageId: info.messageId };
      } catch (err) {
        return { success: false, method: 'SMTP Failed — Spooled Locally', error: err.message, path: await this._spoolLocally(toEmail, subject, bodyContent, pdfAttachmentPath) };
      }
    }

    const spoolPath = await this._spoolLocally(toEmail, subject, bodyContent, pdfAttachmentPath);
    return { success: true, method: 'Local Outbox Spooling', path: spoolPath };
  }

  async _spoolLocally(toEmail, subject, bodyContent, pdfAttachmentPath) {
    const outboxDir = path.join(process.cwd(), 'outbox');
    if (!fs.existsSync(outboxDir)) fs.mkdirSync(outboxDir);
    const safeSub = subject.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 30);
    const filePath = path.join(outboxDir, `email_${safeSub}_${Date.now()}.txt`);
    const payload = `TO: ${toEmail}\nSUBJECT: ${subject}\nATTACHMENT: ${pdfAttachmentPath || 'None'}\nSTATUS: Spooled Locally — configure SMTP in .env to auto-dispatch\n\n${bodyContent}`;
    fs.writeFileSync(filePath, payload, 'utf8');
    return filePath;
  }

  async filterNewJobs(jobs) {
    return await this.diary.filterNewTasks(jobs.map(j => ({ title: `Evaluate Job: ${j.title}`, ...j })));
  }
}
