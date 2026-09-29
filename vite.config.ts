import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: { host: '127.0.0.1', strictPort: true, fs: { strict: true } },
  preview: { host: '127.0.0.1', strictPort: true },
  build: {
    rolldownOptions: { output: { codeSplitting: { groups: [
      { name: 'physics', test: /node_modules[\\/]@dimforge[\\/]/ },
      { name: 'graphics', test: /node_modules[\\/]three[\\/]/ },
    ] } } },
  },
});
