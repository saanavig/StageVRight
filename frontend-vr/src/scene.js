import VRWebSocket from './ws.js';
// src/scene.js
// Dynamically build the classroom scene using A-Frame from JavaScript
// HUD overlay logic (temporary, can be toggled with 'H')
const hud = document.getElementById('hud-overlay');
const hudPos = document.getElementById('hud-pos');
const hudRot = document.getElementById('hud-rot');
let hudVisible = true;
let wsStatus = 'disconnected';
let wsLastMsg = '';

function updateHUD() {
  const camera = document.querySelector('a-camera, [camera]');
  if (!camera) return;
  const pos = camera.object3D.position;
  const rot = camera.object3D.rotation;
  hudPos.textContent = `x: ${pos.x.toFixed(2)}, y: ${pos.y.toFixed(2)}, z: ${pos.z.toFixed(2)}`;
  hudRot.textContent = `x: ${(rot.x * 57.2958).toFixed(1)}°, y: ${(rot.y * 57.2958).toFixed(1)}°, z: ${(rot.z * 57.2958).toFixed(1)}°`;
  // Show WebSocket status and last message for debugging
  let wsDiv = document.getElementById('hud-ws');
  if (!wsDiv) {
    wsDiv = document.createElement('div');
    wsDiv.id = 'hud-ws';
    hud.appendChild(wsDiv);
  }
  wsDiv.innerHTML = `<b>WS:</b> ${wsStatus}<br><b>Last:</b> ${wsLastMsg}`;
}

// Update HUD every frame
AFRAME.registerComponent('hud-updater', {
  tick: updateHUD
});

// Attach the component to the camera (after scene is loaded)
document.addEventListener('DOMContentLoaded', () => {
  const scene = document.querySelector('a-scene');
  scene.addEventListener('loaded', () => {
    const camera = scene.querySelector('a-camera, [camera]');
    if (camera) camera.setAttribute('hud-updater', '');
  });
});

// Toggle HUD with 'H' key
window.addEventListener('keydown', (e) => {
  if (e.key.toLowerCase() === 'h') {
    hudVisible = !hudVisible;
    hud.style.display = hudVisible ? 'block' : 'none';
  }
});

document.addEventListener('DOMContentLoaded', () => {
  const scene = document.querySelector('a-scene');
  if (!scene) return;

  // Floor
  const floor = document.createElement('a-box');
  floor.setAttribute('position', '0 0 -5');
  floor.setAttribute('width', '8');
  floor.setAttribute('height', '0.1');
  floor.setAttribute('depth', '10');
  floor.setAttribute('color', '#b3e5fc'); // light blue floor
  scene.appendChild(floor);

  // Back Wall
  const backWall = document.createElement('a-box');
  backWall.setAttribute('position', '0 2 -10');
  backWall.setAttribute('width', '8');
  backWall.setAttribute('height', '4');
  backWall.setAttribute('depth', '0.1');
  backWall.setAttribute('color', '#ffe082'); // yellow back wall
  scene.appendChild(backWall);

  // Left Wall
  const leftWall = document.createElement('a-box');
  leftWall.setAttribute('position', '-4 2 -5');
  leftWall.setAttribute('width', '0.1');
  leftWall.setAttribute('height', '4');
  leftWall.setAttribute('depth', '10');
  leftWall.setAttribute('color', '#c8e6c9'); // green left wall
  scene.appendChild(leftWall);

  // Right Wall
  const rightWall = document.createElement('a-box');
  rightWall.setAttribute('position', '4 2 -5');
  rightWall.setAttribute('width', '0.1');
  rightWall.setAttribute('height', '4');
  rightWall.setAttribute('depth', '10');
  rightWall.setAttribute('color', '#ffcdd2'); // pink right wall
  scene.appendChild(rightWall);

  // Blackboard
  const blackboard = document.createElement('a-box');
  blackboard.setAttribute('position', '0 2.5 -9.95');
  blackboard.setAttribute('width', '3');
  blackboard.setAttribute('height', '1');
  blackboard.setAttribute('depth', '0.05');
  blackboard.setAttribute('color', '#222');
  scene.appendChild(blackboard);

  // Podium
  const podium = document.createElement('a-box');
  podium.setAttribute('position', '0 0.3 -8.5');
  podium.setAttribute('width', '0.7');
  podium.setAttribute('height', '0.6');
  podium.setAttribute('depth', '0.5');
  podium.setAttribute('color', '#8d6e63'); // brown
  scene.appendChild(podium);

  // Desks (3 rows, 2 columns)
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 2; col++) {
      const desk = document.createElement('a-box');
      desk.setAttribute('position', `${-1.5 + col * 3} 0.3 ${-6.5 + row * 2}`);
      desk.setAttribute('width', '1.2');
      desk.setAttribute('height', '0.6');
      desk.setAttribute('depth', '0.7');
      desk.setAttribute('color', row % 2 === 0 ? '#fff9c4' : '#ffe0b2'); // alternating yellow/orange
      scene.appendChild(desk);
    }
  }

  // Window (blue rectangle on left wall)
  const windowRect = document.createElement('a-box');
  windowRect.setAttribute('position', '-3.95 2.5 -7');
  windowRect.setAttribute('width', '0.05');
  windowRect.setAttribute('height', '1.2');
  windowRect.setAttribute('depth', '2');
  windowRect.setAttribute('color', '#81d4fa');
  scene.appendChild(windowRect);

  // Sky
  const sky = document.createElement('a-sky');
  sky.setAttribute('color', '#ECECEC');
  scene.appendChild(sky);

  // Label
  const label = document.createElement('a-text');
  label.setAttribute('value', 'Minimal Classroom');
  label.setAttribute('position', '0 3.8 -7');
  label.setAttribute('align', 'center');
  label.setAttribute('color', '#333');
  label.setAttribute('width', '6');
  scene.appendChild(label);

  // Add WASD controls for movement (A-Frame default camera)
  const camera = document.createElement('a-entity');
  camera.setAttribute('camera', '');
  camera.setAttribute('position', '0 1.6 0');
  camera.setAttribute('wasd-controls', 'acceleration: 10');
  camera.setAttribute('look-controls', '');
  scene.appendChild(camera);

  // Example: Add more objects here in the future
  // e.g., addApple(scene);
});

