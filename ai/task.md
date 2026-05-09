# Task List: Multi-Registration & Auto-Save

- [x] Fix Agent Package Inventory Bug (`api-server/src/routes/agents.ts`)
  - [x] Increment `packagesTable.currentBookings` in Wallet flow
  - [x] Increment `packagesTable.currentBookings` in Standard flow
- [x] Implement Auto-Save (Network Resilience)
  - [x] `AdminBookPilgrim.tsx`: Save/Restore `pilgrim` and `travel` to `localStorage`
  - [x] `AdminBookPilgrim.tsx`: Clear draft on success
  - [x] `AgentClients.tsx`: Save/Restore `form` to `localStorage`
  - [x] `AgentClients.tsx`: Clear draft on success
- [x] Implement "Register Another" Flow
  - [x] `AdminBookPilgrim.tsx`: Add "Register Another Pilgrim" button (hide if online payment)
  - [x] `AdminBookPilgrim.tsx`: Retain package/payment, clear personal details, jump to Step 2
  - [x] `AgentClients.tsx`: Transition to Success View inside Dialog
  - [x] `AgentClients.tsx`: Add "Register Another Client" button (hide if online payment)
