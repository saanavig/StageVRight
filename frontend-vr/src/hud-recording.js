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

const WS_URL = `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.hostname}:8001/ws`;
const ws = new VRWebSocket(WS_URL);

function truncateMessage(message) {
  if (!message) return '—';
  return message.length > 80 ? `${message.slice(0, 77)}…` : message;
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
}

function updateHUD() {
  if (!hud || !hudPos || !hudRot) return;
  const camera = document.querySelector('#head[camera], a-scene [camera]');
  if (!camera || !camera.object3D) return;

  const pos = camera.object3D.position;
  const rot = camera.object3D.rotation;
  hudPos.textContent = `x: ${pos.x.toFixed(2)}, y: ${pos.y.toFixed(2)}, z: ${pos.z.toFixed(2)}`;
  hudRot.textContent = `x: ${(rot.x * 57.2958).toFixed(1)}°, y: ${(rot.y * 57.2958).toFixed(1)}°, z: ${(rot.z * 57.2958).toFixed(1)}°`;
  refreshHudStatus();
}

AFRAME.registerComponent('hud-updater', {
  tick: updateHUD
});

function attachHudComponent(scene) {
  const attach = () => {
    const camera = scene.querySelector('#head[camera], a-camera, [camera]');
    if (camera && !camera.hasAttribute('hud-updater')) {
      camera.setAttribute('hud-updater', '');
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

  let recordBtn = document.getElementById('hud-record-btn');
  if (!recordBtn) {
    recordBtn = document.createElement('button');
    recordBtn.id = 'hud-record-btn';
    recordBtn.textContent = 'Record Audio Chunk';
    hud.appendChild(recordBtn);
  }

  let analyzeBtn = document.getElementById('hud-analyze-btn');
  if (!analyzeBtn) {
    analyzeBtn = document.createElement('button');
    analyzeBtn.id = 'hud-analyze-btn';
    analyzeBtn.textContent = 'Analyze Session';
    analyzeBtn.disabled = true;
    hud.appendChild(analyzeBtn);
  }

  recordBtn.onclick = async () => {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      mediaRecorder.stop();
      recordBtn.textContent = 'Record Audio Chunk';
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
        analyzeBtn.disabled = false;
        refreshHudStatus();
      }

      audioChunks = [];
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunks.push(event.data);
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });

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
        refreshHudStatus();
      };

      mediaRecorder.start();
      recordBtn.textContent = 'Stop Recording';
    } catch (err) {
      wsLastMsg = `Mic error: ${err.message}`;
      refreshHudStatus();
    }
  };

  analyzeBtn.onclick = () => {
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
  };
}

window.addEventListener('keydown', (event) => {
  if (event.key && event.key.toLowerCase() === 'h' && hud) {
    hudVisible = !hudVisible;
    hud.style.display = hudVisible ? 'block' : 'none';
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
