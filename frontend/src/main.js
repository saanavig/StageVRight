import './style.css'

/* ==========================================
   VR Stage Ready — Academic • Professional • Clean
   ========================================== */

// ---------- Routes ----------
const routes = ['#environment', '#session', '#history']
if (!routes.includes(location.hash)) location.hash = '#session'

// ---------- App shell ----------
const appRoot = document.querySelector('#app')
appRoot.innerHTML = `
  <div class="bg"></div>

  <header class="site-hdr center">
    <div class="brand">VR Stage Ready</div>
    <p class="caption">A rigorous practice space for confident, clear speaking.</p>
    <div class="mantra" id="mantra" aria-live="polite">Breathe. Speak. Lead.</div>

    <nav class="tabs-wrap">
      <ul class="tabs">
        <li><a href="#environment" data-link>Environment</a></li>
        <li><a href="#session" data-link>Session</a></li>
        <li><a href="#history" data-link>History</a></li>
      </ul>
    </nav>
  </header>

  <main id="page"></main>

  <footer class="site-ftr center">
    <small>© ${new Date().getFullYear()} VR Stage Ready</small>
  </footer>
`

// ---------- Constants you asked for ----------
const SCENES = [
  { name: 'Classroom',        icon: '📚', color: 'periw' },
  { name: 'Conference Room',  icon: '💼', color: 'olive' },
  { name: 'Auditorium',       icon: '🎭', color: 'peach' },
  { name: 'Lecture Hall',     icon: '📖', color: 'sky' },
  { name: 'TED Stage',        icon: '🎤', color: 'gold' },
  { name: 'Boardroom',        icon: '🏢', color: 'paprika' },
  { name: 'Outdoor Park',     icon: '🌳', color: 'lime' },
  { name: 'Virtual Meeting',  icon: '💻', color: 'lav' },
  { name: 'Casual',           icon: '☕', color: 'rose' },        // new per your note
  { name: 'Lab/Studio',       icon: '🔬', color: 'mint' }         // new per your note
]

// pick 10 audience types from your lists (balanced mix)
const AUDIENCE_TYPES = [
  'Corporate/Business',
  'Conference',
  'Board Members',
  'Interview Panel',
  'Sales Pitch',
  'Thesis Defense',
  'Seminar',
  'General Public',
  'Technical/Expert',
  'Skeptical/Critical'
]

// ---------- State ----------
const DEFAULT_METRICS = {
  "Words Per Minute (WPM)": true,
  "Filler Word Count": true,
  "Pause Count / Duration": true,
  "Repetition Frequency": true,
  "Confidence Score (0–1 or 1–10)": true,
  "Speaking Duration (seconds)": true,
  "Tone": true,
  "Energy Level (1–10)": true,
  "Clarity Score (1–10)": true,
  "Fluency Score (1–10)": true,
  "Overall Score (1–10)": true,
  "Feedback Summary": true
}

const state = {
  env: {
    scene: null,
    audience: 'Corporate/Business',   // sensible default from your new list
    distractions: 20,
    mouthDistractions: 10
  },
  metricsEnabled: copy(DEFAULT_METRICS),
  session: { status: 'Ready', timer: null, startedAt: 0, pausedAt: 0, elapsedMs: 0, _pauseStart: 0 },
  history: []
}

// LocalStorage for history + metric prefs
const LS_HIST = 'vr_stage_ready_history_v3'
const LS_PREF = 'vr_stage_ready_metric_prefs_v1'
function load(k, d){ try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d } catch { return d } }
function save(k, v){ localStorage.setItem(k, JSON.stringify(v)) }

state.history = load(LS_HIST, [])
state.metricsEnabled = assign(copy(DEFAULT_METRICS), load(LS_PREF, {}))

// ---------- Utilities ----------
function $(sel, root){ return (root || document).querySelector(sel) }
function fmt(ms){
  const s = Math.floor(ms / 1000)
  const m = String(Math.floor(s / 60)).padStart(2, '0')
  const ss = String(s % 60).padStart(2, '0')
  return `${m}:${ss}`
}
function stopSessionTimer(){
  if (state.session && state.session.timer){
    cancelAnimationFrame(state.session.timer)
    state.session.timer = null
  }
}
function copy(obj){ return JSON.parse(JSON.stringify(obj)) }
function assign(a,b){ for(const k in b){ a[k]=b[k] } return a }

