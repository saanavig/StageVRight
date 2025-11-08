Awesome—let’s crank this up to “plug-and-play.” Below is an ultra-detailed plan you can paste into your doc. I added comments next to folders/files, beginner-friendly function context (what/why/how), a step-by-step plan that mirrors the flowchart with checkpoints/tests, and notes to keep everything compatible/feasible for a hackathon MVP.

# Project: StageFreight (WebXR MVP)
# 1) Monorepo layout (with comments)
Monorepo layout (with comments)
stagefreight/
  README.md                      # Quick start, run commands, demo steps
  .env.example                   # Example env vars (copy to .env)
  scripts/
    tunnel.sh                    # (Optional) ngrok/Cloudflare tunnel helper for Quest
    check_env.sh                 # Sanity checks: python/node versions, ports
  data/                          # Local JSON storage (no DB)
    sessions/                    # Each session gets its own folder at runtime
  backend/
    requirements.txt             # FastAPI, uvicorn, pydantic; minimal deps
    run_dev.sh                   # Dev launcher (reads .env, starts uvicorn)
    app/
      __init__.py                # Marks package
      main.py                    # FastAPI app factory, CORS, WS/HTTP mount
      core/
        __init__.py
        config.py                # Settings class: chunk sizes, ASR provider, paths
      models/
        __init__.py
        schemas.py               # Pydantic schemas for requests/responses
      api/
        __init__.py
        routes.py                # REST routes: create/stop session, get summary, transcript
      ws/
        __init__.py
        manager.py               # WebSocket connection manager (per-session rooms)
      services/
        __init__.py
        asr.py                   # ASR adapter (Whisper API / whisper.cpp / Gemini)
        analysis.py              # Filler/WPM/pace/score calculations
        feedback.py              # Human-friendly feedback messages for HUD
        segmentation.py          # Rolling buffer/windowing for non-streaming ASR
      storage/
        __init__.py
        local_store.py           # JSON/JSONL writes/reads to data/sessions/<id>/
      utils/
        __init__.py
        audio_utils.py           # PCM helpers, RMS/VAD (optional)
        time_utils.py            # Now(), ms utils, formatting
    tests/
      test_analysis.py           # Units: filler detection, WPM, scoring
      test_asr.py                # Units: mock chunk → stub transcript
  frontend-vr/
    package.json                 # A-Frame + Vite dev server
    vite.config.js               # Runs on localhost; easy to tunnel
    dev.sh                       # Dev launcher (opens browser)
    public/
      index.html                 # A-Frame scene root, Start/Stop UI, HUD container
      aframe.min.js              # Local copy to avoid CDN hiccups
    assets/
      models/                    # Optional: stage, mic stand
      textures/                  # Optional: floor/curtain textures
    src/
      state.js                   # Session state: id, counters, flags
      scene.js                   # Build VR scene (lights, stage, mic), wire UI
      hud.js                     # Draw/update floating HUD text & simple indicators
      audio.js                   # Capture mic, slice into PCM16 chunks
      network.js                 # HTTP (create/stop) + WebSockets (audio/feedback)
      utils/
        limiter.js               # Rate-limits WS sends (e.g., 120–200 ms)
        metrics.js               # EMA smoothing for WPM/score to reduce jitter
  dashboard/                     # (Optional mini React dashboard)
    package.json
    vite.config.js
    public/index.html
    src/
      App.jsx                    # Simple pages: sessions list → summary
      api.js                     # Fetch summary/transcript from backend
      components/
        SessionList.jsx
        SummaryCard.jsx

# 2) Data contracts (simple & stable)
WebSocket: VR → Backend (audio chunks)
{
  "type": "audio_chunk",
  "payload": {
    "session_id": "uuid",
    "seq": 17,
    "audio_format": "pcm16le",
    "sample_rate": 16000,
    "bytes_b64": "<base64 PCM16>",
    "ms": 160            // duration of this chunk (e.g., 120–200 ms)
  }
}

WebSocket: Backend → VR (live feedback)
{
  "type": "partial_feedback",
  "payload": {
    "session_id": "uuid",
    "seq": 17,
    "wpm": 132.3,
    "fillers": 2,
    "filler_last": "like",
    "pace_label": "Good",       // "Slow" | "Good" | "Fast"
    "score_partial": 86.0,
    "message": "Good pace—keep eye on 'like'!"
  }
}

HTTP (REST)
POST /sessions/create -> {session_id, started_at}
POST /sessions/{id}/stop -> SessionSummary
GET /sessions/{id}/summary -> SessionSummary
GET /sessions/{id}/transcript -> Transcript

