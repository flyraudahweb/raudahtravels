# Task List: Agent Account Creation Fixes

- [x] Fix "Failed to fetch" timeout on Direct Agent Creation
  - [x] `admin.ts`: Make email verification fire-and-forget in `/admin/agents/create`
  - [x] `admin.ts`: Make duplicate email check return idempotent success if agent already exists
  - [x] `AdminAgents.tsx`: Handle "failed to fetch" network timeouts with a helpful toast
  - [x] `AdminAgents.tsx`: Handle `alreadyExisted` flag to show credentials dialog
- [x] Fix "User already exists" on Agent Application Approval
  - [x] `admin.ts`: Catch `form_identifier_exists` in `/admin/agent-applications/:id/approve`
  - [x] `admin.ts`: Fetch existing Clerk user and promote their profile to `agent` role
  - [x] `AdminAgents.tsx`: Update success dialog to explain when an existing login was used
