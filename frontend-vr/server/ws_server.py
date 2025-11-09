import asyncio
import json
import os
import sys
import tempfile
from datetime import datetime
from pathlib import Path

import websockets
from pydub import AudioSegment

# Allow imports from backend services
REPO_ROOT = Path(__file__).resolve().parents[2]
BACKEND_DIR = REPO_ROOT / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.append(str(BACKEND_DIR))

from services import audio_transcribe

SESSION_ROOT = Path(tempfile.gettempdir()) / "stagev_sessions"
SESSION_ROOT.mkdir(parents=True, exist_ok=True)
REPORT_DIR = BACKEND_DIR / "data" / "sessions"
REPORT_DIR.mkdir(parents=True, exist_ok=True)


def _extension_from_mime(mime_type: str) -> str:
    if not mime_type or "/" not in mime_type:
        return "bin"
    subtype = mime_type.split("/", 1)[1]
    return subtype if subtype else "bin"


def _session_dir(session_id: str) -> Path:
    directory = SESSION_ROOT / session_id
    directory.mkdir(parents=True, exist_ok=True)
    return directory


def _natural_key(path: Path):
    name = path.stem
    number = "".join(ch for ch in name if ch.isdigit())
    return int(number) if number.isdigit() else name


def save_chunk(session_id: str, chunk_number: int, data: bytes, mime_type: str) -> Path:
    ext = _extension_from_mime(mime_type)
    chunk_path = _session_dir(session_id) / f"chunk_{chunk_number:04d}.{ext}"
    with chunk_path.open("wb") as f:
        f.write(data)
    print(f"[WS] Saved chunk {chunk_number} for session {session_id} -> {chunk_path}")
    return chunk_path


def concatenate_and_analyze(session_id: str) -> Path:
    session_dir = _session_dir(session_id)
    chunk_files = sorted(session_dir.glob("chunk_*"), key=_natural_key)
    if not chunk_files:
        raise ValueError(f"No chunks found for session {session_id}")

    combined_wav = session_dir / f"{session_id}_combined.wav"
    print(f"[WS] Concatenating {len(chunk_files)} chunks for session {session_id}")
    audio = AudioSegment.silent(duration=0)
    for chunk_path in chunk_files:
        segment = AudioSegment.from_file(chunk_path)
        audio += segment
    audio.export(combined_wav, format="wav")
    print(f"[WS] Combined audio written to {combined_wav}")

    result = audio_transcribe.run_pipeline(str(combined_wav))

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    report_path = REPORT_DIR / f"{session_id}_{timestamp}.json"
    with report_path.open("w") as f:
        json.dump(result, f, indent=2)
    print(f"[WS] Analysis saved to {report_path}")
    return report_path


async def ws_handler(websocket, *args):
    print("[WS] Client connected")
    current_session = None
    pending_meta = None
    try:
        async for message in websocket:
            if isinstance(message, bytes):
                if not current_session or not pending_meta:
                    print("[WS] Binary chunk received without metadata; ignoring")
                    continue
                save_chunk(
                    current_session,
                    pending_meta.get("chunkNumber", 0),
                    message,
                    pending_meta.get("mimeType", "audio/webm"),
                )
                pending_meta = None
            else:
                try:
                    payload = json.loads(message)
                except json.JSONDecodeError:
                    print(f"[WS] Non-JSON text message ignored: {message}")
                    continue

                msg_type = payload.get("type")
                if msg_type == "chunkMeta":
                    current_session = payload.get("sessionId")
                    pending_meta = payload
                    chunk_num = payload.get("chunkNumber")
                    print(f"[WS] Metadata received for session {current_session}, chunk {chunk_num}")
                elif msg_type == "analyze":
                    session_id = payload.get("sessionId")
                    if not session_id:
                        print("[WS] Analyze request missing sessionId")
                        continue
                    loop = asyncio.get_running_loop()
                    try:
                        report_path = await loop.run_in_executor(None, concatenate_and_analyze, session_id)
                        response = {
                            "type": "analyze-complete",
                            "sessionId": session_id,
                            "report": str(report_path)
                        }
                        await websocket.send(json.dumps(response))
                    except Exception as exc:
                        print(f"[WS] Analysis error: {exc}")
                        error_msg = {
                            "type": "analyze-error",
                            "sessionId": session_id,
                            "error": str(exc)
                        }
                        await websocket.send(json.dumps(error_msg))
                else:
                    print(f"[WS] Unknown message type: {msg_type}")
    except Exception as exc:
        print(f"[WS] Error: {exc}")
    finally:
        print("[WS] Client disconnected")


async def main():
    print("[WS] Starting WebSocket server on ws://0.0.0.0:8000 ...")
    async with websockets.serve(ws_handler, "0.0.0.0", 8000):
        await asyncio.Future()


if __name__ == "__main__":
    asyncio.run(main())