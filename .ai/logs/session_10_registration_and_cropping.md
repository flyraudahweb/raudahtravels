# Session 10: Registration Form Standardization & Interactive Passport Cropping

## Objective
The primary goals were:
1. Standardize the registration form behavior across the Agent portal by enforcing the Admin's Booking Settings toggles via the `useFormFieldConfig` hook.
2. Replace the automatic AI face-cropping in the `PassportScanner` with a manual, interactive cropping engine.

## Key Changes
- **Agent Registration Flow (`AgentClients.tsx`)**: Replaced hardcoded field conditionals with dynamic `useFormFieldConfig` mapping, ensuring newly added fields (e.g., `visaNumber`) and Admin-toggled visibility configurations directly sync to the agent UI.
- **Manual Cropping UI (`PassportScanner.tsx`)**: 
  - Installed `react-image-crop` for robust interactive cropping.
  - Implemented a Dialog popup that triggers immediately after AI passport text extraction finishes.
  - Initialized the cropping box using the AI's best-guess `faceBoundingBox` to save time, while forcing a 1:1 aspect ratio.
  - Provided 'Confirm Crop' logic that extracts the user's selected area into a 400x400 canvas data URL.

## Current State
All form entrypoints (Admin, User, and Agent) now share a unified, configuration-driven validation strategy. The Passport scanner provides flawless zero-regression manual control over profile pictures.