# 3) Backend function breakdown (beginner-friendly)
Think of the backend as a pipeline: Audio → (maybe Buffer) → ASR → Analyze → Feedback → Store.
core/config.py
What/Why: One place for tweakable knobs (chunk size, thresholds), so you don’t hunt through code.
Key class: Settings
Inputs: environment variables (ASR_PROVIDER, OPENAI_API_KEY, GEMINI_API_KEY, SAMPLE_RATE=16000, CHUNK_MS=160, DATA_DIR=./data)
Outputs: a typed object you can import anywhere.
Use: settings = Settings() inside main.py, asr.py, etc.
ws/manager.py
What/Why: Manages groups of WebSocket clients per session_id so we can broadcast HUD updates to the right headset(s).
API:
connect(websocket, session_id): Track a connection in a set.
disconnect(websocket, session_id): Cleanup on close/error.
broadcast_feedback(session_id, payload): Send JSON to all listeners for that session.
services/segmentation.py
What/Why: If your ASR only works on 2–5 second windows, this buffers 120–200 ms chunks until you have a “window,” then hands it off. Keeps latency reasonable without true streaming.
API:
RollingBuffer.append(pcm_bytes): Add latest frame.
RollingBuffer.pop_ready_window(min_ms): Returns bytes when enough audio is buffered.
services/asr.py
What/Why: Isolates all ASR provider details so you can switch from Whisper API ⇄ whisper.cpp ⇄ Gemini without touching the rest of the app.
API:
init_asr(provider, settings): Prepare clients or subprocess handles.
transcribe_chunk_pcm16(session_id, pcm_bytes, sample_rate, ms) -> {"text": str, "words": [{word,start,end,conf?}]}
Why important: This creates the transcript that everything else depends on—without it, we can’t compute WPM/fillers.
flush_session(session_id) -> Transcript: Finalize buffered audio (last window), stitch words into a final transcript.
services/analysis.py
What/Why: Turns words into metrics the speaker understands. Keeps logic small and tunable.
API:
detect_fillers(words:list[str]) -> {count, last?, occurrences:[{idx,word}]}
Why: Gives immediate, actionable coaching (“try not to say ‘um’”).
compute_wpm(total_words:int, elapsed_ms:int) -> float
Why: Pace is the most intuitive real-time signal for public speaking.
pace_label(wpm:float) -> "Slow"|"Good"|"Fast"
score_partial(wpm:float, fillers_window:int) -> float (0..100)
Why: Single metric for HUD color + demo “wow.”
summarize_session(transcript, total_ms) -> SessionSummary
Why: Generates your end-screen “report card.”
services/feedback.py
What/Why: Converts raw numbers to short, encouraging messages (“Great pace!”). Keeps tone consistent and demo-friendly.
API:
compose_feedback_message(wpm, fillers, last_filler, pace) -> str
storage/local_store.py
What/Why: Simple persistence using JSON/JSONL so you can show history and final summary without any DB setup.
API:
ensure_session_dir(session_id) -> Path
append_partial(session_id, key, item) → data/sessions/<id>/<key>.jsonl
write_json(session_id, filename, obj) → pretty JSON
read_json(session_id, filename) → dict or None
list_sessions() -> list[str]
On disk (auto-created):
data/sessions/<session_id>/
  meta.json
  partial_feedback.jsonl      # one JSON object per line (timeline)
  transcript_words.jsonl      # per-window words for debugging
  transcript_final.json       # after STOP
  summary.json                # after STOP
  audio.raw                   # optional, if you choose to store

api/routes.py
What/Why: Simple HTTP for session lifecycle + readbacks so the VR app & dashboard can coordinate.
Endpoints:
POST /sessions/create → creates folder, meta.json
POST /sessions/{id}/stop → flush ASR, generate summary, return it
GET /sessions/{id}/summary → read summary.json
GET /sessions/{id}/transcript → read transcript_final.json
WebSockets:
/ws/audio?session_id=... (client → server): receive audio envelopes, run pipeline, produce feedback
/ws/feedback?session_id=... (server → client): push PartialFeedback as soon as it’s computed

