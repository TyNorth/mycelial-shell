<script setup>
import { reactive, onMounted, onUnmounted, ref, computed } from 'vue'
import * as Y from 'yjs'
import { WebrtcProvider } from 'y-webrtc'
import { assert, ValidationError, verifyContract } from './mycoassert'
import { trails as localTrails } from './naver.js'

// --- Y.js and Shared State Setup (Unchanged) ---
const ydoc = new Y.Doc()
const provider = new WebrtcProvider('mycelial-shell-room', ydoc)
const sharedUsers = ydoc.getArray('users')
if (sharedUsers.length === 0) {
  sharedUsers.push([{ id: 1, name: 'Host User' }])
}
// ---------------------------------------------

// --- NEW: Host Discovery Function (with Polling) ---
let discoveryInterval = null // To hold our setInterval ID

const discoverForeignHosts = async () => {
  console.log('SHELL-A: Polling for other hosts...')
  try {
    const response = await fetch('http://localhost:4000/hosts')
    if (!response.ok) throw new Error('Rendezvous server connection failed.')

    const hosts = await response.json()
    const otherHosts = hosts.filter((h) => h.hostName !== 'MycelialShell-A')

    if (otherHosts.length === 0) {
      console.log('SHELL-A: No other hosts found on this poll.')
      return
    }

    for (const host of otherHosts) {
      const trailPathPrefix = `/foreign/${host.hostName}/`
      // Check if we've already processed this host
      if (Object.keys(foreignTrails.value).some((key) => key.startsWith(trailPathPrefix))) {
        continue // Skip if we already have trails from this host
      }

      console.log(`SHELL-A: New host found! Fetching manifest from ${host.hostName}`)
      const manifestResponse = await fetch(host.manifestUrl)
      const manifest = await manifestResponse.json()

      // Create new trails for the spores in the foreign manifest
      for (const spore of manifest.spores) {
        const trailPath = `${trailPathPrefix}${spore.name}`
        foreignTrails.value[trailPath] = {
          ...spore,
          displayName: `${spore.name} (from ${host.hostName})`,
        }
        console.log(`SHELL-A: Created new foreign trail: ${trailPath}`)
      }
    }
  } catch (error) {
    console.error('SHELL-A: Host discovery poll failed.', error)
  }
}

// --- Mycelial-Naver Service State ---
const activeTrail = ref(null)
const loadedSporeScripts = new Set()
const sporeViewStatus = ref('Initializing Naver...')

const foreignTrails = ref({})

const allAvailableTrails = computed(() => {
  return { ...localTrails, ...foreignTrails.value }
})

// --- The Action Reducer & Navigation Logic ---
const handleDispatch = (action) => {
  console.log(`SHELL: Received dispatch for action: ${action.type}`)
  switch (action.type) {
    case 'USER_REGISTERED':
      sharedUsers.push([action.payload])
      alert(`Notification: User '${action.payload.username}' has been registered.`)
      navigateTo('/')
      break
    case 'NAVIGATE':
      navigateTo(action.payload.path)
      break
    default:
      console.warn(`SHELL: Received an unknown action type: ${action.type}`)
  }
}

// --- The Public Context (CTX) ---
const shellCTX = reactive({
  dispatch: handleDispatch,
  state: { users: sharedUsers },
  utils: { assert, ValidationError },
})

// --- The Naver's Core Function (Upgraded for History API) ---
const navigateTo = async (path, fromPopState = false) => {
  console.log(`NAVER: Navigating to trail: ${path}`)
  const trailConfig = allAvailableTrails.value[path]
  if (!trailConfig) {
    console.error(`NAVER: No trail found for path: ${path}`)
    sporeViewStatus.value = `Error: Trail '${path}' not found.`
    activeTrail.value = null
    return
  }

  try {
    const view = document.getElementById('spore-view')
    if (view) view.innerHTML = ''
    sporeViewStatus.value = `Loading trail: ${path}...`

    if (!loadedSporeScripts.has(trailConfig.name)) {
      await new Promise((resolve, reject) => {
        const script = document.createElement('script')
        script.src = trailConfig.url
        script.onload = resolve
        script.onerror = () => reject(new Error(`Failed to load script for ${trailConfig.name}`))
        document.head.appendChild(script)
      })
      loadedSporeScripts.add(trailConfig.name)
    }

    const sporeModule = window[trailConfig.globalVar]
    if (!sporeModule || !sporeModule.contract)
      throw new Error('Spore module or contract not found.')

    verifyContract(shellCTX, sporeModule.contract)

    if (typeof sporeModule.mount === 'function') {
      sporeModule.mount(view, shellCTX)
      activeTrail.value = trailConfig
      sporeViewStatus.value = ''

      // --- NEW: History API Integration ---
      // Only push a new state if this navigation was NOT triggered
      // by the back/forward buttons themselves.
      if (!fromPopState) {
        // The first argument can be any state object you want to associate with the history entry.
        // The second argument is unused but required by the spec.
        // The third argument is the new URL to display.
        window.history.pushState({ path }, '', path)
      }
      // ------------------------------------
    } else {
      throw new Error('Spore does not have a valid mount function.')
    }
  } catch (error) {
    console.error(`NAVER: Failed to navigate to ${path}.`, error)
    sporeViewStatus.value = `Error loading trail: ${error.message}`
  }
}

