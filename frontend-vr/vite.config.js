import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    host: true, // Listen on all addresses, including LAN and tunnels
    allowedHosts: [
      'all',
      'nondeterminable-affectionately-deena.ngrok-free.dev',
    ], // Explicitly allow ngrok host
  },
});
