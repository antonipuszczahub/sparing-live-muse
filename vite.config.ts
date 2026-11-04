import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// The server's port. A second copy of the app (another checkout, another port) points the proxy at its own server with API_PORT.
const api = process.env.API_PORT ?? '8787';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    // `npm run phone` shares this dev server inside the owner's Tailscale network under a *.ts.net name over HTTPS
    // (a phone needs HTTPS for the microphone). Vite refuses unknown host names by default, so allow that suffix.
    allowedHosts: ['.ts.net'],
    proxy: {
      '/api': `http://localhost:${api}`,
      '/ws': { target: `ws://localhost:${api}`, ws: true },
    },
  },
});
