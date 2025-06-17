# **Mycelial Framework**

### **A Decoupled Micro-Frontend Architecture**

This project is a complete, working proof-of-concept for the Mycelial framework, a decoupled and dynamic micro-frontend architecture.

The system is composed of a host "Shell" application that provides a shared Context (CTX) to independent, dynamically loaded "Spores". Communication and discovery are handled by a central "Rendezvous" server, and real-time state is synchronized using Y.js, fulfilling the initial "hive mind" concept.

## **Core Concepts**

- **Shell:** A host application that provides core services and renders Spores.
- **Spore:** An independent micro-application with a single responsibility. It is dynamically loaded by the Shell.
- **CTX (Context):** A shared JavaScript object provided by the Shell to all Spores. It contains shared state, services, and utilities.
- **Rendezvous Server:** A simple "phone book" microservice that allows Spores to announce their presence and the Shell to discover them.
- **Dispatch Pattern:** A robust state management pattern where Spores send "Actions" to the Shell, which then updates the shared state.

## **Key Accomplishments & Architectural Components**

### **1\. MycelialShell (Host Application)**

- Acts as the main application container.
- Implements a dynamic discovery and loading mechanism that fetches available spores from the Rendezvous server.
- Provides a shared CTX object containing utilities, state, and a central dispatch function for actions.
- Integrates Y.js to create a shared, real-time Y.Array for the application's user list, which is passed to all spores via CTX.state.

### **2\. mycelial-rendezvous (Discovery Server)**

- A simple Node.js/Express server that acts as a central directory.
- Spores register their URL and metadata with it upon startup.
- The Shell queries this server to discover which spores are online and available to be loaded.

### **3\. Action-Based State Management**

- Implemented a robust "dispatch" pattern. Spores send structured actions (e.g., { type: 'USER_REGISTERED', payload: ... }) to the Shell.
- The Shell contains a central reducer (handleDispatch) that updates the shared Y.js state based on the action type. This completely decouples the spores from the state management logic.

### **4\. Independent Spores**

- **spore-user-registration:** A fully independent Vue application that handles user input and dispatches a USER_REGISTERED action to the Shell upon submission.
- **spore-current-user:** A second independent Vue application that displays a list of users. It uses Y.js's .observe() method to listen for changes to the shared users array provided by the Shell and reactively updates its own UI, creating seamless inter-spore communication.

### **5\. MycoAssert (Integrated Library)**

- A custom, zero-dependency validation library was created and integrated directly into the Shell under src/mycoassert.
- It provides runtime validation, data sanitization, and a verifyContract function that the Shell uses to ensure a spore's requirements are met before it is mounted, guaranteeing system stability.

This project represents a complete, end-to-end implementation of the architecture, from discovery and contract validation to dynamic loading and real-time, reactive state synchronization between independent components.
