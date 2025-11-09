import VRWebSocket from './ws.js';

const hud = document.getElementById('hud-overlay');
const hudPos = document.getElementById('hud-pos');
const hudRot = document.getElementById('hud-rot');

let hudVisible = true;
let wsStatus = 'disconnected';
let wsLastMsg = '';
let mediaRecorder = null;
let audioChunks = [];
let currentSessionId = null;
let chunkCounter = 0;
let vrHud = null;
let vrHudText = null;
let lastWorldPos = null;
let lastWorldRot = null;
let isVrMode = false;
let sceneVrEventsBound = false;
let rightControllerBound = false;
let leftControllerBound = false;
let recordBtn = null;
let analyzeBtn = null;
let isRecording = false;
let vrRecordPlane = null;
let vrRecordText = null;
let vrAnalyzePlane = null;
let vrAnalyzeText = null;
let teleprompterDom = null;
let teleprompterStyleApplied = false;
let teleprompterTimeout = null;
let teleprompterVr = null;
let teleprompterVrText = null;
let teleprompterVrClose = null;
const TELEPROMPT_DURATION_MS = 25000;
const SAMPLE_SPEECH = `Welcome everyone, and thank you for stepping into SpeakSpaceVR today. I'm excited to show you how immersive rehearsal can sharpen your confidence and timing. As you look around, notice the responsive audience, spatial sound cues, and the live analytics HUD tracking your presence. In a moment, you'll see how we capture audio, send it for AI feedback, and return actionable insights without ever leaving VR. Imagine building your next talk in spaces like these—tailored to your venue, interactive for your team, and always ready for the headset in your bag. Let's breathe in, center ourselves, and dive into the demo together.`;
let teleprompterDismissed = false;

const WS_URL = `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.hostname}:8001/ws`;
const ws = new VRWebSocket(WS_URL);

function sanitizeMessage(message) {
  if (!message) return '';
  return String(message).replace(/\s+/g, ' ').trim();
}

function truncateMessage(message, maxLength = 80) {
  const clean = sanitizeMessage(message);
  if (!clean) return '—';
  return clean.length > maxLength ? `${clean.slice(0, maxLength - 1)}…` : clean;
}

function setHudVisibility(visible) {
  hudVisible = visible;
  if (hud) {
    hud.style.display = visible ? 'block' : 'none';
  }
  if (vrHud) {
    vrHud.setAttribute('visible', visible && isVrMode);
  }
}

function toggleHudVisibility() {
  setHudVisibility(!hudVisible);
}

function setRecordingState(active) {
  isRecording = active;
  if (recordBtn) {
    recordBtn.textContent = active ? 'Stop Recording' : 'Record Audio Chunk';
  }
  if (vrRecordText) {
    vrRecordText.setAttribute('value', active ? 'Stop Recording' : 'Record Audio');
  }
  if (vrRecordPlane) {
    vrRecordPlane.dataset.locked = active ? 'true' : 'false';
    vrRecordPlane.setAttribute('material', active
      ? 'color: #c62828; opacity: 0.9; transparent: true'
      : 'color: #17406f; opacity: 0.85; transparent: true');
  }
  if (active) {
    teleprompterDismissed = false;
    showTeleprompter();
  } else {
    hideTeleprompter();
  }
}

function setAnalyzeEnabled(enabled) {
  if (analyzeBtn) {
    analyzeBtn.disabled = !enabled;
  }
  if (vrAnalyzePlane) {
    vrAnalyzePlane.dataset.locked = enabled ? 'false' : 'true';
    vrAnalyzePlane.setAttribute('material', enabled
      ? 'color: #1b5e20; opacity: 0.88; transparent: true'
      : 'color: #3b3b3b; opacity: 0.6; transparent: true');
  }
  if (vrAnalyzeText) {
    vrAnalyzeText.setAttribute('color', enabled ? '#eaf2ff' : '#9ea7b3');
  }
}

