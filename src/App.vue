<script setup>
import { reactive, onMounted, ref, onUnmounted, computed } from 'vue'
import * as Y from 'yjs'
import { WebrtcProvider } from 'y-webrtc'
import { WebsocketProvider } from 'y-websocket'
import { assert, ValidationError, verifyContract } from './mycoassert'

// --- Y.js and CTX setup ---
const ydoc = new Y.Doc()
const webrtcProvider = new WebrtcProvider('mycelial-shell-room', ydoc)
const websocketProvider = new WebsocketProvider('ws://localhost:1234', 'mycelial-shell-room', ydoc)
const sharedUsers = ydoc.getArray('users')

const initializeSharedData = (isSynced) => {
  if (isSynced && ydoc.isLoaded && sharedUsers.length === 0) {
    sharedUsers.push([{ id: 1, username: 'Host User' }])
  }
  websocketProvider.off('sync', initializeSharedData)
}
websocketProvider.on('sync', initializeSharedData)

// --- State for the Shell ---
const discoveredSpores = ref([])
const activeSpore = ref(null)
// REMOVED: loadedSporeScripts is no longer needed as we load fresh every time.
const statusMessage = ref('Connecting to the Mycelial Network...')
const currentUser = ref(null)
const isAuthenticated = computed(() => !!currentUser.value)

const publicSpores = computed(() => discoveredSpores.value.filter((s) => !s.requiresAuth))
const memberSpores = computed(() => discoveredSpores.value.filter((s) => s.requiresAuth))

// --- Dispatch Handler ---
const handleDispatch = (action) => {
  switch (action.type) {
    case 'USER_REGISTERED':
      const newUser = action.payload
      const userExists = sharedUsers.toArray().some((user) => user.username === newUser.username)
      if (!userExists) {
        sharedUsers.push([newUser])
        currentUser.value = newUser
        alert(`Welcome, ${newUser.username}! You now have access to the Secure Portal.`)
        goHome()
      } else {
        alert(`User '${newUser.username}' already exists. Logging you in.`)
        currentUser.value = sharedUsers.toArray().find((user) => user.username === newUser.username)
        goHome()
      }
      break
    default:
      console.warn(`SHELL: Received an unknown action type: ${action.type}`)
  }
}

const shellCTX = reactive({
  dispatch: handleDispatch,
  state: { users: sharedUsers },
  utils: { assert, ValidationError },
})

// --- Spore Launching Logic (Updated for Shell-Managed Unmounting) ---
const launchSpore = async (sporeToLaunch) => {
  if (sporeToLaunch.requiresAuth && !isAuthenticated.value) {
    alert('Please register or log in to access this application.')
    return
  }

  // When launching any spore, we first clear the view.
  const view = document.getElementById('spore-view')
  if (view) view.innerHTML = ''

  console.log(`LAUNCHER: Attempting to launch spore: ${sporeToLaunch.name}`)
  statusMessage.value = `Loading ${sporeToLaunch.name}...`
  activeSpore.value = { ...sporeToLaunch, isLoading: true }

  try {
    // --- FIX: Shell now handles re-initialization by cleaning up and reloading the script ---

    // 1. Find and remove the old script tag to ensure it re-runs
    const oldScript = document.querySelector(`script[src="${sporeToLaunch.url}"]`)
    if (oldScript) {
      oldScript.remove()
    }

    // 2. Delete the old module from the window object to clear its state
    if (window[sporeToLaunch.globalVar]) {
      delete window[sporeToLaunch.globalVar]
    }

    // 3. Load the script fresh every time.
    await new Promise((resolve, reject) => {
      const script = document.createElement('script')
      script.src = sporeToLaunch.url
      script.onload = resolve
      script.onerror = () => reject(new Error(`Failed to load script for ${sporeToLaunch.name}`))
      document.head.appendChild(script)
    })

    const sporeModule = window[sporeToLaunch.globalVar]
    if (!sporeModule || !sporeModule.contract)
      throw new Error('Spore module or contract not found.')

    verifyContract(shellCTX, sporeModule.contract)

    if (typeof sporeModule.mount === 'function') {
      const sporeView = document.getElementById('spore-view')
      if (sporeView) {
        // Clear the "Loading..." message before mounting
        sporeView.innerHTML = ''
        sporeModule.mount(sporeView, shellCTX)
        activeSpore.value.isLoading = false
      } else {
        throw new Error('Spore view host not found.')
      }
    } else {
      throw new Error('Spore does not have a valid mount function.')
    }
  } catch (error) {
    console.error(`LAUNCHER: Failed to launch spore ${sporeToLaunch.name}.`, error)
    statusMessage.value = `Error launching ${sporeToLaunch.name}: ${error.message}`
  }
}

