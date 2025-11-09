import os
import sys
import json
import tempfile
from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
from services import audio_transcribe
from datetime import datetime

CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
if CURRENT_DIR not in sys.path:
    sys.path.append(CURRENT_DIR)

app = Flask(__name__)
CORS(app)

@app.route("/")
def home():
    """Health check"""
    return jsonify({"message": "StageFreight backend running!"}), 200


@app.route("/analyze", methods=["POST"])
def analyze():
    if "file" not in request.files:
        return jsonify({"error": "No file provided"}), 400

    file = request.files["file"]
    if file.filename == "":
        return jsonify({"error": "Empty filename"}), 400

    try:
        print(f"Received file: {file.filename}")
        with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as tmp:
            file.save(tmp.name)
            tmp_path = tmp.name

        # Run analysis pipeline
        result = audio_transcribe.run_pipeline(tmp_path)

        # Save session JSON
        session_dir = os.path.join(CURRENT_DIR, "sessions")
        os.makedirs(session_dir, exist_ok=True)
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        save_path = os.path.join(session_dir, f"{timestamp}.json")
        with open(save_path, "w") as f:
            json.dump(result, f, indent=2)
        print(f"Session saved at: {save_path}")

        os.remove(tmp_path)
        return jsonify(result), 200

    except Exception as e:
        print("❌ Error during analysis:", e)
        return jsonify({"error": str(e)}), 500


@app.route("/sessions/", methods=["GET"])
def list_sessions():
    """Return JSON list of saved session files."""
    session_dir = os.path.join(CURRENT_DIR, "sessions")
    os.makedirs(session_dir, exist_ok=True)
    files = sorted([f for f in os.listdir(session_dir) if f.endswith(".json")])
    return jsonify({"sessions": files})

@app.route("/sessions/<path:filename>", methods=["GET"])
def serve_session(filename):
    """Serve a specific session JSON file."""
    session_dir = os.path.join(CURRENT_DIR, "sessions")
    if not os.path.exists(os.path.join(session_dir, filename)):
        return jsonify({"error": "Session file not found"}), 404
    return send_from_directory(session_dir, filename)


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8000, debug=True)