function createVrButton({ id, label, position, width = 1.05, height = 0.18, color = '#17406f', hoverColor = '#2163a5', onClick }) {
  const wrapper = document.createElement('a-entity');
  wrapper.id = id;
  wrapper.setAttribute('position', position);

  const plane = document.createElement('a-plane');
  plane.setAttribute('width', width.toString());
  plane.setAttribute('height', height.toString());
  plane.setAttribute('material', `color: ${color}; opacity: 0.85; transparent: true; roughness: 1; metalness: 0`);
  plane.setAttribute('class', 'pickable');
  plane.dataset.locked = 'false';

  const text = document.createElement('a-text');
  text.setAttribute('value', label);
  text.setAttribute('align', 'center');
  text.setAttribute('color', '#eaf2ff');
  text.setAttribute('width', (width * 1.4).toString());
  text.setAttribute('position', '0 0 0.01');
  text.setAttribute('baseline', 'center');

  wrapper.appendChild(plane);
  wrapper.appendChild(text);

  plane.addEventListener('mouseenter', () => {
    if (plane.dataset.locked === 'true') return;
    plane.setAttribute('material', `color: ${hoverColor}; opacity: 0.95; transparent: true; roughness: 1; metalness: 0`);
  });
  plane.addEventListener('mouseleave', () => {
    if (plane.dataset.locked === 'true') return;
    plane.setAttribute('material', `color: ${color}; opacity: 0.85; transparent: true; roughness: 1; metalness: 0`);
  });
  plane.addEventListener('click', (evt) => {
    evt.stopPropagation();
    if (typeof onClick === 'function') {
      onClick();
    }
  });

  return { wrapper, plane, text };
}

async function handleRecordToggle() {
  if (mediaRecorder && isRecording) {
    mediaRecorder.stop();
    return;
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });

    if (!currentSessionId) {
      currentSessionId = typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `session-${Date.now()}`;
      chunkCounter = 0;
      wsLastMsg = `Session started: ${currentSessionId}`;
      setAnalyzeEnabled(true);
      refreshHudStatus();
    }

    audioChunks = [];
    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) audioChunks.push(event.data);
    };

    mediaRecorder.onstop = () => {
      const recorder = mediaRecorder;
      mediaRecorder = null;
      setRecordingState(false);
      const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });

      if (recorder && recorder.stream) {
        recorder.stream.getTracks().forEach(track => track.stop());
      }

      if (ws.ws && ws.ws.readyState === WebSocket.OPEN) {
        chunkCounter += 1;
        const meta = {
          type: 'chunkMeta',
          sessionId: currentSessionId,
          chunkNumber: chunkCounter,
          mimeType: audioBlob.type,
          size: audioBlob.size
        };
        ws.send(JSON.stringify(meta));
        ws.ws.send(audioBlob);
        wsLastMsg = `Chunk ${chunkCounter} sent (${(audioBlob.size / 1024).toFixed(1)} KB)`;
      } else {
        wsLastMsg = 'WS not connected';
      }
      setAnalyzeEnabled(chunkCounter > 0);
      refreshHudStatus();
    };

    mediaRecorder.start();
    setRecordingState(true);
  } catch (err) {
    wsLastMsg = `Mic error: ${err.message}`;
    setRecordingState(false);
    setAnalyzeEnabled(chunkCounter > 0);
    refreshHudStatus();
  }
}

function handleAnalyzeRequest() {
  if (!currentSessionId || chunkCounter === 0) {
    wsLastMsg = 'No chunks recorded';
    refreshHudStatus();
    return;
  }

  const payload = {
    type: 'analyze',
    sessionId: currentSessionId,
    chunkCount: chunkCounter
  };
  ws.send(JSON.stringify(payload));
  wsLastMsg = 'Analyze requested';
  refreshHudStatus();
}