# 4) Frontend-VR function breakdown (beginner-friendly)
The VR front-end has three jobs: capture mic, send audio, draw feedback.
src/audio.js
startMic(sampleRate=16000) -> MediaStreamAudioSourceNode
Why: Starts mic capture from the headset/PC browser.
beginCapture(stream, onChunk(bytes))
How: Use Web Audio (ScriptProcessor or AudioWorklet) to pull 120–200 ms frames, convert float32 → PCM16 (little-endian), call onChunk.
stopCapture()
Why: Cleanly ends the stream when the user hits “Stop.”
src/network.js
createSession() -> Promise
Why: Get a fresh session_id (folder) before sending audio.
openAudioSocket(sessionId) -> WebSocket
Why: Channel to push encoded PCM16 chunks to the backend.
openFeedbackSocket(sessionId) -> WebSocket
Why: Channel to receive HUD feedback messages in real time.
sendAudioChunk(ws, payload:ChunkIn)
Why: JSON-serialize, send, and optionally back-pressure or drop if socket is clogged.
src/hud.js
initHUD(sceneEl)
Why: Creates a floating panel (A-Frame text) inside VR scene.
renderFeedback(f:PartialFeedback)
How: Update text: WPM, fillers, pace label; set color by pace_label (green/yellow/red); optionally pulse a spotlight intensity.
src/scene.js
initScene()
Why: Places stage, mic stand, simple audience; adds Start/Stop UI.
wireUI()
Flow:
Start → createSession() → openAudioSocket & openFeedbackSocket
startMic() → beginCapture() → loop sendAudioChunk()
On feedback WS: hud.renderFeedback()
Stop → stopCapture() → POST /sessions/{id}/stop → show final score
src/state.js
Holds { sessionId, seq, startedAt, connected }.
Why: Keep counters consistent (e.g., seq increments every chunk).
utils/limiter.js
rateLimit(fn, perMs) so you don’t spam WS >10/s.
Why: Network stability and smoother feedback cadence.
utils/metrics.js
EMA smoothing to reduce jitter in WPM/score on HUD.
Why: Visual polish for demo.