const goHome = () => {
  activeSpore.value = null
  // The shell's only unmount responsibility is to clear the view.
  const view = document.getElementById('spore-view')
  if (view) view.innerHTML = ''
}

const logout = () => {
  currentUser.value = null
  goHome()
}

// --- Discovery Logic (Unchanged) ---
const discoverSpores = async () => {
  try {
    const response = await fetch('http://localhost:4000/spores')
    const sporesFromServer = await response.json()
    discoveredSpores.value = sporesFromServer.map((spore) => {
      const isSecure = spore.name.includes('Portal') || spore.name.includes('Auth')
      return {
        ...spore,
        requiresAuth: isSecure,
        icon: spore.name.includes('Register')
          ? `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" /></svg>`
          : isSecure
            ? `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" /></svg>`
            : `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" /></svg>`,
      }
    })
    statusMessage.value = `Found ${discoveredSpores.value.length} applications.`
  } catch (error) {
    statusMessage.value = 'Could not connect to the Rendezvous Server.'
    console.error(statusMessage.value, error)
  }
}

onMounted(() => {
  discoverSpores()
})

onUnmounted(() => {
  // Clean up connections when the component is destroyed
  webrtcProvider.destroy()
  websocketProvider.destroy()
})
</script>

<template>
  <div class="shell-container">
    <div class="background-animation"></div>

    <header class="shell-header">
      <div class="shell-title-wrapper">
        <svg
          class="shell-logo"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          stroke-width="1.5"
          stroke="currentColor"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M6.75 7.5l3 2.25-3 2.25m4.5 0h3m-9 8.25h13.5A2.25 2.25 0 0021 18V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v12a2.25 2.25 0 002.25 2.25z"
          />
        </svg>
        <h1 class="shell-title">Mycelial Shell</h1>
      </div>

      <div class="shell-controls">
        <button v-if="activeSpore" @click="goHome" class="back-button">← Launcher</button>
        <div v-if="isAuthenticated" class="user-profile">
          <span
            >Welcome, <strong>{{ currentUser.username }}</strong></span
          >
          <button @click="logout" class="logout-button">Logout</button>
        </div>
      </div>
    </header>

    <main class="main-view">
      <div v-if="!activeSpore" class="launcher-view">
        <div class="app-category">
          <h2>Public Apps</h2>
          <div class="launcher-grid">
            <div
              v-for="spore in publicSpores"
              :key="spore.name"
              class="spore-card"
              @click="launchSpore(spore)"
            >
              <div class="spore-icon" v-html="spore.icon"></div>
              <h3>{{ spore.name }}</h3>
              <p>{{ spore.description || 'A Mycelial Spore.' }}</p>
            </div>
          </div>
        </div>

        <div class="app-category">
          <h2>Secure Portal</h2>
          <div class="launcher-grid-wrapper">
            <div v-if="!isAuthenticated" class="locked-overlay">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke-width="1.5"
                stroke="currentColor"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
                />
              </svg>
              <p>Please register to access these applications.</p>
            </div>
            <div class="launcher-grid">
              <div
                v-for="spore in memberSpores"
                :key="spore.name"
                :class="['spore-card', { locked: !isAuthenticated }]"
                @click="launchSpore(spore)"
              >
                <div class="spore-icon" v-html="spore.icon"></div>
                <h3>{{ spore.name }}</h3>
                <p>{{ spore.description || 'A secure Mycelial Spore.' }}</p>
              </div>
            </div>
          </div>
        </div>

        <div v-if="!discoveredSpores.length && statusMessage" class="status-card">
          <p>{{ statusMessage }}</p>
        </div>
      </div>

      <div v-else class="spore-focus-view">
        <div id="spore-view" class="spore-view-host">
          <p v-if="activeSpore.isLoading" class="spore-loading-message">{{ statusMessage }}</p>
        </div>
      </div>
    </main>
  </div>
</template>

<style>
/* Using a global style tag for the background animation */
@keyframes gradient-animation {
  0% {
    background-position: 0% 50%;
  }
  50% {
    background-position: 100% 50%;
  }
  100% {
    background-position: 0% 50%;
  }
}

