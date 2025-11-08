
import re
import spacy

nlp = spacy.load("en_core_web_sm")

def detect_fillers_spacy(text: str) -> int:
    """
    Detects filler-like words using spaCy POS tags and linguistic cues.
    Looks for interjections (INTJ), discourse markers, and hesitation tokens.
    """
    doc = nlp(text.lower())
    fillers = [
        token.text
        for token in doc
        if token.pos_ in {"INTJ", "DISCOURSE"} or token.text in {"uh", "um", "hmm", "er", "ah"}
    ]
    return len(fillers)

def compute_metrics(transcript: str, duration_sec: float) -> dict:
    cleaned_text = transcript.lower().strip()
    words = re.findall(r"\b\w+\b", cleaned_text)
    num_words = len(words)
    duration_sec = max(duration_sec, 1)

    #wpm calculation
    wpm = round(num_words / (duration_sec / 60), 1)

    # count fillers using spaCy
    filler_count = detect_fillers_spacy(cleaned_text)

    # repetition check (e.g., "I I", "the the")
    repetitions = len(re.findall(r"\b(\w+)\s+\1\b", cleaned_text))

    # rule-based scoring
    fluency_score = max(1, 10 - filler_count)
    clarity_score = 10 if wpm <= 160 else 8
    confidence_score = 10 if 120 <= wpm <= 150 else 8
    energy_level = 7
    overall_score = round(
        (fluency_score + clarity_score + confidence_score + energy_level) / 4, 1
    )

    # feedback summary, ai generated
    feedback_summary = (
        f"Spoke at {wpm} WPM with {filler_count} filler words "
        f"and {repetitions} repetitions. "
        "Good pacing overall — aim for fewer fillers for smoother delivery."
    )

    # output
    return {
        "transcript_length": num_words,
        "duration_seconds": round(duration_sec, 1),
        "wpm": wpm,
        "fillers": filler_count,
        "repetitions": repetitions,
        "tone": "neutral",
        "energy_level": energy_level,
        "clarity_score": clarity_score,
        "fluency_score": fluency_score,
        "confidence_score": confidence_score,
        "overall_score": overall_score,
        "feedback_summary": feedback_summary,
    }