# 5) Roles (file-level ownership)
Advanced Dev — Full-Stack/Integration
Backend app skeleton & WS: main.py, api/routes.py, ws/manager.py, core/config.py
ASR adapter + segmentation: services/asr.py, services/segmentation.py
Storage & schemas: storage/local_store.py, models/schemas.py
Tooling: scripts/tunnel.sh, .env, README
Medium Dev #1 — WebXR
Scene/HUD/UI: public/index.html, src/scene.js, src/hud.js
Audio + sockets: src/audio.js, src/network.js, utils/limiter.js
Medium Dev #2 — Analysis/Scoring
Metrics/messages: services/analysis.py, services/feedback.py, utils/audio_utils.py
Tests: tests/test_analysis.py, tests/test_asr.py (mock)
Beginner Dev — Dashboard & Docs
Optional dashboard: dashboard/src/*
Demo script, QA checklist, README polish

# 6) Step-by-step build plan with checkpoints (mirrors flowchart)
Legend:
A = Backend Core track, B = WebXR track, C = Analysis/Scoring, D = Optional Dashboard/Docs
✅ = demo-critical; 🧪 = checkpoint/test
Phase 0 — Bootstrap (Everyone)
0.1 Clone repo skeleton, python -m venv .venv && pip install -r backend/requirements.txt, npm i in frontend-vr.
0.2 Copy .env.example → .env; set ASR_PROVIDER=whisper_api (or whisper_cpp, gemini_speech).
🧪 Run scripts/check_env.sh (prints versions, confirms ports 5173/8000 free).


Flowchart (IDs match steps above)
                [Phase 0: Bootstrap]
                         |
        +----------------+----------------+
        |                                 |
   [A1] Backend HTTP/WS             [B1] VR scene/UI
        |                                 |
   [A2] WS manager/broadcast         [B2] Feedback WS connect
        |                                 |
   [A3] Session REST                 [B3] Create session (Start)
        |                                 |
   [A4] Audio WS echo (fake)         [B4] Mic capture + chunking
        |                \            /           |
        |                 \          /            |
        |                  \        /             |
        +-------------------[C2] Analysis---------+
                           /        \
                     [A5] Segmentation [A6] ASR adapter
                           \        /
                            \      /
                           [A7] Full pipeline
                               |
                           [A8] Stop→Summary
                               |
                           [B5] VR Stop UI
                               |
                   +-----------+-----------+
                   |                       |
                 [A9] Tunnel/Quest   [B6] Visual polish
                   |                       |
                          [D3] Demo video

Phase 1 — Skeleton Online (Parallel)
A1 (✅) Backend HTTP + WS scaffolding
Implement main.py app factory with CORS, health endpoint /healthz.
Add dummy /ws/audio (accepts messages, ignores) and /ws/feedback (can send test ping).
🧪 uvicorn app.main:app --reload → GET /healthz returns {"ok":true}.
B1 (✅) VR scene + UI shell
public/index.html simple stage and big floating text “StageFreight”.
Add Start/Stop buttons (A-Frame HTML overlay or simple HTML in WebXR friendly UI).
🧪 npm run dev → see stage in desktop browser.
C1 (🧪) Unit test harness
Stub tests/test_analysis.py with trivial pass to confirm pytest runs.
🧪 pytest shows green.
D1 README Quick Start
Document run commands + tunnel note for Quest testing.

Phase 2 — Wires Connected (Parallel)
A2 (✅) WebSocket manager + feedback broadcast
Implement ws/manager.py with per-session rooms.
In /ws/feedback, on connect: send {"type":"hello"} to verify wiring.
🧪 Use wscat or a tiny HTML page to receive the hello on connect.
B2 (✅) Open feedback socket from VR
openFeedbackSocket(sessionId) on Start; log messages to console.
🧪 Press Start → console logs {type:"hello"} within 1s.
A3 (✅) Session lifecycle REST
POST /sessions/create → returns session_id, writes meta.json.
POST /sessions/{id}/stop → currently returns {ok:true}.
🧪 Curl both endpoints; check data/sessions/<id>/meta.json exists.
B3 (✅) Session creation on Start
Click Start → call /sessions/create, store sessionId in state.
🧪 Console shows created ID; a folder appears under data/sessions/.

Phase 3 — Audio In Pipe (Parallel)
B4 (✅) Mic capture + chunking
startMic(16000) → beginCapture slices ~160 ms, convert to PCM16, base64 encode.
🧪 Log first payload; check payload.ms ~ 160, bytes_b64 length > 0.
A4 (✅) Audio WS ingest + echo feedback (fake)
/ws/audio accepts audio_chunk; on every Nth message, call manager.broadcast_feedback(...) with fake values {wpm:130, fillers:0, ...}.
🧪 VR HUD receives fake messages; numbers change.
C2 (✅) Implement real analysis primitives
detect_fillers, compute_wpm, pace_label, score_partial; thresholds in config.
🧪 pytest with small word lists: verify counts/labels/scores.

Phase 4 — Real ASR Windows (Integrate)
A5 (✅) Segmentation buffer
RollingBuffer: aggregate chunks to min_ms (e.g., 2000–3000 ms).
🧪 Unit test: append 15×160ms → pop_ready_window(2400) returns ~2560ms.
A6 (✅) ASR adapter (choose one path)
Whisper API: send 2–3s window; parse words with timestamps if available (or approximate evenly if not).
whisper.cpp: run a subprocess on temp WAV; parse output JSON if enabled.
Gemini Speech: similar window-based call.
🧪 Provide a local sample WAV → get plausible words list.
A7 (✅) Wire pipeline: audio → buffer → ASR → analysis → feedback
On new chunk: append; when a window is ready:
ASR → {text, words}
Update rolling totals, compute WPM for total elapsed
Detect fillers in latest window (and rolling window)
Compute score_partial + message
Save to partial_feedback.jsonl and transcript_words.jsonl
broadcast_feedback(...)
🧪 Say “hello hello” into mic: see WPM ~120–150, fillers ~0.

Phase 5 — Stop, Summarize, Show (Integrate)
A8 (✅) Stop/finalize
POST /sessions/{id}/stop: flush pending buffer; build transcript_final.json and summary.json using summarize_session.
🧪 Call Stop → new files appear; summary shows total words, avg WPM, final score.
B5 (✅) VR Stop flow
On Stop: stop mic, call /stop, display score in HUD (or modal panel).
🧪 Try a 20–30s talk; see a final score.
C3 (🧪) Tuning pass
Adjust pace_label thresholds, filler dictionary; use EMA in metrics.js for HUD smoothness.
🧪 Live test: ensure no wild jumps; color transitions feel natural.
D2 (Optional) Mini dashboard
Sessions list → select → show summary cards & transcript.
🧪 Refresh shows your latest session.

Phase 6 — Quest Test & Demo Polish
A9 (✅) Tunnel & headset test
Run scripts/tunnel.sh, open tunneled URL on Meta Quest Browser.
🧪 Start/Stop works from headset; latency acceptable (1–3s per ASR window).
B6 (🧪) Visual polish
Spotlight intensity tied to score_partial; green/yellow/red HUD text.
🧪 Presenters immediately see visual response.
D3 (🧪) Demo script + one-take video
Record 30–45s walk-through: Start → speak → live cues → Stop → final score.
🧪 Keep video under 60s for judge attention.

Checkpoints & tests (quick list)
🧪 /healthz OK (A1)
🧪 WS hello from /ws/feedback (A2/B2)
🧪 Session folder created (A3/B3)
🧪 Mic chunk object shape looks right (B4)
🧪 Fake feedback renders on HUD (A4/B2)
🧪 Segmentation returns window ~2–3s (A5)
🧪 ASR returns words for sample clip (A6)
🧪 Pipeline: speaking updates WPM/score (A7/B4)
🧪 Stop writes summary.json & transcript_final.json (A8/B5)
🧪 Quest run via tunnel feels responsive (A9)
🧪 Polish: HUD color & spotlight respond to score (B6)

 (See <attachments> above for file contents. You may not need to search or read the file again.)
