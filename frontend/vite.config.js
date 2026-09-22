import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { copyFileSync, mkdirSync, existsSync } from 'fs'
import { resolve } from 'path'

function copyNeutralinoJS() {
  return {
    name: 'copy-neutralino-js',
    writeBundle() {
      const sourcePath = resolve(__dirname, '../resources/js/neutralino.js')
      const targetDir = resolve(__dirname, 'dist/js')
      const targetPath = resolve(targetDir, 'neutralino.js')

      if (existsSync(sourcePath)) {
        mkdirSync(targetDir, { recursive: true })
        copyFileSync(sourcePath, targetPath)
        console.log('Copied neutralino.js to dist/js/')
      }
    }
  }
}

export default defineConfig({
  base: './',
  plugins: [react(), copyNeutralinoJS()],
})