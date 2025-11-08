import os
from dotenv import load_dotenv
import google.generativeai as genai
import whisper
from metrics import compute_metrics
import torchaudio
import librosa

#upload key
load_dotenv()
api_key = os.getenv("GEMINI_API_KEY")
if not api_key:
    raise ValueError("❌ GEMINI_API_KEY not found in .env")
genai.configure(api_key=api_key)

AUDIO_PATH = "sample.wav"
if not os.path.exists(AUDIO_PATH):
    raise FileNotFoundError(f"❌ File not found: {AUDIO_PATH}")

# transcribe locally
try:
    print("🎧 Transcribing locally with Whisper...")
    model = whisper.load_model("base")
    result = model.transcribe(AUDIO_PATH)
    transcript_text = result["text"].strip()

    print("\n✅ Transcription Result:\n")
    print(transcript_text)

    print("\n🧠 Computing performance metrics...")
    waveform, sample_rate = torchaudio.load(AUDIO_PATH)
    duration = librosa.get_duration(filename=AUDIO_PATH)
    metrics = compute_metrics(transcript_text, duration)

    print("\n✅ Metrics:\n", metrics)

except Exception as e:
    raise RuntimeError(f"❌ Whisper transcription failed: {e}")