// --- WebSocket connection setup ---
// Use current page protocol/host to build WS URL (works on localhost, LAN, or HTTPS)
const WS_URL = `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.hostname}:8001/ws`;
const ws = new VRWebSocket(WS_URL);

let currentSessionId = null;
let chunkCounter = 0;

ws.onOpen = () => {
  wsStatus = 'connected';
  wsLastMsg = '';
  // Send a test message on connect
  ws.send(JSON.stringify({type: 'test', msg: 'Hello from VR frontend!'}));
};
ws.onClose = () => {
  wsStatus = 'disconnected';
};
ws.onError = () => {
  wsStatus = 'error';
};
ws.onMessage = (msg) => {
  wsLastMsg = msg;
};
ws.connect();

// Optional: Add a button to send a test message
document.addEventListener('DOMContentLoaded', () => {
  // ...existing code...
  // Add test button to HUD
  const btn = document.createElement('button');
  btn.textContent = 'Send WS Test';
  btn.style.marginTop = '8px';
  btn.style.pointerEvents = 'auto';
  btn.onclick = () => {
    ws.send(JSON.stringify({type: 'test', msg: 'Button test message'}));
  };
  hud.appendChild(btn);

  // Add Record Audio button to HUD
  const recBtn = document.createElement('button');
  recBtn.textContent = 'Record Audio Chunk';
  recBtn.style.marginTop = '8px';
  recBtn.style.pointerEvents = 'auto';
  hud.appendChild(recBtn);

  const analyzeBtn = document.createElement('button');
  analyzeBtn.textContent = 'Analyze Session';
  analyzeBtn.style.marginTop = '8px';
  analyzeBtn.style.pointerEvents = 'auto';
  analyzeBtn.disabled = true;
  hud.appendChild(analyzeBtn);

  let mediaRecorder = null;
  let audioChunks = [];

  recBtn.onclick = async () => {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      mediaRecorder.stop();
      recBtn.textContent = 'Record Audio Chunk';
      return;
    }
    // Request mic access
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
      }
      audioChunks = [];
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunks.push(e.data);
      };
      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
        // Send as binary over WebSocket
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
          wsLastMsg = `Chunk ${chunkCounter} sent`;
        } else {
          wsLastMsg = 'WS not connected';
        }
      };
      mediaRecorder.start();
      recBtn.textContent = 'Stop Recording';

    } catch (err) {
      wsLastMsg = 'Mic error: ' + err.message;
    }
  };

  analyzeBtn.onclick = () => {
    if (!currentSessionId || chunkCounter === 0) {
      wsLastMsg = 'No chunks recorded';
      return;
    }
    const payload = {
      type: 'analyze',
      sessionId: currentSessionId,
      chunkCount: chunkCounter
    };
    ws.send(JSON.stringify(payload));
    wsLastMsg = 'Analyze requested';
  };
});
// Example function to add an apple (red sphere)
export function addApple(scene) {
  const apple = document.createElement('a-sphere');
  apple.setAttribute('position', '0 0.5 -7');
  apple.setAttribute('radius', '0.5');
  apple.setAttribute('color', '#e53935');
  scene.appendChild(apple);
}