:root {
  --shell-bg: #111827;
  --card-bg: rgba(31, 41, 55, 0.6); /* Semi-transparent for glassmorphism */
  --border-color: rgba(107, 114, 128, 0.4);
  --text-primary: #f9fafb;
  --text-secondary: #d1d5db;
  --accent-color: #8b5cf6;
  --accent-color-hover: #7c3aed;
  --locked-color: #9ca3af;
}

body {
  margin: 0;
  font-family:
    'Inter',
    -apple-system,
    BlinkMacSystemFont,
    'Segoe UI',
    Roboto,
    Helvetica,
    Arial,
    sans-serif;
  color: var(--text-primary);
  background-color: var(--shell-bg);
}

.background-animation {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: linear-gradient(45deg, #111827, #1e293b, #3730a3, #1e1b4b);
  background-size: 400% 400%;
  animation: gradient-animation 25s ease infinite;
  z-index: -1;
}

.shell-container {
  display: flex;
  flex-direction: column;
  height: 100vh;
  width: 100vw;
}

.shell-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 2.5rem;
  background-color: var(--card-bg);
  backdrop-filter: blur(10px);
  border-bottom: 1px solid var(--border-color);
  flex-shrink: 0;
  z-index: 10;
}

.shell-title-wrapper {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.shell-logo {
  width: 2rem;
  height: 2rem;
  color: var(--accent-color);
}

.shell-title {
  font-size: 1.5rem;
  font-weight: 700;
  margin: 0;
}

.shell-controls {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.user-profile {
  display: flex;
  align-items: center;
  gap: 1rem;
  font-size: 0.9rem;
  background-color: rgba(0, 0, 0, 0.2);
  padding: 0.5rem 1rem;
  border-radius: 999px;
  border: 1px solid var(--border-color);
}

.logout-button,
.back-button {
  background-color: var(--accent-color);
  color: white;
  border: none;
  padding: 0.6rem 1.2rem;
  border-radius: 0.5rem;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 0.2s;
}

.logout-button {
  background-color: transparent;
  border: 1px solid var(--border-color);
}
.logout-button:hover,
.back-button:hover {
  background-color: var(--accent-color-hover);
  border-color: var(--accent-color-hover);
}

.main-view {
  flex-grow: 1;
  padding: 2.5rem;
  overflow-y: auto;
}

.launcher-view .app-category {
  margin-bottom: 3rem;
}
.launcher-view h2 {
  font-size: 1.25rem;
  font-weight: 500;
  color: var(--text-secondary);
  margin-bottom: 1.5rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid var(--border-color);
}

.launcher-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 2rem;
}

.spore-card {
  background-color: var(--card-bg);
  border: 1px solid var(--border-color);
  border-radius: 0.75rem;
  padding: 2rem;
  cursor: pointer;
  transition:
    transform 0.2s ease,
    box-shadow 0.2s ease,
    border-color 0.2s ease;
  backdrop-filter: blur(10px);
  text-align: left;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.spore-card:hover {
  transform: translateY(-8px);
  border-color: var(--accent-color);
  box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.2);
}

.spore-icon {
  width: 3rem;
  height: 3rem;
  color: var(--accent-color);
  margin-bottom: 0.5rem;
}

.spore-card h3 {
  font-size: 1.25rem;
  margin: 0;
  color: var(--text-primary);
}
.spore-card p {
  color: var(--text-secondary);
  font-size: 0.9rem;
  margin: 0;
  flex-grow: 1;
}

.launcher-grid-wrapper {
  position: relative;
}

.locked-overlay {
  position: absolute;
  inset: 0;
  background-color: rgba(17, 24, 39, 0.7);
  backdrop-filter: blur(8px);
  z-index: 5;
  border-radius: 0.75rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  color: var(--text-primary);
  text-align: center;
}

.locked-overlay svg {
  width: 3rem;
  height: 3rem;
}

.spore-card.locked {
  filter: grayscale(1);
  cursor: not-allowed;
  color: var(--locked-color);
}
.spore-card.locked .spore-icon {
  color: var(--locked-color);
}
.spore-card.locked:hover {
  transform: none;
  border-color: var(--border-color);
  box-shadow: none;
}

.status-card {
  grid-column: 1 / -1;
  text-align: center;
  padding: 4rem;
  color: var(--text-secondary);
}

.spore-focus-view,
.spore-view-host {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.spore-loading-message {
  margin: auto;
  font-size: 1.25rem;
  color: var(--text-secondary);
}
</style>
