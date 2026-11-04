import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    // `npm run phone` shares this dev server inside the owner's Tailscale network under a *.ts.net name over HTTPS
    // (a phone needs HTTPS for the microphone). Vite refuses unknown host names by default, so allow that suffix.
    allowedHosts: ['.ts.net'],
    proxy: {
      '/api': 'http://localhost:8787',
      '/ws': { target: 'ws://localhost:8787', ws: true },
    },
  },
});