function refreshHudStatus() {
  if (!hud) return;
  let wsDiv = document.getElementById('hud-ws');
  if (!wsDiv) {
    wsDiv = document.createElement('div');
    wsDiv.id = 'hud-ws';
    wsDiv.style.marginTop = '8px';
    wsDiv.style.fontSize = '11px';
    wsDiv.style.lineHeight = '1.4';
    wsDiv.style.paddingTop = '4px';
    const firstButton = hud.querySelector('button');
    if (firstButton) {
      hud.insertBefore(wsDiv, firstButton);
    } else {
      hud.appendChild(wsDiv);
    }
  }
  wsDiv.innerHTML = `<b>WS:</b> ${wsStatus}<br><b>Last:</b> ${truncateMessage(wsLastMsg)}`;
  updateVrHudText();
}

function updateHUD() {
  if (!hud || !hudPos || !hudRot) return;
  const camera = document.querySelector('#head[camera], a-scene [camera]');
  if (!camera || !camera.object3D) return;

  const pos = camera.object3D.position;
  const rot = camera.object3D.rotation;
  const posText = `x: ${pos.x.toFixed(2)}, y: ${pos.y.toFixed(2)}, z: ${pos.z.toFixed(2)}`;
  const rotText = `x: ${(rot.x * 57.2958).toFixed(1)}°, y: ${(rot.y * 57.2958).toFixed(1)}°, z: ${(rot.z * 57.2958).toFixed(1)}°`;
  hudPos.textContent = posText;
  hudRot.textContent = rotText;
  lastWorldPos = { x: pos.x, y: pos.y, z: pos.z };
  lastWorldRot = { x: rot.x, y: rot.y, z: rot.z };
  refreshHudStatus();
}

AFRAME.registerComponent('hud-updater', {
  tick: updateHUD
});

function updateVrHudText() {
  if (!vrHudText || !lastWorldPos || !lastWorldRot) return;
  const posLine = `Pos  x:${lastWorldPos.x.toFixed(2)} y:${lastWorldPos.y.toFixed(2)} z:${lastWorldPos.z.toFixed(2)}`;
  const rotLine = `Rot  x:${(lastWorldRot.x * 57.2958).toFixed(1)}° y:${(lastWorldRot.y * 57.2958).toFixed(1)}° z:${(lastWorldRot.z * 57.2958).toFixed(1)}°`;
  const wsLine = `WS   ${wsStatus}`;
  const lastLine = `Last ${truncateMessage(wsLastMsg, 60)}`;
  vrHudText.setAttribute('value', `${posLine}\n${rotLine}\n${wsLine}\n${lastLine}`);
}

function attachHudComponent(scene) {
  const attach = () => {
    const camera = scene.querySelector('#head[camera], a-camera, [camera]');
    if (camera && !camera.hasAttribute('hud-updater')) {
      camera.setAttribute('hud-updater', '');
      ensureVrHud(camera, scene);
    }
  };
  if (scene.hasLoaded) {
    attach();
  } else {
    scene.addEventListener('loaded', attach, { once: true });
  }
}

function setupRecordingControls() {
  if (!hud) return;

  if (!recordBtn) {
    recordBtn = document.getElementById('hud-record-btn') || document.createElement('button');
    if (!recordBtn.id) {
      recordBtn.id = 'hud-record-btn';
      recordBtn.textContent = 'Record Audio Chunk';
      hud.appendChild(recordBtn);
    }
    recordBtn.onclick = () => {
      void handleRecordToggle();
    };
  }

  if (!analyzeBtn) {
    analyzeBtn = document.getElementById('hud-analyze-btn') || document.createElement('button');
    if (!analyzeBtn.id) {
      analyzeBtn.id = 'hud-analyze-btn';
      analyzeBtn.textContent = 'Analyze Session';
      hud.appendChild(analyzeBtn);
    }
    analyzeBtn.onclick = () => {
      handleAnalyzeRequest();
    };
  }

  setRecordingState(false);
  setAnalyzeEnabled(chunkCounter > 0);
}