// ---------- Header motivation rotation ----------
const phrases = [
  "Breathe. Speak. Lead.",
  "Precision over speed.",
  "Own the pause.",
  "Clarity is kindness.",
  "Steady pace. Strong point.",
  "Confidence is a habit."
]
let pi = 0
setInterval(()=>{
  const m = $('#mantra')
  if (!m) return
  pi = (pi + 1) % phrases.length
  m.classList.remove('fade-in')
  void m.offsetWidth
  m.textContent = phrases[pi]
  m.classList.add('fade-in')
}, 4200)

// ---------- Pages ----------
function renderEnvironment() {
  const page = $('#page')
  if (!page) return
  const metricKeys = Object.keys(state.metricsEnabled)

  page.innerHTML = `
    <section class="env-wrap">
      <div class="env-container">
        <h2 class="env-title">Environment</h2>
        <p class="env-lead">Select context, controls, and the metrics you wish to display.</p>

        <div class="env-section">
          <h3 class="section-label">Scene</h3>
          <div class="scene-grid" id="sceneChips">
            ${SCENES.map(s => `
              <button type="button" class="scene-card ${state.env.scene===s.name? 'active':''}" data-scene="${s.name}" data-color="${s.color}">
                <span class="scene-icon">${s.icon}</span>
                <span class="scene-name">${s.name}</span>
              </button>
            `).join('')}
          </div>
        </div>

        <div class="env-grid">
          <div class="env-card audience-card">
            <h3 class="section-label">Audience Type</h3>
            <div class="radio-list" id="audienceGrid">
              ${AUDIENCE_TYPES.map(a => `
                <label class="radio-opt">
                  <input type="radio" name="audience" value="${a}" ${state.env.audience===a?'checked':''}/>
                  <span class="radio-label">${a}</span>
                </label>`).join('')}
            </div>
          </div>

          <div class="env-card distract-card">
            <h3 class="section-label">Distractions</h3>
            <label class="slider-ctrl">
              <span class="slider-label">Room Distractions</span>
              <div class="slider-wrap">
                <input type="range" min="0" max="100" value="${state.env.distractions}" id="roomDistr"/>
                <output class="slider-val">${state.env.distractions}%</output>
              </div>
            </label>
            <label class="slider-ctrl">
              <span class="slider-label">Mouth / Background Noise</span>
              <div class="slider-wrap">
                <input type="range" min="0" max="100" value="${state.env.mouthDistractions}" id="mouthDistr"/>
                <output class="slider-val">${state.env.mouthDistractions}%</output>
              </div>
            </label>
          </div>
        </div>

        <div class="metrics-section">
          <h3 class="section-label">Metrics to Display</h3>
          <p class="metrics-desc">Check or uncheck to control what appears during the session. (No informal names.)</p>
          <ul class="metrics-list" id="metricGrid">
            ${metricKeys.map(k => `
              <li class="metric-item">
                <label class="metric-check">
                  <input type="checkbox" data-metric="${k}" ${state.metricsEnabled[k] ? 'checked' : ''}/>
                  <span class="metric-name">${k}</span>
                </label>
              </li>
            `).join('')}
          </ul>
        </div>
      </div>
    </section>
  `

  const chips = $('#sceneChips')
  if (chips){
    chips.addEventListener('click', (e) => {
      const btn = e.target.closest ? e.target.closest('button[data-scene]') : null
      if (!btn) return
      state.env.scene = btn.getAttribute('data-scene')
      const cards = chips.querySelectorAll('.scene-card')
      for (let i=0;i<cards.length;i++){
        cards[i].classList.toggle('active', cards[i] === btn)
      }
    })
  }

  const audienceGrid = $('#audienceGrid')
  if (audienceGrid){
    audienceGrid.addEventListener('change', (e) => {
      if (e.target && e.target.name === 'audience') state.env.audience = e.target.value
    })
  }

  const room = $('#roomDistr')
  if (room){
    const roomOut = room.nextElementSibling
    room.addEventListener('input', () => {
      if (roomOut) roomOut.textContent = room.value + '%'
      state.env.distractions = +room.value
    })
  }

  const mouth = $('#mouthDistr')
  if (mouth){
    const mouthOut = mouth.nextElementSibling
    mouth.addEventListener('input', () => {
      if (mouthOut) mouthOut.textContent = mouth.value + '%'
      state.env.mouthDistractions = +mouth.value
    })
  }

  const metricGrid = $('#metricGrid')
  if (metricGrid){
    metricGrid.addEventListener('change', (e)=>{
      const m = e.target ? e.target.getAttribute('data-metric') : null
      if (!m) return
      state.metricsEnabled[m] = e.target.checked
      save(LS_PREF, state.metricsEnabled)
    })
  }
}

