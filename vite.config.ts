import { defineConfig } from 'vite'
import { qwikVite } from '@builder.io/qwik/optimizer'
import { saveAnimationPlugin } from './src/studio/saveAnimationPlugin'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    qwikVite({
      csr: true,
    }),
    saveAnimationPlugin(),
  ],
})