function ensureVrHud(camera, scene) {
  if (!camera) return;
  if (!vrHud) {
    vrHud = document.createElement('a-entity');
    vrHud.id = 'vr-hud';
    vrHud.setAttribute('position', '0 -0.18 -0.7');
    vrHud.setAttribute('scale', '0.34 0.34 0.34');
    vrHud.setAttribute('visible', false);

    const bg = document.createElement('a-plane');
    bg.setAttribute('width', '1.3');
    bg.setAttribute('height', '0.7');
    bg.setAttribute('material', 'color: #071126; opacity: 0.85; transparent: true; roughness: 1; metalness: 0');
    bg.setAttribute('position', '0 0 0');

    const border = document.createElement('a-plane');
    border.setAttribute('width', '1.34');
    border.setAttribute('height', '0.74');
    border.setAttribute('material', 'color: #8ecbff; opacity: 0.2; transparent: true');
    border.setAttribute('position', '0 0 -0.001');

    vrHudText = document.createElement('a-text');
    vrHudText.id = 'vr-hud-text';
    vrHudText.setAttribute('value', 'HUD Ready');
    vrHudText.setAttribute('align', 'left');
    vrHudText.setAttribute('color', '#eaf2ff');
    vrHudText.setAttribute('width', '1.2');
    vrHudText.setAttribute('wrap-count', '28');
    vrHudText.setAttribute('position', '-0.62 0.2 0.01');

    vrHud.appendChild(border);
    vrHud.appendChild(bg);
    vrHud.appendChild(vrHudText);

    const recordButton = createVrButton({
      id: 'vr-record-btn',
      label: 'Record Audio',
      position: '0 -0.18 0.01',
      color: '#17406f',
      hoverColor: '#2163a5',
      onClick: () => {
        void handleRecordToggle();
      }
    });
    vrRecordPlane = recordButton.plane;
    vrRecordText = recordButton.text;
    vrHud.appendChild(recordButton.wrapper);

    const analyzeButton = createVrButton({
      id: 'vr-analyze-btn',
      label: 'Analyze Session',
      position: '0 -0.36 0.01',
      color: '#205a34',
      hoverColor: '#2b7d45',
      onClick: () => {
        handleAnalyzeRequest();
      }
    });
  vrAnalyzePlane = analyzeButton.plane;
  vrAnalyzeText = analyzeButton.text;
  vrHud.appendChild(analyzeButton.wrapper);
    camera.appendChild(vrHud);
    setRecordingState(isRecording);
    setAnalyzeEnabled(chunkCounter > 0);
  }

  if (!sceneVrEventsBound) {
    scene.addEventListener('enter-vr', () => {
      isVrMode = true;
      if (vrHud) vrHud.setAttribute('visible', hudVisible);
      if (teleprompterVr && isRecording) {
        teleprompterVr.setAttribute('visible', true);
      }
      updateVrHudText();
      bindControllerInputs(scene);
    });
    scene.addEventListener('exit-vr', () => {
      isVrMode = false;
      if (vrHud) vrHud.setAttribute('visible', false);
      if (teleprompterVr) teleprompterVr.setAttribute('visible', false);
    });
    sceneVrEventsBound = true;
    isVrMode = scene.is('vr-mode');
  }

  if (vrHud) {
    vrHud.setAttribute('visible', isVrMode && hudVisible);
    updateVrHudText();
  }

  ensureTeleprompterVr(camera);

  bindControllerInputs(scene);
}