function metricVisible(label){
  return !!state.metricsEnabled[label]
}

function renderSession() {
  const page = $('#page')
  if (!page) return

  stopSessionTimer()

  page.innerHTML = `
    <section class="wrap center">
      <article class="card max-900">
        <h2>Session</h2>

        <div class="live">
          <div class="live-inner">
            <div class="live-badge">Live Preview</div>
            <div class="live-stage">
              <div class="live-msg">VR feed area — coming soon</div>
            </div>
            <p class="live-note">This space will show your VR scene in real time. (No camera connected.)</p>
          </div>
        </div>

        <div class="bar center">
          <span class="pill" id="sessStatus">${state.session.status}</span>
          <span class="mono" id="sessTime">00:00</span>
        </div>

        <div class="controls center">
          <button id="start" class="btn ok">Start</button>
          <button id="pause" class="btn" disabled>Pause</button>
          <button id="resume" class="btn" disabled>Resume</button>
          <button id="end" class="btn danger" disabled>End & Save</button>
        </div>

        <h3 class="metrics-title">Live Metrics</h3>
        <div class="metrics" id="metrics">
          <div class="metric" data-l="Words Per Minute (WPM)"><span>Words Per Minute (WPM)</span><strong id="mWpm">0</strong></div>
          <div class="metric" data-l="Filler Word Count"><span>Filler Word Count</span><strong id="mFillers">0</strong></div>
          <div class="metric" data-l="Pause Count / Duration"><span>Pause Count / Duration</span><strong id="mPauses">0</strong></div>
          <div class="metric" data-l="Repetition Frequency"><span>Repetition Frequency</span><strong id="mRepeat">0</strong></div>
          <div class="metric" data-l="Confidence Score (0–1 or 1–10)"><span>Confidence Score (0–1 or 1–10)</span><strong id="mConf">0</strong></div>
          <div class="metric" data-l="Speaking Duration (seconds)"><span>Speaking Duration (seconds)</span><strong id="mDur">00:00</strong></div>
          <div class="metric" data-l="Tone"><span>Tone</span><strong id="mTone">—</strong></div>
          <div class="metric" data-l="Energy Level (1–10)"><span>Energy Level (1–10)</span><strong id="mEnergy">—</strong></div>
          <div class="metric" data-l="Clarity Score (1–10)"><span>Clarity Score (1–10)</span><strong id="mClarity">—</strong></div>
          <div class="metric" data-l="Fluency Score (1–10)"><span>Fluency Score (1–10)</span><strong id="mFluency">—</strong></div>
          <div class="metric" data-l="Overall Score (1–10)"><span>Overall Score (1–10)</span><strong id="mOverall">—</strong></div>
          <div class="metric metric-wide" data-l="Feedback Summary"><span>Feedback Summary</span><strong id="mSummary">—</strong></div>
        </div>
      </article>
    </section>
  `

  applyMetricVisibility()

  const statusEl = $('#sessStatus'), timeEl = $('#sessTime')
  const startBtn = $('#start'), pauseBtn = $('#pause'), resumeBtn = $('#resume'), endBtn = $('#end')

  function setStatus(t){
    state.session.status = t
    if (statusEl) statusEl.textContent = t
  }

  const tonePool = ['calm','confident','focused','neutral']
  function bump(el){ if(!el) return; el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump') }

  function paintLive(now){
    const elapsed = now - state.session.startedAt - state.session.pausedAt
    state.session.elapsedMs = elapsed

    const durEl = $('#mDur')
    if (durEl) durEl.textContent = fmt(elapsed)
    if (timeEl) timeEl.textContent = fmt(elapsed)

    const words = Math.floor(elapsed/1000) * 2 + Math.floor(Math.random()*2)
    const pauses = Math.floor(elapsed/8000)
    const fillers = Math.floor(elapsed/7000)
    const repeat = Math.floor(elapsed/9000)
    const wpm = Math.max(80, Math.min(180, Math.round(words / (elapsed/60000 || 1))))
    const conf = Math.max(40, Math.min(98, Math.round(65 + (words/40) - fillers*1.2 - pauses*0.5)))

    const wpmEl = $('#mWpm'), fillEl = $('#mFillers'), pauseEl = $('#mPauses'), repEl = $('#mRepeat'), confEl = $('#mConf')
    if (wpmEl) { wpmEl.textContent = wpm; bump(wpmEl) }
    if (fillEl) { fillEl.textContent = fillers; bump(fillEl) }
    if (pauseEl){ pauseEl.textContent = pauses; bump(pauseEl) }
    if (repEl)  { repEl.textContent = repeat; bump(repEl) }
    if (confEl) { confEl.textContent = conf; bump(confEl) }

    const toneEl = $('#mTone'), energyEl = $('#mEnergy'), clarityEl = $('#mClarity'), fluEl = $('#mFluency'), overallEl = $('#mOverall'), sumEl = $('#mSummary')
    if (toneEl)   toneEl.textContent   = tonePool[Math.floor((elapsed/5000)%tonePool.length)]
    if (energyEl) energyEl.textContent = String(Math.min(10, 5 + Math.floor((wpm-90)/18)))
    if (clarityEl)clarityEl.textContent= String(Math.min(10, 6 + Math.max(0, 10 - fillers - repeat)))
    if (fluEl)    fluEl.textContent    = String(Math.min(10, 6 + Math.max(0, 10 - fillers - pauses)))
    const clarityNum = clarityEl ? +clarityEl.textContent : 0
    const fluNum = fluEl ? +fluEl.textContent : 0
    if (overallEl)overallEl.textContent= String(Math.min(10, Math.round((conf/10 + clarityNum + fluNum)/3)))
    if (sumEl)    sumEl.textContent    = conf < 70 ? 'Slow slightly and reduce filler words.' : 'Good pace. Keep pauses intentional.'

    state.session.timer = requestAnimationFrame(paintLive)
  }

  startBtn.onclick = () => {
    stopSessionTimer()
    startBtn.disabled = true; pauseBtn.disabled = false; endBtn.disabled = true; resumeBtn.disabled = true
    setStatus('Recording')
    state.session.startedAt = performance.now()
    state.session.pausedAt = 0
    state.session.elapsedMs = 0
    state.session.timer = requestAnimationFrame(paintLive)
    setTimeout(() => { endBtn.disabled = false }, 1200)
  }

  pauseBtn.onclick = () => {
    if (!state.session.timer) return
    stopSessionTimer()
    setStatus('Paused')
    state.session._pauseStart = performance.now()
    pauseBtn.disabled = true; resumeBtn.disabled = false
  }

  resumeBtn.onclick = () => {
    if (state.session.timer) return
    setStatus('Recording')
    const pauseDelta = performance.now() - (state.session._pauseStart || performance.now())
    state.session.pausedAt += pauseDelta
    state.session.timer = requestAnimationFrame(paintLive)
    pauseBtn.disabled = false; resumeBtn.disabled = true
  }

  endBtn.onclick = () => {
    stopSessionTimer()
    setStatus('Ended')
    startBtn.disabled = false; pauseBtn.disabled = true; resumeBtn.disabled = true; endBtn.disabled = true

    function pick(id, label){
      if (!metricVisible(label)) return null
      const el = $(id)
      return el ? el.textContent : null
    }

    const sess = {
      ts: new Date().toISOString(),
      env: state.env.scene || 'Unspecified',
      audience: state.env.audience,
      distractions: state.env.distractions,
      duration: pick('#mDur','Speaking Duration (seconds)'),
      wpm: + (pick('#mWpm','Words Per Minute (WPM)') || 0),
      confidence: + (pick('#mConf','Confidence Score (0–1 or 1–10)') || 0),
      fillers: + (pick('#mFillers','Filler Word Count') || 0),
      pauses: + (pick('#mPauses','Pause Count / Duration') || 0),
      repetitions: + (pick('#mRepeat','Repetition Frequency') || 0),
      tone: pick('#mTone','Tone'),
      energy: pick('#mEnergy','Energy Level (1–10)'),
      clarity: pick('#mClarity','Clarity Score (1–10)'),
      fluency: pick('#mFluency','Fluency Score (1–10)'),
      overall: pick('#mOverall','Overall Score (1–10)'),
      summary: pick('#mSummary','Feedback Summary')
    }
    state.history.unshift(sess)
    save(LS_HIST, state.history)
    alert('Session saved.')
  }
}

function applyMetricVisibility(){
  const cards = document.querySelectorAll('[data-l]')
  for (let i=0;i<cards.length;i++){
    const card = cards[i]
    const label = card.getAttribute('data-l') || ''
    if (state.metricsEnabled[label]) card.classList.remove('hidden')
    else card.classList.add('hidden')
  }
}

function renderHistory() {
  const page = $('#page')
  if (!page) return

  page.innerHTML = `
    <section class="wrap center">
      <article class="card max-900">
        <h2>History</h2>

        <details class="history" open>
          <summary>Recent Sessions</summary>
          <ul class="list">
            ${
              state.history.slice(0,12).map(s => `
                <li>
                  <div class="minirow">
                    <span class="mono">${new Date(s.ts).toLocaleString()}</span>
                    <span class="pill">${s.env}</span>
                  </div>
                  <div class="minirow muted wrap-row">
                    ${s.audience ? `<span>Audience: ${s.audience}</span>`:''}
                    <span>Distractions: ${s.distractions}%</span>
                    ${s.duration ? `<span>Duration: ${s.duration}</span>`:''}
                    ${s.wpm ? `<span>Words Per Minute (WPM): ${s.wpm}</span>`:''}
                    ${s.fillers!==null ? `<span>Filler Word Count: ${s.fillers}</span>`:''}
                    ${s.pauses!==null ? `<span>Pause Count / Duration: ${s.pauses}</span>`:''}
                    ${s.repetitions!==null ? `<span>Repetition Frequency: ${s.repetitions}</span>`:''}
                    ${s.confidence ? `<span>Confidence Score (0–1 or 1–10): ${s.confidence}</span>`:''}
                    ${s.tone ? `<span>Tone: ${s.tone}</span>`:''}
                    ${s.energy ? `<span>Energy Level (1–10): ${s.energy}</span>`:''}
                    ${s.clarity ? `<span>Clarity Score (1–10): ${s.clarity}</span>`:''}
                    ${s.fluency ? `<span>Fluency Score (1–10): ${s.fluency}</span>`:''}
                    ${s.overall ? `<span>Overall Score (1–10): ${s.overall}</span>`:''}
                  </div>
                  ${s.summary ? `<div class="minirow summary"><em>${s.summary}</em></div>`:''}
                </li>
              `).join('') || '<li class="muted">No sessions yet.</li>'
            }
          </ul>
        </details>

        <div class="row-end">
          <button class="btn ghost" id="export">Export JSON</button>
          <button class="btn" id="reset">Reset Data</button>
        </div>
      </article>
    </section>
  `

  const resetBtn = $('#reset')
  if (resetBtn) {
    resetBtn.onclick = () => {
      if (!confirm('Clear all saved sessions?')) return
      state.history = []
      save(LS_HIST, state.history)
      render()
    }
  }

  const exportBtn = $('#export')
  if (exportBtn) {
    exportBtn.onclick = () => {
      const blob = new Blob([JSON.stringify(state.history, null, 2)], {type:'application/json'})
      const a = document.createElement('a')
      const url = URL.createObjectURL(blob)
      a.href = url
      a.download = 'vr-stage-ready-history.json'
      document.body.appendChild(a)
      a.click()
      a.remove()
      setTimeout(function(){ URL.revokeObjectURL(url) }, 0)
    }
  }
}

// ---------- Router ----------
function render() {
  const hash = location.hash
  stopSessionTimer()

  const links = document.querySelectorAll('[data-link]')
  for (let i=0;i<links.length;i++){
    const a = links[i]
    a.classList.toggle('active', a.getAttribute('href') === hash)
  }

  if (hash === '#environment') renderEnvironment()
  else if (hash === '#history') renderHistory()
  else renderSession()
}

window.addEventListener('hashchange', render)
render()
