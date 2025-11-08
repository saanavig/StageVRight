// src/scene.js
// Dynamically build the classroom scene using A-Frame from JavaScript

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

// Example function to add an apple (red sphere)
export function addApple(scene) {
  const apple = document.createElement('a-sphere');
  apple.setAttribute('position', '0 0.5 -7');
  apple.setAttribute('radius', '0.5');
  apple.setAttribute('color', '#e53935');
  scene.appendChild(apple);
}