function ensureTeleprompterVr(camera) {
  if (!camera || teleprompterVr) return;
  teleprompterVr = document.createElement('a-entity');
  teleprompterVr.id = 'teleprompter-vr';
  teleprompterVr.setAttribute('position', '0 0.2 -1.16');
  teleprompterVr.setAttribute('rotation', '0 -6 0');
  teleprompterVr.setAttribute('scale', '0.42 0.42 0.42');
  teleprompterVr.setAttribute('visible', false);

  const accent = document.createElement('a-plane');
  accent.setAttribute('width', '1.92');
  accent.setAttribute('height', '1.18');
  accent.setAttribute('position', '0 0 -0.03');
  accent.setAttribute('material', 'color: #64bbff; opacity: 0.25; transparent: true; side: double');

  const base = document.createElement('a-plane');
  base.setAttribute('width', '1.86');
  base.setAttribute('height', '1.12');
  base.setAttribute('material', 'color: #031a2e; opacity: 0.92; transparent: true; roughness: 0.25; metalness: 0.05; side: double');

  const headerBar = document.createElement('a-plane');
  headerBar.setAttribute('width', '1.86');
  headerBar.setAttribute('height', '0.22');
  headerBar.setAttribute('position', '0 0.5 0.02');
  headerBar.setAttribute('material', 'color: #0f3c63; opacity: 0.96; transparent: true');

  const headerText = document.createElement('a-text');
  headerText.setAttribute('value', 'Warm-Up Script');
  headerText.setAttribute('align', 'center');
  headerText.setAttribute('color', '#e3f3ff');
  headerText.setAttribute('width', '1.6');
  headerText.setAttribute('position', '0 0.5 0.04');

  teleprompterVrText = document.createElement('a-text');
  teleprompterVrText.id = 'teleprompter-vr-text';
  teleprompterVrText.setAttribute('position', '-0.72 0.09 0.04');
  teleprompterVrText.setAttribute('align', 'left');
  teleprompterVrText.setAttribute('color', '#f1f8ff');
  teleprompterVrText.setAttribute('width', '1.34');
  teleprompterVrText.setAttribute('wrap-count', '32');
  teleprompterVrText.setAttribute('lineHeight', '24');

  const vrMaskTop = document.createElement('a-plane');
  vrMaskTop.setAttribute('width', '1.86');
  vrMaskTop.setAttribute('height', '0.18');
  vrMaskTop.setAttribute('position', '0 0.3 0.045');
  vrMaskTop.setAttribute('material', 'color: #031a2e; opacity: 0.92; transparent: true');

  const vrMaskBottom = document.createElement('a-plane');
  vrMaskBottom.setAttribute('width', '1.86');
  vrMaskBottom.setAttribute('height', '0.16');
  vrMaskBottom.setAttribute('position', '0 -0.38 0.045');
  vrMaskBottom.setAttribute('material', 'color: #031a2e; opacity: 0.92; transparent: true');

  teleprompterVrClose = document.createElement('a-plane');
  teleprompterVrClose.id = 'teleprompter-vr-close';
  teleprompterVrClose.setAttribute('width', '0.2');
  teleprompterVrClose.setAttribute('height', '0.2');
  teleprompterVrClose.setAttribute('position', '0.88 0.5 0.045');
  teleprompterVrClose.setAttribute('material', 'color: #ff6b6b; opacity: 0.88; transparent: true');
  teleprompterVrClose.setAttribute('class', 'pickable');

  const teleprompterVrCloseText = document.createElement('a-text');
  teleprompterVrCloseText.setAttribute('value', 'X');
  teleprompterVrCloseText.setAttribute('align', 'center');
  teleprompterVrCloseText.setAttribute('color', '#ffffff');
  teleprompterVrCloseText.setAttribute('width', '0.5');
  teleprompterVrCloseText.setAttribute('position', '0 0 0.02');
  teleprompterVrCloseText.setAttribute('baseline', 'center');
  teleprompterVrClose.appendChild(teleprompterVrCloseText);

  teleprompterVr.appendChild(accent);
  teleprompterVr.appendChild(base);
  teleprompterVr.appendChild(headerBar);
  teleprompterVr.appendChild(headerText);
  teleprompterVr.appendChild(teleprompterVrText);
  teleprompterVr.appendChild(vrMaskTop);
  teleprompterVr.appendChild(vrMaskBottom);
  teleprompterVr.appendChild(teleprompterVrClose);
  camera.appendChild(teleprompterVr);

  teleprompterVrClose.addEventListener('click', () => {
    teleprompterDismissed = true;
    hideTeleprompter();
  });
  teleprompterVrClose.addEventListener('mouseenter', () => {
    teleprompterVrClose.setAttribute('material', 'color: #ff8585; opacity: 0.95; transparent: true');
  });
  teleprompterVrClose.addEventListener('mouseleave', () => {
    teleprompterVrClose.setAttribute('material', 'color: #ff6b6b; opacity: 0.85; transparent: true');
  });
}

