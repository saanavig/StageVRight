import os
import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv()
api_key = os.getenv("GEMINI_API_KEY")

if not api_key:
    raise ValueError("❌ GEMINI_API_KEY not found in .env file.")

genai.configure(api_key=api_key)

try:
    models = genai.list_models()
    print("Gemini connection successful! Available models:")
    for m in models:
        print(" -", m.name)
except Exception as e:
    print("Error connecting to Gemini API:", e)
