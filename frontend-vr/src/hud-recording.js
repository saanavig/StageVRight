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
      updateVrHudText();
      bindControllerInputs(scene);
    });
    scene.addEventListener('exit-vr', () => {
      isVrMode = false;
      if (vrHud) vrHud.setAttribute('visible', false);
    });
    sceneVrEventsBound = true;
    isVrMode = scene.is('vr-mode');
  }

  if (vrHud) {
    vrHud.setAttribute('visible', isVrMode && hudVisible);
    updateVrHudText();
  }

  bindControllerInputs(scene);
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
