# Agent Lifecycle Controls — Completed ✅

## Done
- [x] Backend: `PUT /admin/agents/:id/status` (suspend/block/unsuspend/unblock)
- [x] Backend: `DELETE /admin/agents/:id` (delete agent + cascade cleanup)
- [x] Backend: `DELETE /admin/agent-applications/:id` (delete applications)
- [x] Backend: `ensureActiveAgent` guard on agent routes (403 for suspended/blocked)
- [x] Frontend: Suspend / Block / Delete buttons on Active Agents tab
- [x] Frontend: "Suspended" tab with Unsuspend/Unblock/Delete for inactive agents
- [x] Frontend: Delete button on Pending and Rejected application tabs
- [x] Frontend: Confirmation dialogs for all destructive actions
- [x] Frontend: Agent portal guard (full-page notice for suspended/blocked agents)
- [x] Schema: Added `blocked` to `agent_status` PostgreSQL enum
- [x] Pushed to GitHub → Railway deploying
