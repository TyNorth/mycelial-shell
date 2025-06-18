import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'
import { fileURLToPath } from 'url'

// Manually recreate __dirname for ES module scope
const __dirname = path.dirname(fileURLToPath(import.meta.url))

/**
 * A custom Vite plugin to automatically register this Host with the
 * Mycelial Rendezvous Server when the dev server starts.
 */
const registerHostPlugin = ({ port, hostName }) => {
  return {
    name: 'register-host-plugin',
    configureServer(server) {
      server.httpServer.on('listening', async () => {
        const hostData = {
          hostName: hostName,
          // The public manifest is served at the root of the dev server
          manifestUrl: `http://localhost:${port}/manifest.json`,
        }

        console.log(`\n[HOST-A-PLUGIN] Announcing presence for ${hostData.hostName}...`)

        try {
          await fetch('http://localhost:4000/register-host', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(hostData),
          })
          console.log(`[HOST-A-PLUGIN] ✅ Successfully announced to Rendezvous Server.`)
        } catch (error) {
          console.error(
            `[HOST-A-PLUGIN] ❌ Failed to announce. Is Rendezvous Server running?`,
            error.message,
          )
        }
      })
    },
  }
}

export default defineConfig({
  plugins: [
    vue(),
    // Add the plugin to register Host A
    registerHostPlugin({
      port: 5173,
      hostName: 'MycelialShell-A',
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
  },
})
