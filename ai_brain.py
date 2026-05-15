import os
import subprocess
from dotenv import load_dotenv

# Import standard SDKs
from openai import OpenAI
from google import genai
from groq import Groq

# Load environment variables
load_dotenv()

class AIBrain:
    def __init__(self):
        self.provider = os.getenv("AI_PROVIDER", "auto")
        
        # Initialize clients lazily based on provider
        self.groq_client = None
        self.openai_client = None
        self.nvidia_client = None
        self.gemini_client = None
        
    def _init_groq(self):
        if not self.groq_client:
            self.groq_client = Groq(api_key=os.getenv("GROQ_API_KEY"))
            
    def _init_openai(self):
        if not self.openai_client:
            self.openai_client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
            
    def _init_nvidia(self):
        if not self.nvidia_client:
            # NVIDIA NIM uses standard OpenAI SDK but with their base_url
            self.nvidia_client = OpenAI(
                base_url="https://integrate.api.nvidia.com/v1",
                api_key=os.getenv("NVIDIA_NIM_API_KEY")
            )
            
    def _init_gemini_rest(self):
        if not self.gemini_client:
            self.gemini_client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

    def evaluate(self, prompt: str, task_type: str = "general") -> str:
        """Routes the prompt to the configured AI provider based on task_type."""
        env_key = f"{task_type.upper()}_AI_PROVIDER"
        provider = os.getenv(env_key, self.provider).lower()
        print(f"Routing task '{task_type}' to {provider}...")
        
        if provider == "gemini_cli":
            return self._call_gemini_cli(prompt)
        elif provider == "nvidia_nim":
            return self._call_nvidia_nim(prompt)
        elif provider == "groq":
            return self._call_groq(prompt)
        elif provider == "openai":
            return self._call_openai(prompt)
        elif provider == "gemini":
            return self._call_gemini_rest(prompt)
        else:
            return "Error: Unknown provider or auto not yet implemented."

    def _call_gemini_cli(self, prompt: str) -> str:
        """Executes the prompt using the local Gemini CLI (uses local auth)."""
        model = os.getenv("GEMINI_CLI_MODEL", "gemini-2.0-flash")
        try:
            # The new Gemini CLI requires -p for non-interactive prompt execution
            result = subprocess.run(
                ["gemini", "-p", prompt],
                capture_output=True,
                text=True,
                check=True
            )
            return result.stdout.strip()
        except subprocess.CalledProcessError as e:
            return f"Gemini CLI Error: {e.stderr}"
        except FileNotFoundError:
            return "Gemini CLI Error: 'gemini' command not found. Please install it."

    def _call_nvidia_nim(self, prompt: str) -> str:
        """Calls NVIDIA NIM hosted models."""
        self._init_nvidia()
        model = os.getenv("NVIDIA_NIM_MODEL", "meta/llama3-70b-instruct")
        try:
            response = self.nvidia_client.chat.completions.create(
                model=model,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.7,
                max_tokens=2048,
            )
            return response.choices[0].message.content
        except Exception as e:
            return f"NVIDIA NIM Error: {str(e)}"

    def _call_groq(self, prompt: str) -> str:
        """Calls Groq's high-speed inference engine."""
        self._init_groq()
        model = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")
        try:
            response = self.groq_client.chat.completions.create(
                model=model,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.7,
            )
            return response.choices[0].message.content
        except Exception as e:
            return f"Groq Error: {str(e)}"

    def _call_openai(self, prompt: str) -> str:
        self._init_openai()
        model = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
        try:
            response = self.openai_client.chat.completions.create(
                model=model,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.7,
            )
            return response.choices[0].message.content
        except Exception as e:
            return f"OpenAI Error: {str(e)}"

    def _call_gemini_rest(self, prompt: str) -> str:
        self._init_gemini_rest()
        model_name = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
        try:
            response = self.gemini_client.models.generate_content(
                model=model_name,
                contents=prompt
            )
            return response.text
        except Exception as e:
            return f"Gemini REST Error: {str(e)}"

if __name__ == "__main__":
    # Simple test
    brain = AIBrain()
    print("AI Brain Initialized.")
    print("Testing prompt...")
    # response = brain.evaluate("Hello, are you working?")
    # print(response)
