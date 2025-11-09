/* ==========================================
   Speak Space VR – Practice Interface
   ========================================== */
import './style.css'

// ensure CSS loads
const routes = ['#session', '#history']
if (!routes.includes(location.hash)) location.hash = '#session'

const appRoot = document.querySelector('#app')
appRoot.innerHTML = `
  <div class="bg"></div>

  <header class="site-hdr center">
    <div class="brand">Speak Space VR</div>
    <div class="mantra" id="mantra" aria-live="polite">Confidence is a habit.</div>

    <nav class="tabs-wrap">
      <ul class="tabs">
        <li><a href="#session" data-link>Session</a></li>
        <li><a href="#history" data-link>History</a></li>
      </ul>
    </nav>
  </header>

  <main id="page"></main>

  <footer class="site-ftr center">
    <small>© ${new Date().getFullYear()} Speak Space VR Practice Platform</small>
  </footer>
`

function $(sel, root = document) {
  return root.querySelector(sel)
}

/* ---------- Mantra rotation ---------- */
const phrases = [
  "Confidence is a habit.",
  "Precision over speed.",
  "Own the pause.",
  "Clarity is kindness.",
  "Steady pace. Strong point.",
  "Breathe. Speak. Lead."
]
let pi = 0
setInterval(() => {
  const m = $('#mantra')
  if (!m) return
  pi = (pi + 1) % phrases.length
  m.classList.remove('fade-in')
  void m.offsetWidth
  m.textContent = phrases[pi]
  m.classList.add('fade-in')
}, 4200)

/* ---------- Session ---------- */
function renderSession() {
  const page = $('#page')

  page.innerHTML = `
    <section class="wrap max-900">
      <div class="card live">
        <div class="live-inner center">
          <div class="live-stage" id="vrPlaceholder">
            <iframe
              src="http://localhost:5174/vr.html"
              title="Speak Space VR scene"
              class="vr-frame"
              allow="xr-spatial-tracking; microphone; fullscreen; accelerometer; gyroscope"
            ></iframe>
          </div>
          <div class="controls">
            <button id="simulateBtn" class="btn ok">View Latest Results</button>
          </div>
        </div>
      </div>

      <div id="resultsWrap" class="card hidden">
        <h2>Speech Analysis Results</h2>
        <p class="score-note">* All scores are rated out of 10 (higher = better)</p>

        <div class="metrics-grid">
          <div class="metric"><span>Fillers</span><strong id="mFillers">0</strong></div>
          <div class="metric"><span>Repetitions</span><strong id="mReps">0</strong></div>
          <div class="metric"><span>Fluency</span><strong id="mFluency">0</strong></div>
          <div class="metric"><span>Clarity</span><strong id="mClarity">0</strong></div>
          <div class="metric"><span>WPM</span><strong id="mWPM">0</strong></div>
          <div class="metric"><span>Overall</span><strong id="mOverall">0</strong></div>
        </div>

        <p class="feedback" id="feedbackSummary"></p>
      </div>
    </section>
  `

  // quick inline style for iframe (can move to style.css)
  const style = document.createElement('style')
  style.textContent = `
    .vr-frame {
      width: 100%;
      height: 100%;
      border: 0;
      border-radius: var(--radius);
    }
    .live-stage { padding: 0; }
  `
  document.head.appendChild(style)

  $('#simulateBtn').addEventListener('click', async () => {
    const btn = $('#simulateBtn')
    btn.disabled = true
    btn.textContent = 'Loading latest results...'

    try {
      // 1️⃣ Fetch session list
      const listRes = await fetch('http://127.0.0.1:8000/sessions/')
      const listData = await listRes.json()
      const files = listData.sessions || []
      if (!files.length) throw new Error('No session JSON files found.')

      // 2️⃣ Sort and get latest
      files.sort()
      const latest = files[files.length - 1]

      // 3️⃣ Fetch latest JSON
      const res = await fetch(`http://127.0.0.1:8000/sessions/${latest}`)
      const data = await res.json()
      const metrics = data.metrics || data

      // 4️⃣ Populate results
      $('#mFillers').textContent = metrics.fillers ?? 0
      $('#mReps').textContent = metrics.repetitions ?? 0
      $('#mFluency').textContent = metrics.fluency_score ?? 0
      $('#mClarity').textContent = metrics.clarity_score ?? 0
      $('#mWPM').textContent = metrics.wpm ?? 0
      $('#mOverall').textContent = metrics.overall_score ?? 0
      $('#feedbackSummary').textContent =
        metrics.feedback_summary || 'Feedback unavailable.'
      $('#resultsWrap').classList.remove('hidden')

      // 5️⃣ Auto-refresh history
      await updateHistoryFromBackend()

    } catch (err) {
      console.error(err)
      alert('⚠️ Unable to load latest session results. Check backend and /sessions/ endpoint.')
    } finally {
      btn.disabled = false
      btn.textContent = 'View Latest Results'
    }
  })
}