function ensureTeleprompterDom() {
  if (!teleprompterStyleApplied) {
    const style = document.createElement('style');
    style.id = 'teleprompter-style';
  style.textContent = `#teleprompter-overlay{position:fixed;top:12%;left:50%;transform:translateX(-50%);width:min(480px,80vw);padding:20px 26px 24px;border-radius:18px;background:rgba(4,19,33,.82);border:1px solid rgba(132,208,255,.4);box-shadow:0 24px 48px rgba(0,0,0,.45);color:#ecf6ff;font-family:inherit;line-height:1.55;z-index:12;backdrop-filter:blur(6px);opacity:0;pointer-events:none;transition:opacity .25s ease;}#teleprompter-overlay.active{opacity:1;pointer-events:auto;}#teleprompter-overlay h2{margin:0 0 12px;font-size:16px;text-transform:uppercase;letter-spacing:.08em;color:#9ed9ff;}#teleprompter-overlay .teleprompter-close{position:absolute;top:10px;right:12px;width:30px;height:30px;border-radius:50%;border:none;background:rgba(255,107,107,.9);color:#fff;font-size:16px;font-weight:700;cursor:pointer;box-shadow:0 0 12px rgba(255,107,107,.3);}#teleprompter-overlay .teleprompter-scroll{max-height:300px;overflow:hidden;position:relative;}#teleprompter-overlay .teleprompter-text{display:block;font-size:15px;white-space:pre-wrap;transform:translateY(0);animation:teleprompter-scroll 25s linear forwards;padding-right:4px;}#teleprompter-overlay .teleprompter-close:focus{outline:2px solid rgba(255,255,255,.6);}@keyframes teleprompter-scroll{from{transform:translateY(0);}to{transform:translateY(-45%);}}`;
    document.head.appendChild(style);
    teleprompterStyleApplied = true;
  }

  if (!teleprompterDom) {
    teleprompterDom = document.createElement('div');
    teleprompterDom.id = 'teleprompter-overlay';
    teleprompterDom.innerHTML = `<button class="teleprompter-close" aria-label="Dismiss teleprompter">×</button><h2>Warm-Up Script</h2><div class="teleprompter-scroll"><span class="teleprompter-text"></span></div>`;
    document.body.appendChild(teleprompterDom);
    const closeBtn = teleprompterDom.querySelector('.teleprompter-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        teleprompterDismissed = true;
        hideTeleprompter();
      });
    }
  }

  const span = teleprompterDom.querySelector('.teleprompter-text');
  if (span) {
    span.textContent = SAMPLE_SPEECH;
  }
}

function showTeleprompter() {
  if (teleprompterDismissed) return;
  ensureTeleprompterDom();
  if (teleprompterDom) {
    const span = teleprompterDom.querySelector('.teleprompter-text');
    if (span) {
      span.style.animation = 'none';
      // Force reflow so animation restarts
      // eslint-disable-next-line no-unused-expressions
      span.offsetHeight;
      span.style.animation = 'teleprompter-scroll 25s linear forwards';
    }
    teleprompterDom.classList.add('active');
  }

  if (teleprompterVr && teleprompterVrText) {
    teleprompterVrText.setAttribute('value', SAMPLE_SPEECH);
    teleprompterVrText.setAttribute('position', '-0.72 0.09 0.04');
    teleprompterVrText.removeAttribute('animation__scroll');
    teleprompterVrText.setAttribute('animation__scroll', `property: position; from: -0.72 0.09 0.04; to: -0.72 0.27 0.04; dur: ${TELEPROMPT_DURATION_MS}; easing: linear`);
    teleprompterVr.setAttribute('visible', isVrMode);
  }

  clearTimeout(teleprompterTimeout);
  teleprompterTimeout = setTimeout(() => {
    hideTeleprompter();
  }, TELEPROMPT_DURATION_MS);
}

