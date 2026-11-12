import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  // GitHub Pages serves this repository under its name, rather than at /.
  base: '/yuanming-persona5-portfolio/',
  plugins: [
    react(),
    babel({ presets: [reactCompilerPreset()] })
  ],
})
