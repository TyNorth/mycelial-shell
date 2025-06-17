<script setup>
import { reactive, onMounted, ref, watch } from 'vue'
import * as Y from 'yjs'
import { WebrtcProvider } from 'y-webrtc'
// Import everything from our integrated MycoAssert library
import { assert, ValidationError, verifyContract } from './mycoassert'

// --- Y.js Integration ---
const ydoc = new Y.Doc()
const provider = new WebrtcProvider('mycelial-shell-room', ydoc)
const sharedUsers = ydoc.getArray('users')

// A reactive list to hold our dynamically discovered spores.
const discoveredSpores = ref([])

// Initialize the shared state if it's empty
if (sharedUsers.length === 0) {
  sharedUsers.push([{ id: 1, name: 'Host User' }])
}

const handleDispatch = (action) => {
  console.log('SHELL: Received dispatch for action type:', action.type)

  switch (action.type) {
    case 'USER_REGISTERED':
      // We know this action's payload is a new user object.
      // We add it to our shared Y.js array.
      sharedUsers.push([action.payload])
      // Show a confirmation.
      alert(`Notification: New user '${action.payload.username}' has been registered.`)
      break

    // We could add more cases here for other actions in the future
    // case 'USER_DELETED':
    //   // ... logic to remove a user ...
    //   break;

    default:
      console.warn(`SHELL: Received an unknown action type: ${action.type}`)
  }
}

// --- The Shell's Context (CTX) ---
// This remains the same. It's the set of services the Shell offers.
const shellCTX = reactive({
  // The 'dispatch' function is now the primary way for spores to send messages.
  dispatch: handleDispatch,

  // The 'state' object now directly contains our Y.js shared data types.
  state: {
    users: sharedUsers,
  },

  // Utilities are passed through as before.
  utils: {
    assert,
    ValidationError,
  },
})

/**
 * This function is called AFTER a spore's script has been loaded.
 * It handles the verification and mounting logic for a single spore.
 */
const mountSpore = (spore) => {
  try {
    spore.status = `Verifying contract...`

    // The UMD bundle created a global variable (e.g., window.SporeCurrentUser)
    const sporeModule = window[spore.globalVar]

    if (!sporeModule) {
      throw new Error(`Spore did not attach global variable '${spore.globalVar}' to the window.`)
    }
    if (!sporeModule.contract) {
      throw new Error(`Spore did not expose a 'contract' object.`)
    }

    // Use our integrated library to verify the contract against our CTX
    verifyContract(shellCTX, sporeModule.contract)
    console.log(`SHELL: ✅ Contract for '${spore.name}' is valid.`)

    spore.status = `Mounting...`
    if (typeof sporeModule.mount === 'function') {
      const targetElement = document.getElementById(spore.targetId)
      if (targetElement) {
        targetElement.innerHTML = '' // Clear placeholder text
        sporeModule.mount(targetElement, shellCTX)
        spore.status = 'Loaded' // Final success state
      } else {
        throw new Error(`Target element #${spore.targetId} not found.`)
      }
    } else {
      throw new Error(`Spore did not expose a valid mount function.`)
    }
  } catch (error) {
    console.error(`SHELL: ❌ Failed to mount spore '${spore.name}'.`, error)
    spore.status = `Error: ${error.message}`
  }
}

/**
 * This is the main function that kicks off the entire process.
 * It asks the Rendezvous Server who is available and then loads their scripts.
 */