function hideTeleprompter() {
  clearTimeout(teleprompterTimeout);
  teleprompterTimeout = null;
  if (teleprompterDom) {
    teleprompterDom.classList.remove('active');
  }
  if (teleprompterVr) {
    teleprompterVr.setAttribute('visible', false);
    if (teleprompterVrText) {
      teleprompterVrText.removeAttribute('animation__scroll');
    }
  }
}

function bindControllerInputs(scene) {
  const rightHand = document.getElementById('right-controller')
    || scene.querySelector('[laser-controls][hand="right"], [meta-touch-controls][hand="right"], [oculus-touch-controls][hand="right"], [vive-controls][hand="right"]');

  if (rightHand && !rightControllerBound) {
    const handleToggle = () => {
      toggleHudVisibility();
    };
    rightHand.addEventListener('abuttondown', handleToggle);
    rightHand.addEventListener('bbuttondown', handleToggle);
    rightControllerBound = true;

    rightHand.addEventListener('controllerdisconnected', () => {
      rightHand.removeEventListener('abuttondown', handleToggle);
      rightHand.removeEventListener('bbuttondown', handleToggle);
      rightControllerBound = false;
      scene.addEventListener('controllerconnected', () => bindControllerInputs(scene), { once: true });
    }, { once: true });
  }

  const leftHand = document.getElementById('left-controller')
    || scene.querySelector('[laser-controls][hand="left"], [meta-touch-controls][hand="left"], [oculus-touch-controls][hand="left"], [vive-controls][hand="left"]');

  if (leftHand && !leftControllerBound) {
    const handleRecord = () => {
      void handleRecordToggle();
    };
    const handleAnalyze = () => {
      handleAnalyzeRequest();
    };
    leftHand.addEventListener('xbuttondown', handleRecord);
    leftHand.addEventListener('ybuttondown', handleAnalyze);
    leftControllerBound = true;

    leftHand.addEventListener('controllerdisconnected', () => {
      leftHand.removeEventListener('xbuttondown', handleRecord);
      leftHand.removeEventListener('ybuttondown', handleAnalyze);
      leftControllerBound = false;
      scene.addEventListener('controllerconnected', () => bindControllerInputs(scene), { once: true });
    }, { once: true });
  }

  if ((!rightControllerBound || !leftControllerBound)) {
    scene.addEventListener('controllerconnected', () => bindControllerInputs(scene), { once: true });
  }
}

window.addEventListener('keydown', (event) => {
  if (event.key && event.key.toLowerCase() === 'h' && hud) {
    toggleHudVisibility();
  }
});

document.addEventListener('DOMContentLoaded', () => {
  const scene = document.querySelector('a-scene');
  if (scene) {
    attachHudComponent(scene);
  }

  setupRecordingControls();

  ws.onOpen = () => {
    wsStatus = 'connected';
    wsLastMsg = '';
    refreshHudStatus();
    // Send a test heartbeat so backend confirms connection
    ws.send(JSON.stringify({ type: 'test', msg: 'Hello from landing HUD' }));
  };

  ws.onClose = () => {
    wsStatus = 'disconnected';
    refreshHudStatus();
  };

  ws.onError = () => {
    wsStatus = 'error';
    refreshHudStatus();
  };

  ws.onMessage = (msg) => {
    wsLastMsg = msg;
    refreshHudStatus();
  };

  ws.connect();
});
