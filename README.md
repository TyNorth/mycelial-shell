# **The Mycelial Framework**

### **A Federated, Decoupled Micro-Frontend Architecture**

This project is a complete, working proof-of-concept for the Mycelial framework, a dynamic and resilient architecture for building an interconnected "web of apps."

The core philosophy is to move beyond monolithic applications by composing a user experience from independent, dynamically discovered "Spores" (micro-apps) that run within a host "Shell." The Shell provides a shared set of services and a real-time state layer, allowing Spores to communicate and react to each other without being directly coupled.

## **Core Concepts**

- **Shell:** A host application that provides a runtime environment. It is responsible for discovering, verifying, and mounting Spores, as well as providing core services through the CTX.
- **Spore:** An independent micro-application with a single responsibility (e.g., a form, a user list, a chart). It is built as a self-contained library.
- **CTX (Context):** A shared JavaScript object provided by the Shell to all Spores. It contains the shared state (Y.js), a dispatch function for sending actions, and common utilities.
- **Rendezvous Server:** A lightweight "phone book" microservice that allows Spores and Shells to find each other on the network.
- **Dispatch Pattern:** The primary communication method. Spores send structured "Actions" (e.g., { type: 'USER_REGISTERED', ... }) to the Shell, which acts as a central reducer to update the shared state.
- **Mycelial-Naver:** The Shell's internal routing service. It maps URL-like "trails" to specific Spores and manages their lifecycle, creating a navigable single-page application experience.

## **Architecture & Data Flow**

The Mycelial framework operates on a message-passing and shared-state model, orchestrated by the Shell. Here is how the components work together in a typical user session:

1. **Startup & Discovery:**
   - The mycelial-rendezvous server starts.
   - Each Spore's preview server is started (e.g., npm run preview). A custom Vite plugin in each spore's config automatically sends a POST /register request to the Rendezvous server, announcing its name, URL, and global variable.
   - Each Shell's dev server is started (e.g., npm run dev). A similar plugin registers the Host with the Rendezvous server.
2. **Federated Discovery:**
   - MycelialShell-A queries the Rendezvous Server for other active hosts.
   - It discovers MycelialShell-B and fetches its public manifest.json.
   - Shell A's Mycelial-Naver dynamically creates new routes (e.g., /foreign/MycelialShell-B/...) for the spores offered by Shell B.
3. **Navigation & Mounting:**
   - A user clicks a link in Shell A to navigate to a trail, either local or foreign.
   - The Naver service loads the required spore's script (from its original host URL), verifies its contract using MycoAssert, and mounts it into the view.
   - Crucially, the spore is always provided with **Shell A's CTX**, ensuring it runs within the local host's environment.
4. **Action & State Update:**
   - A user interacts with a Spore (e.g., spore-user-registration).
   - The Spore dispatches an action: ctx.dispatch({ type: 'USER_REGISTERED', payload: ... }).
   - The Shell's central handleDispatch function receives the action and updates the shared Y.Array of users.
5. **Reactive UI Update:**
   - Y.js automatically broadcasts the change to all other components listening to that data structure.
   - The spore-current-user (our user list) receives the update via its .observe() listener and re-renders to show the new user.

## **The Project Ecosystem**

This repository contains multiple independent projects that work together to form the framework.

### **1\. mycelial-shell (The Primary Host)**

The main host application. It implements the Mycelial-Naver and provides a rich CTX to all spores it runs. It discovers and can display spores from other hosts.

### **2\. mycelial-rendezvous (The Discovery Server)**

A lightweight Node.js and Express application that acts as the central discovery service.

**API Endpoints:**

- POST /register: For Spores to announce their presence.
- GET /spores: For a Shell to get a list of all active Spores.
- POST /register-host: For Shells to announce their presence.
- GET /hosts: For Shells to discover other active Shells.

### **3\. Spores (spore-user-registration, spore-current-user, etc.)**

Independent Vue applications, built as UMD libraries. Each contains a contract.js file declaring its dependencies on the Shell's CTX, which is verified by the Shell before mounting.

### **4\. create-mycelial-spore (The CLI Tool)**

A command-line interface for scaffolding new spore projects. It automates the creation of all necessary boilerplate.

## **Usage: Building and Running the System**

This guide explains how to run the full, multi-host ecosystem locally and how the architecture enables connecting to live hosts.

### **1\. Running the Local Ecosystem**

To see the federated architecture in action, you must run all server processes simultaneously in separate terminals. The order matters.

**A. Start the Infrastructure:**

1. **Rendezvous Server:** This must be started first.  
   cd mycelial-rendezvous  
   npm start

B. Start All Spores:  
For each spore project (e.g., spore-user-registration, spore-current-user, etc.), run its build and preview server. The custom plugin will automatically register it with the Rendezvous server.  
\# In a new terminal for each spore  
cd spore-user-registration  
npm run build  
npm run preview \# This will run on the port specified in its vite.config.js

C. Start All Hosts:  
For each shell project, start its development server. The custom plugin will register the host and its public manifest.  
\# In a new terminal for each shell  
cd mycelial-shell  
npm run dev

**D. View the Web of Apps:**

- Open <http://localhost:5173> to view MycelialShell-A. In its sidebar, you will see its local trails. After a few seconds, the trails for any other running hosts (like MycelialShell-B) will dynamically appear as the polling mechanism discovers them. You can then navigate to spores served by other hosts.

### **2\. Connecting to a Live Host (Conceptual)**

The current architecture is designed to seamlessly connect to hosts anywhere on the internet, not just on localhost. This is how the "web of apps" vision is realized:

- **Live Rendezvous Server:** In a production scenario, you would deploy the mycelial-rendezvous server to a public cloud service (like Fly.io, Heroku, etc.).
- **Live Hosts:** Developers around the world could deploy their own Mycelial Shells. Their shell's vite.config.js would simply point to the public URL of the live Rendezvous server instead of localhost:4000.
- **Discovery:** When you run your local MycelialShell, if you configure it to also poll the live Rendezvous server, it would discover all publicly registered hosts on the internet. Their spores would appear in your navigation sidebar as "foreign trails."
- **Secure Communication:** When you navigate to a foreign spore, your local Shell loads the code from that remote server, but mounts it locally and provides it with **your local CTX**. The foreign application runs in your environment, using your services and state, ensuring a secure and integrated experience.