const discoverAndLoadSpores = async () => {
  console.log('SHELL: Discovering available spores from Rendezvous Server...')
  try {
    const response = await fetch('http://localhost:4000/spores')
    if (!response.ok) {
      throw new Error('Could not connect to Rendezvous Server.')
    }
    const sporesFromServer = await response.json()
    console.log(`SHELL: Discovered ${sporesFromServer.length} spore(s).`)

    // Prepare the list for the UI, giving each spore a unique targetId and status
    discoveredSpores.value = sporesFromServer.map((spore, index) => ({
      ...spore,
      targetId: `spore-host-${index}`,
      status: 'Discovered',
    }))
    console.log(`Discovered spores:`, `\n${JSON.stringify(discoveredSpores.value, null, 2)}`)

    if (discoveredSpores.value.length === 0) return

    // Concurrently load all discovered spore scripts
    await Promise.all(
      discoveredSpores.value.map((spore) => {
        return new Promise((resolve, reject) => {
          const script = document.createElement('script')
          script.src = spore.url
          spore.status = 'Loading script...'

          script.onload = () => {
            console.log(`SHELL: Script for ${spore.name} loaded.`)
            // Once the script is loaded, resolve the promise so mounting can begin
            resolve()
          }
          script.onerror = () => {
            spore.status = `Error: Failed to load script from ${spore.url}`
            // Reject so Promise.all knows a script failed
            reject(new Error(spore.status))
          }
          document.head.appendChild(script)
        })
      }),
    )

    // After all scripts have successfully loaded, mount them
    console.log('SHELL: All spore scripts loaded. Now mounting...')
    for (const spore of discoveredSpores.value) {
      mountSpore(spore)
    }
  } catch (error) {
    console.error('SHELL: ❌ Spore discovery failed.', error)
    // You could set a global error status here if needed
  }
}

watch(
  () => shellCTX.state.currentUser,
  (newValue) => {
    console.log(`CurrentUser changed to:`, `\n${JSON.stringify(newValue, null, 2)}`)
  },
  { deep: true },
)

onMounted(() => {
  // When the shell mounts, kick off the discovery process.
  discoverAndLoadSpores()
  console.info(`Shell CTX:`, `\n${JSON.stringify(shellCTX, null, 2)}`)
})
</script>

<template>
  <div class="shell-container">
    <header class="shell-header">
      <h1 class="shell-title">MycelialShell</h1>
      <p class="shell-status">Status: Running</p>
    </header>

    <main class="spore-grid">
      <!-- We use v-for to dynamically create a host for each discovered spore -->
      <div
        v-for="spore in discoveredSpores"
        :key="spore.name"
        :id="spore.targetId"
        class="spore-host"
      >
        <!-- The Spore's content will replace this status text if loading is successful -->
        <p class="spore-description" v-if="spore.status !== 'Loaded'">{{ spore.status }}</p>
      </div>

      <div v-if="!discoveredSpores.length" class="spore-host">
        <p class="spore-description">
          No spores have registered. Please start a spore's preview server.
        </p>
      </div>
    </main>

    <footer class="shell-footer">
      <p>Mycelial Shell Context (CTX) is initialized and ready.</p>
    </footer>
  </div>
</template>

<style scoped>
/* Styles are the same as before */
.shell-container {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  font-family:
    Inter,
    -apple-system,
    BlinkMacSystemFont,
    'Segoe UI',
    Roboto,
    Oxygen,
    Ubuntu,
    Cantarell,
    'Fira Sans',
    'Droid Sans',
    'Helvetica Neue',
    sans-serif;
  background-color: #1a1a1a;
  color: #f0f0f0;
}
.shell-header {
  padding: 1.5rem 2rem;
  border-bottom: 1px solid #333;
  text-align: center;
}
.shell-title {
  font-size: 2rem;
  font-weight: 700;
  color: #a78bfa;
}
.shell-status {
  color: #888;
}
.spore-grid {
  flex-grow: 1;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
  gap: 2rem;
  padding: 2rem;
}
.spore-host {
  border: 2px dashed #444;
  border-radius: 8px;
  padding: 1.5rem;
  background-color: #242424;
  min-height: 400px;
  display: flex;
  flex-direction: column;
  justify-content: center;
}
.spore-description {
  color: #999;
  text-align: center;
}
.shell-footer {
  padding: 1rem 2rem;
  border-top: 1px solid #333;
  text-align: center;
  font-size: 0.8rem;
  color: #666;
}
</style>
