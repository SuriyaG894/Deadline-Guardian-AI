<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/72f0f436-9a64-425d-83f3-746f67647bbb

## Run Locally

**Prerequisites:** Node.js (v18 or higher)

1. Install dependencies:
   ```bash
   npm install
   ```
2. Set the `GEMINI_API_KEY` in [.env](.env) to your Gemini API key:
   ```env
   GEMINI_API_KEY="your-gemini-api-key"
   ```
3. Run the app:
   ```bash
   npm run dev
   ```

---

## 🚀 Key Feature Highlights

### 1. ⚡ "Cold Start" Brain Dump Scheduler
Allows users to paste project outlines, syllabus tables, or unstructured emails directly. The Gemini integration automatically extracts distinct tasks, estimates work hours, sets deadlines, and dynamically populates focus blocks on the calendar timeline.

### 2. ⚡ "What should I do right now?" Decision Hub
Provides an intelligent action planner that selects the highest-priority/risk task, gives a custom Gemini-generated motivational rationale, and lets you immediately run a Pomodoro focus session with active countdown, pause/resume, and check-in controls.

### 3. ⚡ Real-Time Meeting Overrun Shifting
Simulates huddle and sync overruns with `+30m` and `+60m` buttons in the calendar view. An active backend collision algorithm dynamically shifts and ripple-pushes subsequent focus sessions forward while checking for timeline limits.
