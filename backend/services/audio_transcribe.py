import os
from dotenv import load_dotenv
import google.generativeai as genai
import whisper
from .metrics import compute_metrics
import torchaudio
import librosa
from pydub import AudioSegment


load_dotenv()
api_key = os.getenv("GEMINI_API_KEY")
if not api_key:
    raise ValueError("❌ GEMINI_API_KEY not found in .env")
genai.configure(api_key=api_key)


def ensure_wav(input_path: str) -> str:

    if input_path.lower().endswith(".wav"):
        return input_path

    output_path = input_path.rsplit(".", 1)[0] + ".wav"
    try:
        audio = AudioSegment.from_file(input_path)
        audio.export(output_path, format="wav")
        return output_path
    except Exception as e:
        raise RuntimeError(f"❌ Failed to convert to WAV: {e}")


def run_pipeline(audio_path: str):
    if not os.path.exists(audio_path):
        raise FileNotFoundError(f"❌ File not found: {audio_path}")

    # ensure file is wav
    audio_path = ensure_wav(audio_path)

    print("Transcribing locally with Whisper...")
    model = whisper.load_model("base")
    result = model.transcribe(audio_path)
    transcript_text = result["text"].strip()

    print("Transcription Result:\n", transcript_text)
    print("Computing performance metrics...")

    waveform, sample_rate = torchaudio.load(audio_path)
    duration = librosa.get_duration(filename=audio_path)
    metrics = compute_metrics(transcript_text, duration)

    print("Metrics:\n", metrics)

    try:
        model = genai.GenerativeModel("gemini-1.5-pro")
        prompt = f"""
        You are a motivational public speaking coach.
        Based on this transcript and its metrics, write two concise and constructive sentences of feedback.
        Transcript: {transcript_text}
        Metrics: {metrics}
        """
        response = model.generate_content(prompt)
        feedback = response.text.strip()
    except Exception as e:
        print("❌ Gemini feedback error:", e)
        feedback = "Feedback unavailable."

    return {
        "filename": os.path.basename(audio_path),
        "transcript": transcript_text,
        "metrics": metrics
    }

if __name__ == "__main__":
    AUDIO_PATH = "sample.wav"
    output = run_pipeline(AUDIO_PATH)
    print(output)
