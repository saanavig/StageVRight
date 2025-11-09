# 🪩 Speak Space VR

**Speak Space VR** (formerly *StageFreight*) is a **VR + AI public-speaking coach** that helps users overcome stage fright through immersive simulations and real-time feedback.  
Step into virtual classrooms, auditoriums, or conferences — complete with natural distractions like coughing, fidgeting, and phone buzzes.  
Speak Space VR analyzes your speech patterns to help you build confidence, clarity, and presence.

---

## 🎯 Inspiration

One of us had a research presentation coming up but couldn’t find anyone to practice with.  
Friends and family were busy, and rehearsing alone never felt realistic.  
That sparked an idea — *what if you could simulate an audience that reacts and challenges you, anytime you want?*

---

## 💡 What It Does

Speak Space VR lets you:

- Enter immersive **VR environments** such as classrooms, auditoriums, or meeting rooms  
- Experience **realistic audience reactions** and distractions  
- Get **AI-powered feedback** on pacing, filler words, tone, and clarity  
- Track your speaking progress with **visual analytics** and session history  

---

## ⚙️ Tech Stack

| Layer | Technology | Purpose |
|-------|-------------|----------|
| **Frontend (VR)** | **A-Frame + WebXR + Three.js** | 3D rendering and immersive headset interaction |
| **Frontend (UI)** | **Vanilla JS + Vite** | Lightweight modular interface and routing |
| **Audio Capture** | **MediaRecorder API (Web Audio)** | Capture and send microphone input to backend |
| **Backend (API)** | **Flask (Python)** | REST endpoints and session management |
| **Speech Analysis Engine** | **Deepgram + Whisper + Gemini (LLM)** | Transcription, filler detection, pacing, and tone feedback |
| **Data Storage** | **Local JSON Sessions / SQLite** | Persist session analytics and feedback |
| **Integration Layer** | **CORS + REST Endpoints** | Enable secure frontend-backend communication |
| **VR Assets** | **.glb / .gltf models via Git LFS** | 3D environments for auditorium and hackathon scenes |
| **Version Control** | **Git + Git LFS** | Manage source and large binary assets |
| **Dev Environment** | **Node.js + npm + Vite** | Frontend build tooling and dependency management |

---

## 🧠 Key Features

- 🎭 Realistic **audience motion** and ambient presence  
- 🔊 **Randomized sound distractions** (coughs, sneezes, phones)  
- 🕹️ **Movement controls:** WASD + Q/E + mouse look  
- 📊 **AI feedback metrics:** clarity, fluency, filler count, pacing  
- 💻 **Clean modular architecture** — easy to extend with new VR scenes  
- ☁️ **Local or cloud-ready** deployment with persistent JSON sessions  

---

## 🚀 Setup Instructions

### 1️⃣ Clone the Repository
```bash
git clone https://github.com/<your-username>/SpeakSpaceVR.git
cd SpeakSpaceVR
```

### 2️⃣ Run the Backend
```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python3 -m http.server 8000
```

### 3️⃣ Run the Frontend
```bash
cd ../frontend
npm install
npm run dev
```

### 4️⃣ Visit in Browser
```
http://localhost:8000/auditorium.html
```

---

## 🎧 Demo Controls

| Action | Key |
|--------|-----|
| Move Forward / Back | W / S |
| Strafe Left / Right | A / D |
| Fly Up / Down | E / Q |
| Look Around | Mouse drag |

---

## 🔮 Future Roadmap

- Emotion and gaze detection for personalized feedback.
- AI coach with natural voice guidance.
- Multi-user VR environments for team practice.
- Slide synchronization with live talks.

---

## 👥 Team

- Aditya Dwivedi
- Saanavi G.  
- Arnav D.
- Aprajita S.

---

## 💬 Tagline

> *Practice like it’s real — before it’s real.* 🎙️

---