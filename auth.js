import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';

console.log("Checking Gemini CLI Authentication...");

const credPath = path.join(os.homedir(), '.gemini', 'oauth_creds.json');

if (fs.existsSync(credPath)) {
  console.log("✅ You are already authenticated. Tokens found in ~/.gemini/oauth_creds.json");
  console.log("If you are facing issues, you can delete this file to force re-authentication.");
} else {
  console.log("🔑 No authentication found. Launching Gemini CLI Auth...");
  try {
    // Run the gemini CLI auth command.
    // stdio: 'inherit' allows the user to see the prompts and interact if needed.
    execSync('npx @google/gemini-cli auth', { stdio: 'inherit' });
    console.log("✅ Authentication successful!");
  } catch (error) {
    console.error("❌ Authentication failed or was aborted by the user.");
    process.exit(1);
  }
}
