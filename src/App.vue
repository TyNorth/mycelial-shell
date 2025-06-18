<script setup>
import { reactive, onMounted, ref, computed, onUnmounted } from 'vue'
import * as Y from 'yjs'
import { WebrtcProvider } from 'y-webrtc'
import { assert, ValidationError, verifyContract } from './mycoassert'
import { trails as localTrails } from './naver.js'

// --- Shared State & CTX Setup (Unchanged) ---
const ydoc = new Y.Doc()
const provider = new WebrtcProvider('mycelial-shell-room', ydoc)
const sharedUsers = ydoc.getArray('users')
if (sharedUsers.length === 0) {
  sharedUsers.push([{ id: 1, name: 'Host User' }])
}

const handleDispatch = (action) => {
  console.log(`SHELL-A: Received dispatch for action: ${action.type}`)
  switch (action.type) {
    case 'USER_REGISTERED':
      sharedUsers.push([action.payload])
      alert(`User '${action.payload.username}' registered.`)
      navigateTo('/')
      break
    case 'NAVIGATE':
      navigateTo(action.payload.path)
      break
    default:
      console.warn(`SHELL-A: Unknown action type: ${action.type}`)
  }
}

const shellCTX = reactive({
  dispatch: handleDispatch,
  state: { users: sharedUsers },
  utils: { assert, ValidationError },
})
// ---------------------------------------------

// --- Mycelial-Naver Service State ---
const activeTrail = ref(null)
const loadedSporeScripts = new Set()
const sporeViewStatus = ref('Initializing Naver...')
const foreignTrails = ref({})

const allAvailableTrails = computed(() => {
  return { ...localTrails, ...foreignTrails.value }
})

// --- The Naver's Core Function (Unchanged) ---
const navigateTo = async (path) => {
  console.log(`NAVER: Navigating to trail: ${path}`)
  const trailConfig = allAvailableTrails.value[path]

  if (!trailConfig) {
    console.error(`NAVER: No trail found for path: ${path}`)
    sporeViewStatus.value = `Error: Trail '${path}' not found.`
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
    console.log(`NAVER: ✅ Contract for ${trailConfig.name} is valid.`)

    if (typeof sporeModule.mount === 'function') {
      sporeModule.mount(view, shellCTX)
      activeTrail.value = trailConfig
      sporeViewStatus.value = ''
    } else {
      throw new Error('Spore does not have a valid mount function.')
    }
  } catch (error) {
    console.error(`NAVER: Failed to navigate to ${path}.`, error)
    sporeViewStatus.value = `Error loading trail: ${error.message}`
  }
}

// --- Host Discovery Function (Upgraded with Polling) ---
let discoveryInterval = null // To hold our setInterval ID

const discoverForeignHosts = async () => {
  console.log('SHELL-A: Discovering other hosts...')
  try {
    const response = await fetch('http://localhost:4000/hosts')
    const hosts = await response.json()
    const otherHosts = hosts.filter((h) => h.hostName !== 'MycelialShell-A')

    if (otherHosts.length === 0) {
      console.log('SHELL-A: No other hosts found yet...')
      return
    }

    console.log(`SHELL-A: Found ${otherHosts.length} other host(s).`)

    let updated = false
    for (const host of otherHosts) {
      // Check if we've already processed this host's spores
      const trailPathPrefix = `/foreign/${host.hostName}/`
      const alreadyExists = Object.keys(foreignTrails.value).some((key) =>
        key.startsWith(trailPathPrefix),
      )

      if (!alreadyExists) {
        console.log(`SHELL-A: Fetching manifest from ${host.hostName} at ${host.manifestUrl}`)
        const manifestResponse = await fetch(host.manifestUrl)
        const manifest = await manifestResponse.json()

        for (const spore of manifest.spores) {
          const trailPath = `${trailPathPrefix}${spore.name}`
          foreignTrails.value[trailPath] = {
            ...spore,
            displayName: `${spore.name} (from ${host.hostName})`,
          }
          console.log(`SHELL-A: Created new trail: ${trailPath}`)
          updated = true
        }
      }
    }
    if (updated) {
      console.log('SHELL-A: Foreign trails have been updated.', foreignTrails.value)
    }
  } catch (error) {
    console.error('SHELL-A: Failed to discover foreign hosts.', error)
  }
}

onMounted(async () => {
  // 1. Immediately navigate to our local default trail
  navigateTo('/')

  // 2. Do an initial discovery check
  await discoverForeignHosts()

  // 3. Start polling for new hosts every 5 seconds
  discoveryInterval = setInterval(discoverForeignHosts, 5000)
})

onUnmounted(() => {
  // Clean up the interval when the component is destroyed
  if (discoveryInterval) {
    clearInterval(discoveryInterval)
  }
})
</script>

<template>
  <div class="shell-container">
    <header class="shell-header">
      <h1 class="shell-title">MycelialShell-A</h1>
      <p class="shell-status">Naver Active Trail: {{ activeTrail ? activeTrail.name : 'None' }}</p>
    </header>

    <div class="app-body">
      <!-- Navigation Sidebar -->
      <nav class="sidebar">
        <h2 class="sidebar-title">Available Trails</h2>
        <ul>
          <li v-for="(trail, path) in allAvailableTrails" :key="path">
            <a href="#" @click.prevent="navigateTo(path)">
              {{ trail.displayName || trail.name }}
            </a>
          </li>
        </ul>
      </nav>

      <main class="main-view">
        <!-- The single view area where spores are mounted -->
        <div id="spore-view" class="spore-view-host">
          <p v-if="sporeViewStatus" class="spore-description">{{ sporeViewStatus }}</p>
        </div>
      </main>
    </div>
  </div>
</template>

<style scoped>
/* Styles are the same as before */
.shell-container {
  display: flex;
  flex-direction: column;
  height: 100vh;
  font-family: Inter, sans-serif;
  background-color: #1a1a1a;
  color: #f0f0f0;
}
.shell-header {
  padding: 1rem 2rem;
  border-bottom: 1px solid #333;
  text-align: center;
  flex-shrink: 0;
}
.shell-title {
  font-size: 1.5rem;
  font-weight: 700;
  color: #a78bfa;
}
.shell-status {
  font-size: 0.8rem;
  color: #888;
}
.app-body {
  display: flex;
  flex-grow: 1;
  overflow: hidden;
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
  word-break: break-word;
}
.sidebar li a:hover {
  background-color: #374151;
}
.main-view {
  flex-grow: 1;
  padding: 2rem;
  overflow-y: auto;
}
.spore-view-host {
  width: 100%;
  max-width: 1000px;
  margin: 0 auto;
}
.spore-description {
  color: #999;
  text-align: center;
  padding-top: 2rem;
}
</style>
