import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import obfuscator from 'rollup-plugin-obfuscator';

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    obfuscator({
      global: false, // Apply only to local files, not node_modules (usually safer)
      options: {
        compact: true,
        controlFlowFlattening: true,
        controlFlowFlatteningThreshold: 0.75,
        deadCodeInjection: true,
        deadCodeInjectionThreshold: 0.4,
        debugProtection: true,
        debugProtectionInterval: 2000,
        disableConsoleOutput: true,
        identifierNamesGenerator: 'hexadecimal',
        log: false,
        renameGlobals: false,
        rotateStringArray: true,
        selfDefending: true,
        stringArray: true,
        stringArrayEncoding: ['rc4'],
        stringArrayThreshold: 0.75,
        unicodeEscapeSequence: false
      },
    }),
  ],
  build: {
    minify: 'esbuild', // Use esbuild for standard minification
    sourcemap: false, // Disable sourcemaps to prevent code inspection
  }
})
