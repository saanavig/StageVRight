from flask import Flask, jsonify
from services.audio_transcribe import transcribe_audio


app = Flask(__name__)

@app.route("/")
def home():
    return jsonify({"message": "StageFreight backend running!"})

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8000, debug=True)
