import os
from dotenv import load_dotenv
import google.generativeai as genai
import whisper
from .metrics import compute_metrics
import torchaudio
import librosa

load_dotenv()
api_key = os.getenv("GEMINI_API_KEY")
if not api_key:
    raise ValueError("❌ GEMINI_API_KEY not found in .env")
genai.configure(api_key=api_key)


def run_pipeline(audio_path: str):
    if not os.path.exists(audio_path):
        raise FileNotFoundError(f"❌ File not found: {audio_path}")

    print("🎧 Transcribing locally with Whisper...")
    model = whisper.load_model("base")
    result = model.transcribe(audio_path)
    transcript_text = result["text"].strip()

    print("Transcription Result:\n", transcript_text)
    print("Computing performance metrics...")

    waveform, sample_rate = torchaudio.load(audio_path)
    duration = librosa.get_duration(filename=audio_path)
    metrics = compute_metrics(transcript_text, duration)

    print("Metrics:\n", metrics)

    return {
        "filename": os.path.basename(audio_path),
        "transcript": transcript_text,
        "metrics": metrics
    }

if __name__ == "__main__":
    AUDIO_PATH = "sample.wav"
    output = run_pipeline(AUDIO_PATH)
    print(output)
