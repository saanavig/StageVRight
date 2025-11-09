import os
import json
from dotenv import load_dotenv
import whisper
from .metrics import compute_metrics
import torchaudio
import librosa
from pydub import AudioSegment
import httpx
from datetime import datetime
from openai import OpenAI

load_dotenv()

# --- API Keys ---
api_key = os.getenv("OPENAI_API_KEY")
if not api_key:
    raise ValueError("❌ OPENAI_API_KEY not found in .env")

client = OpenAI(api_key=api_key)

deepgram_key = os.getenv("DEEPGRAM_API_KEY")
if not deepgram_key:
    raise ValueError("❌ DEEPGRAM_API_KEY not found in .env")


def ensure_wav(input_path: str) -> str:
    """Ensure the input audio file is in .wav format"""
    if input_path.lower().endswith(".wav"):
        return input_path

    output_path = input_path.rsplit(".", 1)[0] + ".wav"
    try:
        audio = AudioSegment.from_file(input_path)
        audio.export(output_path, format="wav")
        return output_path
    except Exception as e:
        raise RuntimeError(f"❌ Failed to convert to WAV: {e}")


async def deepgram_test(audio_path: str):
    """Quick test call to verify Deepgram works (direct REST)."""
    url = "https://api.deepgram.com/v1/listen"
    params = {"punctuate": "true", "filler_words": "true", "utterances": "true"}
    headers = {
        "Authorization": f"Token {os.getenv('DEEPGRAM_API_KEY')}",
        "Content-Type": "audio/wav",
    }

    with open(audio_path, "rb") as f:
        data = f.read()

    async with httpx.AsyncClient(timeout=60.0) as client_http:
        response = await client_http.post(url, params=params, headers=headers, content=data)
        response.raise_for_status()
        result = response.json()

    alt = result["results"]["channels"][0]["alternatives"][0]
    transcript = alt.get("transcript", "")
    print("🔊 Deepgram transcript (first 100 chars):", transcript[:100])
    return transcript, result


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

    # deepgram verification
    print("Testing Deepgram transcription...")
    try:
        import asyncio
        dg_transcript, dg_result = asyncio.run(deepgram_test(audio_path))
        print("Deepgram test completed.")
    except Exception as e:
        print("❌ Deepgram test error:", e)
        dg_transcript, dg_result = "", None

    # --- AI Feedback Generation (OpenAI SDK v2.x)
    try:
        print("Generating AI feedback summary with OpenAI...")

        prompt = f"""
        You are a professional public speaking and communication coach.
        Your task is to evaluate a short presentation excerpt based on both the spoken transcript and the quantified speech metrics provided.

        === CONTEXT ===
        Transcript:
        {transcript_text}

        === METRICS ===
        - Fillers used: {metrics.get('fillers', 'N/A')}
        - Repetitions: {metrics.get('repetitions', 'N/A')}
        - Fluency score (0–10): {metrics.get('fluency_score', 'N/A')}
        - Overall delivery score (0–10): {metrics.get('overall_score', 'N/A')}

        === INSTRUCTIONS ===
        1. Write exactly two sentences of personalized, encouraging feedback.
        2. Be specific — reference the speaker's use of fillers, repetitions, pacing, and clarity.
        3. Highlight one strength and one actionable improvement.
        4. Keep a motivational and professional tone.
        5. Avoid restating the metrics; interpret them instead.
        """

        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.7,
        )

        feedback = response.choices[0].message.content.strip()
        print("✅ Feedback successfully generated:")
        print(feedback)

    except Exception as e:
        print("❌ OpenAI feedback error:", repr(e))
        feedback = f"Feedback unavailable. ({e})"

    # --- Save output ---
    result_data = {
        "filename": os.path.basename(audio_path),
        "transcript": transcript_text,
        "fillers": metrics.get('fillers', 0),
        "repetitions": metrics.get('repetitions', 0),
        "fluency_score": metrics.get('fluency_score', 0),
        "clarity_score": metrics.get('clarity_score', 0),
        "wpm": metrics.get('wpm', 0),
        "overall_score": metrics.get('overall_score', 0),
        "feedback_summary": feedback,
        "scene": "Auditorium",
        "date": datetime.now().isoformat(),
        "deepgram_transcript": dg_transcript,
    }

    # Save to results directory
    results_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "results")
    os.makedirs(results_dir, exist_ok=True)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    output_file = os.path.join(results_dir, f"session_{timestamp}.json")
    with open(output_file, "w") as f:
        json.dump(result_data, f, indent=2)
    print(f"✅ Results saved to: {output_file}")
    return result_data


if __name__ == "__main__":
    AUDIO_PATH = "sample.wav"
    output = run_pipeline(AUDIO_PATH)
    print(output)