/* ---------- Auto-refresh backend history ---------- */
async function updateHistoryFromBackend() {
  try {
    const res = await fetch('http://127.0.0.1:8000/sessions/')
    const data = await res.json()
    const files = data.sessions || []
    if (!files.length) return

    files.sort().reverse()

    const sessions = await Promise.all(
      files.map(async (filename) => {
        const res2 = await fetch(`http://127.0.0.1:8000/sessions/${filename}`)
        const result = await res2.json()
        const metrics = result.metrics || result

        const raw = filename.replace('.json', '')
        const [dateStr, timeStr] = raw.split('_')
        const year = dateStr.slice(0, 4)
        const month = parseInt(dateStr.slice(4, 6), 10)
        const day = parseInt(dateStr.slice(6, 8), 10)
        const formattedTime = `${timeStr.slice(0, 2)}:${timeStr.slice(2, 4)}:${timeStr.slice(4, 6)}`
        const monthName = new Date(year, month - 1).toLocaleString('en-US', { month: 'long' })
        const displayDateTime = `${monthName} ${day}, ${year} ${formattedTime}`

        return {
          date: displayDateTime,
          feedback_summary: metrics.feedback_summary || 'No feedback summary.',
          overall_score: metrics.overall_score ?? '-',
          fluency_score: metrics.fluency_score ?? '-',
          clarity_score: metrics.clarity_score ?? '-',
          wpm: metrics.wpm ?? '-'
        }
      })
    )

    window.latestHistory = sessions
  } catch (err) {
    console.error('Error updating history:', err)
  }
}

/* ---------- Render History tab ---------- */
async function renderHistory() {
  const page = $('#page')
  page.innerHTML = `<section class="wrap center"><p class="muted">Loading session history...</p></section>`

  try {
    const sessions = window.latestHistory || (await updateHistoryFromBackend())
    if (!window.latestHistory || !window.latestHistory.length) {
      page.innerHTML = `<section class="wrap center"><p class="muted">No sessions yet.</p></section>`
      return
    }

    const list = window.latestHistory
      .map(
        (s) => `
        <li class="history-item">
          <div class="minirow">
            <strong>${s.date}</strong>
          </div>

          <div class="feedback-summary">
            <p><em>“${s.feedback_summary || 'No feedback summary available.'}”</em></p>
          </div>

          <div class="metrics-mini">
            <span>🎯 Overall: ${s.overall_score}</span>
            <span>🗣️ Fluency: ${s.fluency_score}</span>
            <span>✨ Clarity: ${s.clarity_score}</span>
            <span>🕐 WPM: ${s.wpm}</span>
          </div>
        </li>`
      )
      .join('')

    page.innerHTML = `
      <section class="wrap">
        <div class="card">
          <ul class="list">${list}</ul>
        </div>
      </section>
    `
  } catch (err) {
    console.error('Error loading history:', err)
    page.innerHTML = `<section class="wrap center"><p class="muted">⚠️ Unable to load session history.</p></section>`
  }
}

/* ---------- Router ---------- */
function render() {
  const hash = location.hash
  document.querySelectorAll('[data-link]').forEach(a =>
    a.classList.toggle('active', a.getAttribute('href') === hash)
  )

  if (hash === '#history') renderHistory()
  else renderSession()
}

window.addEventListener('hashchange', render)
render()