import os
import sys
import json
import tempfile
from flask import Flask, jsonify, request
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

        result = audio_transcribe.run_pipeline(tmp_path)

        os.makedirs("data/sessions", exist_ok=True)
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        save_path = os.path.join("data/sessions", f"{timestamp}.json")
        with open(save_path, "w") as f:
            json.dump(result, f, indent=2)
        print(f"Session saved at: {save_path}")

        os.remove(tmp_path)
        return jsonify(result), 200

    except Exception as e:
        print("❌ Error during analysis:", e)
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8000, debug=True)