// --- NEW: Listener for Browser Back/Forward Buttons ---
const handlePopState = (event) => {
  // When the user clicks back/forward, the `popstate` event fires.
  // The `event.state` will contain the object we pushed earlier.
  console.log('NAVER: Browser back/forward button clicked.', event.state)
  if (event.state && event.state.path) {
    // We call navigateTo again, but pass `true` to prevent an infinite loop of pushState calls.
    navigateTo(event.state.path, true)
  } else {
    // Handle the case where the state is null (e.g., the very first page load)
    navigateTo('/')
  }
}

onMounted(async () => {
  // Add the popstate listener for back/forward buttons
  window.addEventListener('popstate', handlePopState)

  // 1. Do an initial discovery check right away
  await discoverForeignHosts()

  // 2. Start polling for new hosts every 5 seconds
  discoveryInterval = setInterval(discoverForeignHosts, 5000)

  // 3. Navigate to the initial trail based on the URL
  const initialPath = window.location.pathname
  navigateTo(initialPath in allAvailableTrails.value ? initialPath : '/')
})

onUnmounted(() => {
  // Clean up listeners when the component is destroyed
  window.removeEventListener('popstate', handlePopState)
  if (discoveryInterval) {
    clearInterval(discoveryInterval)
  }
})
</script>

<template>
  <div class="shell-container">
    <header class="shell-header">
      <h1 class="shell-title">MycelialShell</h1>
      <!-- We can create a simple nav menu here -->
      <nav class="main-nav">
        <ul>
          <li v-for="(trail, path) in allAvailableTrails" :key="path">
            <a href="#" @click.prevent="navigateTo(path)">
              {{ trail.displayName || trail.name }}
            </a>
          </li>
        </ul>
      </nav>
    </header>

    <main class="main-view">
      <div id="spore-view" class="spore-view-host">
        <p v-if="sporeViewStatus" class="spore-description">{{ sporeViewStatus }}</p>
      </div>
    </main>

    <footer class="shell-footer">
      <p>Mycelial-Naver is orchestrating the user journey.</p>
    </footer>
  </div>
</template>

<style scoped>
/* Styles are the same, but with a new .main-nav style */
.shell-container {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  font-family: Inter, sans-serif;
  background-color: #1a1a1a;
  color: #f0f0f0;
}
.shell-header {
  padding: 1rem 2rem;
  border-bottom: 1px solid #333;
  text-align: center;
}
.shell-title {
  font-size: 1.5rem;
  font-weight: 700;
  color: #a78bfa;
  margin-bottom: 1rem;
}
.main-nav {
  display: flex;
  justify-content: center;
  gap: 1.5rem;
}
.main-nav a {
  color: #c4b5fd;
  text-decoration: none;
  font-weight: 500;
  padding: 0.5rem 1rem;
  border-radius: 0.5rem;
  transition: background-color 0.2s;
}
.main-nav a:hover {
  background-color: #3730a3;
}
.main-view {
  flex-grow: 1;
  padding: 2rem;
  display: flex;
  justify-content: center;
}
.spore-view-host {
  width: 100%;
  max-width: 900px;
}
.spore-description {
  color: #999;
  text-align: center;
  padding-top: 2rem;
}
.shell-footer {
  padding: 1rem 2rem;
  border-top: 1px solid #333;
  text-align: center;
  font-size: 0.8rem;
  color: #666;
}
.app-body {
  display: flex;
  flex-grow: 1;
  overflow: hidden; /* Prevent body scroll */
}

.sidebar {
  width: 250px;
  background-color: #242424;
  border-right: 1px solid #333;
  padding: 1.5rem;
  flex-shrink: 0;
  overflow-y: auto;
}

.sidebar-title {
  font-size: 1.2rem;
  font-weight: 600;
  margin-bottom: 1.5rem;
}

.sidebar ul {
  list-style: none;
  padding: 0;
  margin: 0;
}

.sidebar li a {
  display: block;
  padding: 0.75rem 1rem;
  color: #d1d5db;
  text-decoration: none;
  border-radius: 0.5rem;
  transition: background-color 0.2s;
  word-break: break-word; /* Helps prevent long names from breaking layout */
}

.sidebar li a:hover {
  background-color: #374151;
}
</style>
