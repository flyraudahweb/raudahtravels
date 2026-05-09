# 🚀 Multi-Registration & Auto-Save Implementation Plan

This plan addresses the agent inventory bug, implements robust auto-save for network resilience, and redesigns the completion flow to allow rapid consecutive registrations.

## ⚠️ Open Questions / Clarifications
- For consecutive registrations ("Add Another Pilgrim"), the simplest and most robust approach is to keep the current package and payment method selected, but clear the personal details (passport, name, etc.). The agent/admin will then fill out the next person. If paying online, they will pay per person. Is this per-person payment acceptable, or do you strictly need a "Shopping Cart" where they pay for 10 people in a single bulk transaction? *(Assuming rapid consecutive 1:1 registrations for now, as it requires zero schema regression).*

## 🛠️ Proposed Changes

### 1. Fix Agent Package Inventory Bug
Currently, Agent bookings do not reserve package capacity.
#### [MODIFY] `artifacts/api-server/src/routes/agents.ts`
- Inside the Wallet transaction flow, add a SQL update to increment `packagesTable.currentBookings`.
- Inside the Standard flow (Cash/Online), add the same SQL update to increment `packagesTable.currentBookings`.

### 2. Auto-Save for Network Resilience
If an admin/agent loses internet connection while filling out a massive form, they shouldn't lose their progress.
#### [MODIFY] `artifacts/raudah-travels/src/pages/admin/AdminBookPilgrim.tsx`
- Implement a `useEffect` hook to continuously persist the `pilgrim` and `travel` form state to `localStorage` (`admin_pilgrim_draft`).
- On component mount, restore the state if a draft exists.
- On successful registration, clear the draft from `localStorage`.

#### [MODIFY] `artifacts/raudah-travels/src/pages/agent/AgentClients.tsx`
- Implement similar `localStorage` caching (`agent_client_draft`) for the agent registration dialog.
- Clear the draft upon successful registration.

### 3. Rapid Consecutive Registration (Add Another)
Instead of throwing the user out of the flow after a successful registration, we will keep them in the loop.
#### [MODIFY] `artifacts/raudah-travels/src/pages/admin/AdminBookPilgrim.tsx`
- Redesign the Step 6 (Success) screen to include a prominent **"Register Another Pilgrim for this Package"** button.
- Clicking this button will retain the `packageId` and `payment` state, but reset the `pilgrim` details and jump back to Step 2. This allows them to register 10 people in rapid succession without re-selecting the package or payment terms.

#### [MODIFY] `artifacts/raudah-travels/src/pages/agent/AgentClients.tsx`
- Refactor the Dialog flow. Instead of immediately closing the dialog on success, transition to a "Success" view inside the dialog.
- Provide a **"Register Another Client"** button that clears personal fields but keeps the package selected, allowing the agent to rapidly burn through a list of clients.

## ✅ Verification Plan
1. Ensure Agent registrations correctly deduct from package capacity (both wallet and standard).
2. Type data into the Admin/Agent forms, refresh the page, and verify the data auto-restores.
3. Complete a booking and verify the success screen allows rapid consecutive registrations without breaking state.
