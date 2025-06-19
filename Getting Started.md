# **i Getting Started: The Mycelial Framework**

Welcome to the Mycelial Framework\! This guide provides a detailed overview of the core concepts and architecture, designed to get you started with building your first decentralized applications.

## **The Mycelial Philosophy: A Web of Apps**

The core vision of this framework is to move away from isolated, monolithic websites and towards a collaborative, interconnected "web of apps." The system is modeled on a biological mycelial network—the "wood-wide web"—where different organisms can communicate and share resources through a common substrate.

In our architecture:

- **Shells** are the main network hubs, providing the environment.
- **Spores** are the functional, independent applications.
- The **CTX (Context)** is the nutrient-rich substrate that allows for communication.

This guide will walk you through each of these core components in detail.

## **High-Level Architecture**

The framework consists of three main types of running processes that work together:

1. **The Rendezvous Server:** A simple "phone book" microservice. Its only job is to let Shells and Spores find each other on the network.
2. **The Mycelial Shell (Host):** The main application that a user interacts with. It's the runtime environment that discovers, loads, and manages Spores.
3. **Spores (Micro-Apps):** Independent applications that are built as libraries. They are served by their own preview servers during development and are loaded dynamically by a Shell.

## **Deep Dive: The Core Components**

### **1\. The Spore: Your Application**

A Spore is the fundamental unit of functionality in the framework. It's a self-contained micro-application, typically built with Vue.

**Key Characteristics of a Spore:**

- **Independent:** It is its own project, with its own dependencies and build process.
- **Decoupled:** A Spore should have **no knowledge** of other Spores. All communication happens through the Shell.
- **Portable:** A well-designed Spore can be loaded and run by any compatible Mycelial Shell.

The Spore's Contract:  
Every Spore must contain two critical files in its src directory:

- **main.js:** The entry point. It does not mount itself to the DOM. Instead, it exports two things:
  1. A mount(element, ctx) function that the Shell will call.
  2. The contract object.
- **contract.js:** This is the Spore's "shopping list." It's a schema that formally declares every single resource the Spore needs from the Shell's CTX to function correctly. The Shell uses this contract to verify compatibility before mounting the Spore.  
  // Example: spore-user-registration/src/contract.js  
  export const contract \= {  
   // This spore needs a top-level \`dispatch\` function in the CTX.  
   dispatch: { type: 'function' },  
   // It also needs a 'utils' object with validation tools.  
   utils: {  
   type: 'object',  
   properties: {  
   assert: { type: 'function' },  
   ValidationError: { type: 'function' }  
   }  
   }  
  };

### **2\. The Shell: The Host Environment**

The Shell is the orchestrator. It creates the user experience by composing different Spores together.

**The Shell's Responsibilities:**

- **Discovery:** It queries the Rendezvous Server to find available Spores and other Hosts.
- **Verification:** It fetches a Spore's contract.js and uses the integrated MycoAssert library to ensure it can provide all the required resources.
- **Routing (Mycelial-Naver):** It manages which Spore (or layout of Spores) is currently visible. It uses a naver.js "trail manifest" to map URL paths to Spores.
- **Providing the CTX:** Its most important job is to construct and provide the CTX object to every Spore it mounts.

### **3\. The CTX: The Shared Substrate**

The Context (CTX) is the bridge between the Shell and its Spores. It's a reactive object that allows for seamless communication.

**The Scoped Sections of the CTX:**

- **ctx.state:** Contains the real-time, shared application state. In our framework, this is powered by **Y.js** data types (like Y.Array or Y.Map), allowing any change to be instantly broadcast to all listening Spores.
- **ctx.dispatch:** A single, powerful function. This is the primary way for a Spore to send messages or "Actions" back to the Shell. This follows the "Action-based" or "Reducer" pattern, fully decoupling the Spore from the Shell's business logic.
- **ctx.utils:** A collection of common utility functions that the Shell can provide to all Spores, such as validation functions from MycoAssert.

## **The Communication Flow: An Example**

Understanding the flow of data and actions is key to understanding the framework.

1. A user fills out the spore-user-registration form and clicks "Submit."
2. The Spore's handleRegister method is called. It knows nothing about state management. It simply packages the form data into a payload and calls props.ctx.dispatch.  
   // Inside spore-user-registration  
   props.ctx.dispatch({  
    type: 'USER_REGISTERED',  
    payload: { id: 123, username: 'new_user', ... }  
   });

3. The handleDispatch function inside the **Shell's App.vue** receives this action object.
4. It uses a switch statement on action.type. It sees 'USER_REGISTERED' and knows it must add the action.payload to the shared users Y.Array.  
   // Inside MycelialShell  
   case 'USER_REGISTERED':  
    sharedUsers.push(\[action.payload\]); // Updates the Y.js state  
    break;

5. The Y.js library automatically detects the change to sharedUsers and broadcasts it.
6. The spore-current-user (our user list) has an active .observe() listener on the sharedUsers array. This listener fires.
7. The spore updates its local userList.value with the new data from the array, causing Vue to re-render the list to include the new user.

This entire process happens without the two spores ever being aware of each other's existence. This is the power of a decoupled, shared-state architecture.
