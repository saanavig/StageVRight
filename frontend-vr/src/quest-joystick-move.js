// src/quest-joystick-move.js
// A-Frame component: Move the rig using the right controller's thumbstick (Quest, Rift, etc.)
AFRAME.registerComponent('quest-joystick-move', {
  schema: {
    speed: {type: 'number', default: 2.5}
  },
  tick: function (time, delta) {
    const el = this.el;
    const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
    let rightGamepad = null;
    // Try to find the right-hand controller (Oculus/Meta/Quest)
    for (let i = 0; i < gamepads.length; i++) {
      const gp = gamepads[i];
      if (gp && gp.connected && gp.axes && gp.axes.length >= 2) {
        // Prefer hand property if available
        if (gp.hand === 'right') {
          rightGamepad = gp;
          break;
        }
        // Fallback: use first gamepad with axes
        if (!rightGamepad) rightGamepad = gp;
      }
    }
    if (!rightGamepad) return;
    // Debug: log axes
    if (rightGamepad.axes) {
      // Only log if there's movement
      if (Math.abs(rightGamepad.axes[0]) > 0.05 || Math.abs(rightGamepad.axes[1]) > 0.05) {
        console.log('Gamepad axes:', rightGamepad.axes);
      }
    }
    // Axes: [x, y] for thumbstick (may be [2,3] on some devices)
    let x = rightGamepad.axes[0], y = rightGamepad.axes[1];
    // Deadzone
    if (Math.abs(x) < 0.1 && Math.abs(y) < 0.1) return;
    // Move the rig in the direction of the joystick, relative to camera
    const camera = el.querySelector('[camera]');
    if (!camera) return;
    const camObj = camera.object3D;
    const dir = new THREE.Vector3();
    camObj.getWorldDirection(dir);
    dir.y = 0; // Only move horizontally
    dir.normalize();
    // Calculate right vector
    const right = new THREE.Vector3();
    right.crossVectors(dir, new THREE.Vector3(0, 1, 0)).normalize();
    // Movement vector
    const move = new THREE.Vector3();
    move.addScaledVector(dir, -y * this.data.speed * delta / 1000);
    move.addScaledVector(right, x * this.data.speed * delta / 1000);
    // Apply movement to rig
    el.object3D.position.add(move);
  }
});
