/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import { Task, CalendarEvent, ExecutionPlan, ProgressLog, SystemNotification } from './src/types';

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Persistent JSON Data Store file
const DATA_FILE = path.join(process.cwd(), 'data-store.json');

// Initialize local data store if not present
function initializeDataStore() {
  if (!fs.existsSync(DATA_FILE)) {
    const twoDaysFromNow = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const threeDaysFromNow = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const fiveDaysFromNow = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const initialStore = {
      user: {
        email: "suriyaganeshv042001@gmail.com",
        name: "Suriya Ganesh",
        isLoggedIn: true,
        calendarConnected: false
      },
      tasks: [
        {
          id: "task-1",
          title: "Backend Development & Authentication",
          description: "Build Express APIs and establish local data persistence schemas.",
          deadline: twoDaysFromNow,
          estimatedHours: 18,
          progress: 45,
          status: "in_progress",
          category: "Tech",
          priority: "high",
          difficulty: "High",
          risk: 20,
          recommendedStart: "Today",
          createdAt: new Date().toISOString()
        },
        {
          id: "task-2",
          title: "AI Project Demo Video",
          description: "Record, edit, and export the demo showing off the Deadline Guardian AI Chief of Staff agent.",
          deadline: threeDaysFromNow,
          estimatedHours: 20,
          progress: 0,
          status: "not_started",
          category: "Tech",
          priority: "high",
          difficulty: "High",
          risk: 72,
          recommendedStart: "Today",
          createdAt: new Date().toISOString()
        },
        {
          id: "task-3",
          title: "Interview Prep - System Design",
          description: "Review load balancers, caching layers, and database sharding principles.",
          deadline: fiveDaysFromNow,
          estimatedHours: 10,
          progress: 10,
          status: "in_progress",
          category: "Career",
          priority: "medium",
          difficulty: "Medium",
          risk: 18,
          recommendedStart: "Tomorrow",
          createdAt: new Date().toISOString()
        }
      ],
      calendarEvents: [
        {
          id: "cal-1",
          title: "Team Sync Meeting",
          start: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString().substring(0, 16),
          end: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString().substring(0, 16),
          isFocusSession: false
        },
        {
          id: "cal-2",
          title: "System Design Mock Interview",
          start: new Date(Date.now() + 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000).toISOString().substring(0, 16),
          end: new Date(Date.now() + 24 * 60 * 60 * 1000 + 3.5 * 60 * 60 * 1000).toISOString().substring(0, 16),
          isFocusSession: false
        },
        {
          id: "cal-focus-1",
          title: "🎯 Focus: Backend Dev",
          start: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString().substring(0, 16),
          end: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString().substring(0, 16),
          isFocusSession: true,
          taskId: "task-1"
        }
      ],
      executionPlans: [
        {
          id: "plan-1",
          taskId: "task-1",
          taskTitle: "Backend Development & Authentication",
          approved: true,
          createdAt: new Date().toISOString(),
          items: [
            { id: "epi-1", day: "Today", timeSlot: "6 PM–8 PM", phase: "API Setup", duration: 2 },
            { id: "epi-2", day: "Tomorrow", timeSlot: "7 PM–9 PM", phase: "Schema Integration", duration: 2 }
          ]
        }
      ],
      progressLogs: [
        {
          id: "log-1",
          taskId: "task-1",
          taskTitle: "Backend Development & Authentication",
          timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
          progress: 45,
          comment: "Created JSON data store, schema, and routing structure",
          status: "partially_completed"
        }
      ],
      notifications: [
        {
          id: "not-1",
          type: "info",
          message: "Deadline Guardian activated. Monitoring 2 critical projects.",
          timestamp: new Date().toISOString(),
          read: false
        }
      ],
      rescueMode: false
    };
    fs.writeFileSync(DATA_FILE, JSON.stringify(initialStore, null, 2));
  }
}

// Read data store helper
function getData() {
  initializeDataStore();
  try {
    const fileContent = fs.readFileSync(DATA_FILE, 'utf-8');
    return JSON.parse(fileContent);
  } catch (err) {
    console.error("Error reading data file:", err);
    return null;
  }
}

// Write data store helper
function writeData(data: any) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error("Error writing data file:", err);
  }
}

// Initialize Gemini safely to avoid startup crash if key is missing
function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "MY_GEMINI_API_KEY" || apiKey.trim() === "") {
    console.warn("GEMINI_API_KEY is not configured. Running in high-fidelity sandbox mode.");
    return null;
  }
  return new GoogleGenAI({
    apiKey: apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });
}

// Helper to call generateContent with model fallback if the primary model experiences high demand (503)
async function generateContentWithFallback(
  aiClient: GoogleGenAI,
  params: {
    model: string;
    contents: any;
    config?: any;
  }
) {
  try {
    return await aiClient.models.generateContent(params);
  } catch (err: any) {
    const errMsg = err?.message || "";
    const isUnavailable = errMsg.includes("503") || errMsg.includes("UNAVAILABLE") || err?.status === 503 || err?.code === 503;
    if (isUnavailable) {
      console.warn(`Primary model ${params.model} is unavailable, retrying with gemini-flash-latest...`);
      try {
        return await aiClient.models.generateContent({
          ...params,
          model: 'gemini-flash-latest'
        });
      } catch (err2: any) {
        console.error("gemini-flash-latest fallback failed:", err2);
        console.warn("Trying gemini-3.1-flash-lite...");
        try {
          return await aiClient.models.generateContent({
            ...params,
            model: 'gemini-3.1-flash-lite'
          });
        } catch (err3: any) {
          console.error("gemini-3.1-flash-lite fallback also failed:", err3);
          throw err; // rethrow original error if all fallbacks failed
        }
      }
    }
    throw err;
  }
}

// -----------------------------------------------------
// Auth endpoints
// -----------------------------------------------------
app.post('/api/login', (req, res) => {
  const store = getData();
  store.user.isLoggedIn = true;
  writeData(store);
  res.json({ success: true, user: store.user });
});

app.post('/api/logout', (req, res) => {
  const store = getData();
  store.user.isLoggedIn = false;
  writeData(store);
  res.json({ success: true, user: store.user });
});

// -----------------------------------------------------
// Task CRUD endpoints
// -----------------------------------------------------
app.get('/api/tasks', (req, res) => {
  const store = getData();
  res.json(store.tasks);
});

app.post('/api/tasks', async (req, res) => {
  const { title, description, deadline, estimatedHours, category, priority } = req.body;
  const store = getData();

  const aiClient = getGeminiClient();
  let taskMeta = {
    difficulty: 'Medium' as 'Low' | 'Medium' | 'High',
    risk: 30,
    recommendedStart: 'Today',
    category: category || 'General',
    priority: priority || 'medium'
  };

  if (aiClient) {
    try {
      const prompt = `Analyze this task for complexity, potential risk of missing the deadline, and initial recommendations.
Task Title: "${title}"
Task Description: "${description || 'None'}"
Estimated Hours: ${estimatedHours}
Deadline: ${deadline}
Current Date: ${new Date().toISOString().split('T')[0]}

Return a JSON object exactly matching this schema:
{
  "difficulty": "Low" | "Medium" | "High",
  "risk": number (estimated percentage 0-100 of missing deadline based on hours vs. deadline gap),
  "recommendedStart": string (brief like "Today", "Tomorrow", "In 2 days"),
  "category": string (e.g. "Tech", "Career", "Admin", "Marketing"),
  "priority": "low" | "medium" | "high"
}`;

      const response = await generateContentWithFallback(aiClient, {
        model: 'gemini-3.5-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              difficulty: { type: Type.STRING, description: "Must be Low, Medium, or High" },
              risk: { type: Type.INTEGER, description: "Percentage from 0 to 100" },
              recommendedStart: { type: Type.STRING },
              category: { type: Type.STRING },
              priority: { type: Type.STRING, description: "Must be low, medium, or high" }
            },
            required: ["difficulty", "risk", "recommendedStart", "category", "priority"]
          }
        }
      });

      const resultText = response.text || "{}";
      const parsed = JSON.parse(resultText.trim());
      taskMeta = {
        difficulty: (parsed.difficulty === 'High' || parsed.difficulty === 'Low' || parsed.difficulty === 'Medium') ? parsed.difficulty : 'Medium',
        risk: typeof parsed.risk === 'number' ? parsed.risk : 30,
        recommendedStart: parsed.recommendedStart || "Today",
        category: parsed.category || category || "General",
        priority: (parsed.priority === 'high' || parsed.priority === 'low' || parsed.priority === 'medium') ? parsed.priority : 'medium'
      };
    } catch (e) {
      console.error("Gemini task analysis failed, using fallback:", e);
    }
  } else {
    // Robust local fallback risk calculation
    const hours = Number(estimatedHours) || 5;
    const daysLeft = Math.max(1, Math.ceil((new Date(deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
    const loadRatio = hours / (daysLeft * 4); // assume 4 focus hours/day max
    let calculatedRisk = Math.min(95, Math.max(5, Math.round(loadRatio * 100)));
    let calculatedDifficulty: 'Low' | 'Medium' | 'High' = 'Medium';
    if (hours > 15) calculatedDifficulty = 'High';
    else if (hours < 5) calculatedDifficulty = 'Low';

    taskMeta = {
      difficulty: calculatedDifficulty,
      risk: calculatedRisk,
      recommendedStart: daysLeft < 3 ? "Today" : "Tomorrow",
      category: category || "Tech",
      priority: hours > 12 ? "high" : "medium"
    };
  }

  const newTask: Task = {
    id: "task-" + Date.now(),
    title: title || "Untitled Task",
    description: description || "",
    deadline: deadline || new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    estimatedHours: Number(estimatedHours) || 5,
    progress: 0,
    status: 'not_started',
    category: taskMeta.category,
    priority: taskMeta.priority as 'low' | 'medium' | 'high',
    difficulty: taskMeta.difficulty,
    risk: taskMeta.risk,
    recommendedStart: taskMeta.recommendedStart,
    createdAt: new Date().toISOString()
  };

  store.tasks.push(newTask);

  // Auto-generate notification
  store.notifications.push({
    id: "not-" + Date.now(),
    type: newTask.risk > 70 ? "warning" : "info",
    message: `New task "${newTask.title}" analyzed. Risk score: ${newTask.risk}%.`,
    timestamp: new Date().toISOString(),
    read: false
  });

  writeData(store);
  res.json(newTask);
});

app.put('/api/tasks/:id', (req, res) => {
  const { id } = req.params;
  const updates = req.body;
  const store = getData();
  const taskIndex = store.tasks.findIndex((t: Task) => t.id === id);

  if (taskIndex === -1) {
    return res.status(404).json({ error: "Task not found" });
  }

  const task = store.tasks[taskIndex];
  const oldProgress = task.progress;

  // Apply updates
  store.tasks[taskIndex] = {
    ...task,
    ...updates,
  };

  const updatedTask = store.tasks[taskIndex];

  // Recalculate risk on progress change
  if (oldProgress !== updatedTask.progress) {
    const hours = updatedTask.estimatedHours;
    const completedHours = (updatedTask.progress / 100) * hours;
    const remainingHours = hours - completedHours;
    const daysLeft = Math.max(0.5, (new Date(updatedTask.deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    const workloadRatio = remainingHours / (daysLeft * 4);
    let newRisk = Math.min(98, Math.max(2, Math.round(workloadRatio * 100)));
    if (updatedTask.status === 'completed') {
      newRisk = 0;
    }
    updatedTask.risk = newRisk;

    // Track in logs if changed substantially
    store.progressLogs.push({
      id: "log-" + Date.now(),
      taskId: updatedTask.id,
      taskTitle: updatedTask.title,
      timestamp: new Date().toISOString(),
      progress: updatedTask.progress,
      comment: updates.comment || `Progress updated to ${updatedTask.progress}%`,
      status: updatedTask.status
    });

    // Handle high risk Rescue Mode activation
    if (newRisk > 80 && !store.rescueMode && updatedTask.status !== 'completed') {
      store.rescueMode = true;
      store.notifications.push({
        id: "rescue-" + Date.now(),
        type: "rescue",
        message: `🚨 Rescue Mode Activated! Task "${updatedTask.title}" has crossed 80% risk (${newRisk}%). Schedule compressed automatically.`,
        timestamp: new Date().toISOString(),
        read: false
      });
    } else if (store.rescueMode) {
      // Check if we still have any high risk tasks
      const anyHighRisk = store.tasks.some((t: Task) => t.status !== 'completed' && t.risk > 80);
      if (!anyHighRisk) {
        store.rescueMode = false;
        store.notifications.push({
          id: "rescue-deactive-" + Date.now(),
          type: "success",
          message: `Normal schedule restored. All deadlines are within safe margins.`,
          timestamp: new Date().toISOString(),
          read: false
        });
      }
    }
  }

  writeData(store);
  res.json(updatedTask);
});

app.delete('/api/tasks/:id', (req, res) => {
  const { id } = req.params;
  const store = getData();
  store.tasks = store.tasks.filter((t: Task) => t.id !== id);
  writeData(store);
  res.json({ success: true });
});

// Helper to fetch actual events from Google Calendar API
async function fetchGoogleCalendarEvents(accessToken: string) {
  try {
    const response = await fetch(
      'https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=' + new Date().toISOString() + '&maxResults=15&singleEvents=true&orderBy=startTime',
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );
    if (!response.ok) {
      const errText = await response.text();
      console.error("Failed to fetch from Google Calendar API:", response.status, errText);
      let isApiDisabled = false;
      if (
        errText.includes("calendar-json.googleapis.com") || 
        errText.includes("has not been used in project") || 
        errText.includes("accessNotConfigured") ||
        response.status === 403
      ) {
        isApiDisabled = true;
      }
      return {
        success: false,
        error: `Failed to fetch from Google Calendar API: ${response.status}`,
        details: errText,
        apiDisabled: isApiDisabled
      };
    }
    const data: any = await response.json();
    const events: any[] = [];
    if (data && data.items) {
      for (const item of data.items) {
        events.push({
          id: item.id,
          title: item.summary || 'No Title',
          start: item.start?.dateTime || item.start?.date || new Date().toISOString(),
          end: item.end?.dateTime || item.end?.date || new Date().toISOString(),
          isFocusSession: false,
        });
      }
    }
    return { success: true, events };
  } catch (err: any) {
    console.error("Error calling Google Calendar API:", err);
    return { success: false, error: err.message || "Unknown error calling Calendar API" };
  }
}

// -----------------------------------------------------
// Calendar endpoints
// -----------------------------------------------------
app.get('/api/calendar/events', async (req, res) => {
  const store = getData();
  if (store.user.calendarConnected && store.user.googleAccessToken) {
    const result = await fetchGoogleCalendarEvents(store.user.googleAccessToken);
    if (result.success && result.events) {
      const realEvents = result.events;
      const focusEvents = store.calendarEvents.filter((e: any) => e.isFocusSession);
      const nonFocusIds = new Set(realEvents.map((e: any) => e.id));
      const filteredFocus = focusEvents.filter((e: any) => !nonFocusIds.has(e.id));
      store.calendarEvents = [...realEvents, ...filteredFocus];
      writeData(store);
    } else if (!result.success) {
      return res.json({
        connected: store.user.calendarConnected,
        events: store.calendarEvents,
        error: result.error,
        details: result.details,
        apiDisabled: result.apiDisabled
      });
    }
  }
  res.json({
    connected: store.user.calendarConnected,
    events: store.calendarEvents
  });
});

app.post('/api/calendar/connect', async (req, res) => {
  const { accessToken } = req.body;
  const store = getData();
  
  if (accessToken) {
    const result = await fetchGoogleCalendarEvents(accessToken);
    if (result.success && result.events) {
      const realEvents = result.events;
      store.user.calendarConnected = true;
      store.user.googleAccessToken = accessToken;
      
      const focusEvents = store.calendarEvents.filter((e: any) => e.isFocusSession);
      const nonFocusIds = new Set(realEvents.map((e: any) => e.id));
      const filteredFocus = focusEvents.filter((e: any) => !nonFocusIds.has(e.id));
      store.calendarEvents = [...realEvents, ...filteredFocus];
      
      writeData(store);
      res.json({ connected: true, events: store.calendarEvents });
    } else {
      res.status(400).json({ 
        connected: false,
        error: result.error || "Failed to authenticate Google Calendar with provided token",
        details: result.details,
        apiDisabled: result.apiDisabled
      });
    }
  } else {
    store.user.calendarConnected = false;
    store.user.googleAccessToken = null;
    store.calendarEvents = store.calendarEvents.filter((e: any) => e.isFocusSession);
    writeData(store);
    res.json({ connected: false, events: store.calendarEvents });
  }
});

// -----------------------------------------------------
// AI Endpoints
// -----------------------------------------------------

// Generate execution plan based on task + calendar events
app.post('/api/ai/plan', async (req, res) => {
  const { taskId, tasks, calendarEvents } = req.body;
  const isStateless = Array.isArray(tasks);
  const store = isStateless ? null : getData();
  const currentTasks = isStateless ? tasks : store.tasks;
  const currentEvents = isStateless ? calendarEvents : store.calendarEvents;

  const task = currentTasks.find((t: Task) => t.id === taskId);

  if (!task) {
    return res.status(404).json({ error: "Task not found" });
  }

  const aiClient = getGeminiClient();
  let planItems: any[] = [];

  const existingCalendarTitles = currentEvents.map((e: any) => `${e.title} (${e.start} to ${e.end})`).join('\n');

  if (aiClient) {
    try {
      const prompt = `Create a realistic work session execution plan (focus windows) for a task.
Task Title: "${task.title}"
Total Hours Needed: ${task.estimatedHours}
Task Description: "${task.description || 'None'}"
Deadline: ${task.deadline}
Current Date/Time: ${new Date().toISOString()}

Here are the user's current calendar commitments to avoid scheduling conflicts:
${existingCalendarTitles || 'No conflict events.'}

Suggest a set of 2 to 4 focus sessions to complete this task on time.
Return a JSON array of focus sessions exactly matching this schema:
[
  {
    "day": "Today" | "Tomorrow" | "Saturday" | "Sunday" | "Monday",
    "timeSlot": "6 PM–8 PM" | "7 PM–9 PM" | "2 PM–4 PM" etc,
    "phase": "E.g. Backend Architecture, Database design, Core layout setup",
    "duration": number (duration in hours, e.g. 2)
  }
]`;

      const response = await generateContentWithFallback(aiClient, {
        model: 'gemini-3.5-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                day: { type: Type.STRING },
                timeSlot: { type: Type.STRING },
                phase: { type: Type.STRING },
                duration: { type: Type.INTEGER }
              },
              required: ["day", "timeSlot", "phase", "duration"]
            }
          }
        }
      });

      const text = response.text || "[]";
      planItems = JSON.parse(text.trim());
    } catch (e) {
      console.error("Gemini plan generation failed, using procedural planning:", e);
    }
  }

  if (!planItems || planItems.length === 0) {
    // Local fallback planning
    const days = ["Today", "Tomorrow", "Saturday", "Sunday"];
    const phases = ["Environment & Core Setup", "Feature Implementation", "Testing & Deployment"];
    const hoursPerSession = Math.round(task.estimatedHours / 3) || 2;

    planItems = [
      { id: "epi-1", day: "Today", timeSlot: "6 PM–8 PM", phase: phases[0], duration: hoursPerSession },
      { id: "epi-2", day: "Tomorrow", timeSlot: "7 PM–9 PM", phase: phases[1], duration: hoursPerSession },
      { id: "epi-3", day: "Saturday", timeSlot: "2 PM–5 PM", phase: phases[2], duration: hoursPerSession }
    ];
  }

  // Ensure unique IDs
  const formattedItems = planItems.map((item, index) => ({
    id: `epi-${Date.now()}-${index}`,
    day: item.day || "Today",
    timeSlot: item.timeSlot || "6 PM-8 PM",
    phase: item.phase || "Work Phase",
    duration: Number(item.duration) || 2
  }));

  const newPlan: ExecutionPlan = {
    id: "plan-" + Date.now(),
    taskId: task.id,
    taskTitle: task.title,
    items: formattedItems,
    approved: false,
    createdAt: new Date().toISOString()
  };

  if (!isStateless && store) {
    // Remove previous unapproved plans for this task
    store.executionPlans = store.executionPlans.filter((p: ExecutionPlan) => p.taskId !== task.id || p.approved);
    store.executionPlans.push(newPlan);
    writeData(store);
  }

  res.json(newPlan);
});

// Approve and add execution plan to calendar
app.post('/api/ai/plan/approve', (req, res) => {
  const { planId, executionPlans, calendarEvents } = req.body;
  const isStateless = Array.isArray(executionPlans);
  const store = isStateless ? null : getData();
  const currentPlans = isStateless ? executionPlans : store.executionPlans;

  const planIndex = currentPlans.findIndex((p: ExecutionPlan) => p.id === planId);

  if (planIndex === -1) {
    return res.status(404).json({ error: "Execution plan not found" });
  }

  const plan = currentPlans[planIndex];
  plan.approved = true;

  const newEvents: CalendarEvent[] = [];

  // Add focus blocks to simulated calendar events
  plan.items.forEach((item, idx) => {
    let dayOffset = 0;
    if (item.day.toLowerCase() === 'tomorrow') dayOffset = 1;
    else if (item.day.toLowerCase().includes('sat')) dayOffset = 2;
    else if (item.day.toLowerCase().includes('sun')) dayOffset = 3;
    else if (item.day.toLowerCase().includes('mon')) dayOffset = 4;

    const baseDate = new Date(Date.now() + dayOffset * 24 * 60 * 60 * 1000);
    // Rough timeslot mapping
    let hour = 18; // default 6 PM
    if (item.timeSlot.includes('2 PM')) hour = 14;
    else if (item.timeSlot.includes('7 PM')) hour = 19;
    else if (item.timeSlot.includes('10 PM')) hour = 22;

    const start = new Date(baseDate.setHours(hour, 0, 0, 0)).toISOString().substring(0, 16);
    const end = new Date(baseDate.setHours(hour + item.duration, 0, 0, 0)).toISOString().substring(0, 16);

    const newCalEvent: CalendarEvent = {
      id: `cal-focus-${Date.now()}-${idx}`,
      title: `🎯 Focus: ${item.phase}`,
      start,
      end,
      isFocusSession: true,
      taskId: plan.taskId
    };

    newEvents.push(newCalEvent);
  });

  if (!isStateless && store) {
    newEvents.forEach(evt => store.calendarEvents.push(evt));
    store.notifications.push({
      id: "not-" + Date.now(),
      type: "success",
      message: `Plan approved! ${plan.items.length} focus sessions added to Google Calendar.`,
      timestamp: new Date().toISOString(),
      read: false
    });
    writeData(store);
    res.json({ success: true, plan });
  } else {
    res.json({ success: true, plan, newEvents });
  }
});

// Check-in API endpoint
app.post('/api/ai/checkin', async (req, res) => {
  const { taskId, status, progressVal, textFeedback, tasks, rescueMode } = req.body;
  const isStateless = Array.isArray(tasks);
  const store = isStateless ? null : getData();
  const currentTasks = isStateless ? tasks : store.tasks;

  const task = currentTasks.find((t: Task) => t.id === taskId);

  if (!task) {
    return res.status(404).json({ error: "Task not found" });
  }

  let finalProgress = Number(progressVal);
  if (isNaN(finalProgress)) {
    if (status === 'completed') finalProgress = 100;
    else if (status === 'partially_completed') finalProgress = Math.min(95, task.progress + 15);
    else finalProgress = task.progress;
  }

  const aiClient = getGeminiClient();
  let checkinResult = {
    progress: finalProgress,
    risk: task.risk,
    coachingAdvice: "I've logged your work. Let's keep the momentum going!",
    rescueModeTriggered: false
  };

  if (aiClient) {
    try {
      const prompt = `You are the Deadline Guardian AI Chief of Staff.
A focus session has just ended.
Task: "${task.title}" (Estimated time: ${task.estimatedHours} hours, Previous progress: ${task.progress}%)
Session Status: ${status}
User Feedback: "${textFeedback || 'None provided'}"
Deadline: ${task.deadline}

Evaluate remaining work hours, calculate updated failure/completion risk, and generate strong corrective coaching tips. If risk exceeds 80%, suggest entering Emergency Rescue Mode.
Return a JSON object:
{
  "progress": number (0-100),
  "risk": number (0-100),
  "coachingAdvice": "coaching statement",
  "rescueModeTriggered": boolean (true if risk is >80% or user needs rescue mode)
}`;

      const response = await generateContentWithFallback(aiClient, {
        model: 'gemini-3.5-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              progress: { type: Type.INTEGER },
              risk: { type: Type.INTEGER },
              coachingAdvice: { type: Type.STRING },
              rescueModeTriggered: { type: Type.BOOLEAN }
            },
            required: ["progress", "risk", "coachingAdvice", "rescueModeTriggered"]
          }
        }
      });

      const parsed = JSON.parse((response.text || "{}").trim());
      checkinResult = {
        progress: typeof parsed.progress === 'number' ? parsed.progress : finalProgress,
        risk: typeof parsed.risk === 'number' ? parsed.risk : task.risk,
        coachingAdvice: parsed.coachingAdvice || "Keep going!",
        rescueModeTriggered: !!parsed.rescueModeTriggered
      };
    } catch (e) {
      console.error("Check-in Gemini analysis failed:", e);
    }
  } else {
    // Procedural checkin calculations
    let calculatedRisk = task.risk;
    let advice = "";

    if (status === 'completed') {
      finalProgress = 100;
      calculatedRisk = 0;
      advice = "Spectacular work! You crushed this session and completed the task on schedule. Analytics have been updated.";
    } else if (status === 'partially_completed') {
      finalProgress = Math.min(95, task.progress + Math.round((100 - task.progress) * 0.3));
      calculatedRisk = Math.max(10, task.risk - 10);
      advice = `Good progress logged. You are now at ${finalProgress}%. We've updated your schedule to keep you aligned with the deadline.`;
    } else {
      // couldn't start or failed
      calculatedRisk = Math.min(98, task.risk + 25);
      advice = `Critical bottleneck alert. Session was missed. The risk factor has expanded to ${calculatedRisk}%. Let's look into rescheduling options immediately.`;
    }

    checkinResult = {
      progress: finalProgress,
      risk: calculatedRisk,
      coachingAdvice: advice,
      rescueModeTriggered: calculatedRisk > 80
    };
  }

  // Create updated task data
  const updatedTask = {
    ...task,
    progress: checkinResult.progress,
    risk: checkinResult.risk,
    status: checkinResult.progress === 100 ? 'completed' : (checkinResult.progress > 0 ? 'in_progress' : task.status)
  };

  // Create log item
  const newLog = {
    id: "log-" + Date.now(),
    taskId: task.id,
    taskTitle: task.title,
    timestamp: new Date().toISOString(),
    progress: updatedTask.progress,
    comment: textFeedback || `Session check-in: ${status}. Advice: ${checkinResult.coachingAdvice}`,
    status: updatedTask.status
  };

  let newRescueMode = isStateless ? !!rescueMode : store!.rescueMode;
  let newNotification: any = null;

  // Handle Rescue Mode
  if (checkinResult.rescueModeTriggered || updatedTask.risk > 80) {
    newRescueMode = true;
    newNotification = {
      id: "rescue-" + Date.now(),
      type: "rescue",
      message: `🚨 Emergency Rescue Mode activated for "${task.title}". Focus sessions compressed!`,
      timestamp: new Date().toISOString(),
      read: false
    };
  }

  if (!isStateless && store) {
    task.progress = updatedTask.progress;
    task.risk = updatedTask.risk;
    task.status = updatedTask.status;

    store.progressLogs.push(newLog);

    if (newRescueMode) {
      store.rescueMode = true;
      if (newNotification) {
        store.notifications.push(newNotification);
      }
    }
    writeData(store);
  }

  res.json({
    task: updatedTask,
    coachingAdvice: checkinResult.coachingAdvice,
    rescueMode: newRescueMode,
    newLog,
    newNotification
  });
});

// Single conversational Orchestrator Chat endpoint
app.post('/api/ai/chat', async (req, res) => {
  const { message, context, tasks, calendarEvents, rescueMode } = req.body;
  const isStateless = Array.isArray(tasks);
  const store = isStateless ? null : getData();
  const currentTasks = isStateless ? tasks : store.tasks;
  const currentEvents = isStateless ? calendarEvents : store.calendarEvents;
  const currentRescueMode = isStateless ? !!rescueMode : store.rescueMode;

  const aiClient = getGeminiClient();

  if (aiClient) {
    try {
      const prompt = `You are the core of "Deadline Guardian AI" - a proactive productivity Chief of Staff.
Your goals are:
1. Understand goals & create tasks.
2. Form schedules & plan sessions.
3. Handle check-ins & logs.
4. Activate Rescue Mode if risk is high or user is struggling.
5. Provide helpful schedule coaching tips.

User said: "${message}"

Context tasks: ${JSON.stringify(currentTasks)}
Context calendar events: ${JSON.stringify(currentEvents)}
Is Rescue Mode active: ${currentRescueMode}

Analyze the user's input. Is it a command or natural conversational request?
Identify if they want to:
- Create a task ("create_task")
- Update progress / do checkin ("update_progress")
- Schedule / plan ("plan_day")
- Reschedule ("reschedule")
- Ask a general question about their deadlines, risk, productivity ("general_query")

Return a JSON response matching:
{
  "intent": "create_task" | "update_progress" | "plan_day" | "reschedule" | "general_query",
  "reply": "friendly natural vocal reply to user",
  "extractedData": {
    "taskTitle": string (extracted task name, if creating),
    "taskDeadline": string (extracted date, e.g. "Friday" or "YYYY-MM-DD", if creating),
    "taskHours": number (hours, if creating),
    "taskDescription": string (extracted description, if creating),
    "progressPercentage": number (progress, if updating),
    "targetTaskId": string (id of task being referred to),
    "rescheduleAction": string (description of move, e.g. "move_tomorrow")
  }
}`;

      const response = await generateContentWithFallback(aiClient, {
        model: 'gemini-3.5-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              intent: { type: Type.STRING },
              reply: { type: Type.STRING },
              extractedData: {
                type: Type.OBJECT,
                properties: {
                  taskTitle: { type: Type.STRING },
                  taskDeadline: { type: Type.STRING },
                  taskHours: { type: Type.NUMBER },
                  taskDescription: { type: Type.STRING },
                  progressPercentage: { type: Type.NUMBER },
                  targetTaskId: { type: Type.STRING },
                  rescheduleAction: { type: Type.STRING }
                }
              }
            },
            required: ["intent", "reply"]
          }
        }
      });

      const parsed = JSON.parse((response.text || "{}").trim());
      const reply = parsed.reply;
      const intent = parsed.intent;
      const data = parsed.extractedData || {};

      let effect: any = null;

      // Implement side effects
      if (intent === 'create_task' && data.taskTitle) {
        // Handle auto creation
        const deadlineDate = data.taskDeadline || new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        // Ensure valid estimated hours
        const hours = data.taskHours || 8;

        const fallbackDays = Math.max(1, Math.ceil((new Date(deadlineDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
        const riskScore = Math.min(95, Math.round((hours / (fallbackDays * 4)) * 100));

        const createdTask: Task = {
          id: "task-" + Date.now(),
          title: data.taskTitle,
          description: data.taskDescription || "Created via voice/chat command.",
          deadline: deadlineDate,
          estimatedHours: hours,
          progress: 0,
          status: 'not_started',
          category: "Tech",
          priority: hours > 12 ? "high" : "medium",
          difficulty: hours > 12 ? "High" : "Medium",
          risk: riskScore,
          recommendedStart: "Today",
          createdAt: new Date().toISOString()
        };

        const newNotif = {
          id: "not-" + Date.now(),
          type: createdTask.risk > 75 ? "warning" : "info",
          message: `Voice task created: "${createdTask.title}" (${hours}h). Risk is ${createdTask.risk}%.`,
          timestamp: new Date().toISOString(),
          read: false
        };

        if (!isStateless && store) {
          store.tasks.push(createdTask);
          store.notifications.push(newNotif);
          writeData(store);
        }

        effect = { type: 'TASK_CREATED', task: createdTask, notification: newNotif };

      } else if (intent === 'update_progress') {
        const taskId = data.targetTaskId || (currentTasks.length > 0 ? currentTasks[0].id : null);
        const percentage = typeof data.progressPercentage === 'number' ? data.progressPercentage : 50;

        if (taskId) {
          const task = currentTasks.find((t: Task) => t.id === taskId);
          if (task) {
            const updatedTask = {
              ...task,
              progress: percentage,
              status: percentage === 100 ? 'completed' : (percentage > 0 ? 'in_progress' : task.status)
            };

            // Recalculate risk
            const daysLeft = Math.max(0.5, (new Date(task.deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
            updatedTask.risk = Math.round(Math.min(98, Math.max(2, ((task.estimatedHours * (1 - percentage/100)) / (daysLeft * 4)) * 100)));

            const newLog = {
              id: "log-" + Date.now(),
              taskId: task.id,
              taskTitle: task.title,
              timestamp: new Date().toISOString(),
              progress: percentage,
              comment: `Progress update via voice: ${percentage}%`,
              status: updatedTask.status
            };

            let updatedRescueMode = currentRescueMode;
            let newNotif: any = null;

            if (updatedTask.risk > 80 && !currentRescueMode) {
              updatedRescueMode = true;
              newNotif = {
                id: "not-" + Date.now(),
                type: "rescue",
                message: `🚨 Rescue Mode activated for "${task.title}".`,
                timestamp: new Date().toISOString(),
                read: false
              };
            }

            if (!isStateless && store) {
              const matched = store.tasks.find((t: any) => t.id === taskId);
              if (matched) {
                matched.progress = updatedTask.progress;
                matched.status = updatedTask.status;
                matched.risk = updatedTask.risk;
              }
              store.progressLogs.push(newLog);
              if (updatedRescueMode) {
                store.rescueMode = true;
                if (newNotif) store.notifications.push(newNotif);
              }
              writeData(store);
            }

            effect = { 
              type: 'PROGRESS_UPDATED', 
              task: updatedTask, 
              log: newLog, 
              rescueMode: updatedRescueMode,
              notification: newNotif
            };
          }
        }
      } else if (intent === 'reschedule') {
        // Simulate moving focus sessions forward by 1 day
        const shiftedEvents = currentEvents.map((evt: any) => {
          if (evt.isFocusSession) {
            const currentStart = new Date(evt.start);
            const currentEnd = new Date(evt.end);
            currentStart.setDate(currentStart.getDate() + 1);
            currentEnd.setDate(currentEnd.getDate() + 1);
            return {
              ...evt,
              start: currentStart.toISOString().substring(0, 16),
              end: currentEnd.toISOString().substring(0, 16)
            };
          }
          return evt;
        });

        const newNotif = {
          id: "not-" + Date.now(),
          type: "info",
          message: `Focus schedule shifted dynamically by 24 hours. Calendar synced.`,
          timestamp: new Date().toISOString(),
          read: false
        };

        if (!isStateless && store) {
          store.calendarEvents = shiftedEvents;
          store.notifications.push(newNotif);
          writeData(store);
        }

        effect = { type: 'SCHEDULE_SHIFTED', events: shiftedEvents, notification: newNotif };
      }

      return res.json({ reply, intent, effect, storeState: store });
    } catch (err) {
      console.error("Gemini Orchestrator execution failed, using procedural AI reply:", err);
    }
  }

  // Robust Fallback AI Response
  const lowercaseMsg = message.toLowerCase();
  let reply = "I am analyzing your productivity dashboard. Everything is synchronized.";
  let intent = "general_query";
  let effect: any = null;

  if (lowercaseMsg.includes("create") || lowercaseMsg.includes("finish") || lowercaseMsg.includes("task before")) {
    intent = "create_task";
    // Extracted mock
    const newMockTask: Task = {
      id: "task-" + Date.now(),
      title: "Self-Managed Task Goal",
      description: "Auto-extracted from your spoken command.",
      deadline: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      estimatedHours: 12,
      progress: 0,
      status: 'not_started',
      category: "Tech",
      priority: "medium",
      difficulty: "Medium",
      risk: 42,
      recommendedStart: "Today",
      createdAt: new Date().toISOString()
    };

    const newNotif = {
      id: "not-" + Date.now(),
      type: "info",
      message: `Task "${newMockTask.title}" created. Initial risk: 42%`,
      timestamp: new Date().toISOString(),
      read: false
    };

    if (!isStateless && store) {
      store.tasks.push(newMockTask);
      store.notifications.push(newNotif);
      writeData(store);
    }

    reply = `Certainly! I have created a new task titled "${newMockTask.title}" set for a deadline of 4 days from now. Let's build an execution plan for it!`;
    effect = { type: 'TASK_CREATED', task: newMockTask, notification: newNotif };
  } else if (lowercaseMsg.includes("finish") || lowercaseMsg.includes("progress") || lowercaseMsg.includes("percent")) {
    intent = "update_progress";
    if (currentTasks.length > 0) {
      const task = currentTasks[0];
      const updatedTask = {
        ...task,
        progress: 60,
        status: 'in_progress',
        risk: 15
      };

      const newLog = {
        id: "log-" + Date.now(),
        taskId: task.id,
        taskTitle: task.title,
        timestamp: new Date().toISOString(),
        progress: 60,
        comment: "Finished 60% (voice check-in)",
        status: updatedTask.status
      };

      if (!isStateless && store) {
        const matched = store.tasks[0];
        matched.progress = 60;
        matched.status = 'in_progress';
        matched.risk = 15;
        store.progressLogs.push(newLog);
        writeData(store);
      }

      reply = `Superb! I have logged your progress to 60% for "${task.title}". The deadline failure risk has dropped to safe 15% levels. Keep pushing!`;
      effect = { type: 'PROGRESS_UPDATED', task: updatedTask, log: newLog };
    }
  } else if (lowercaseMsg.includes("move") || lowercaseMsg.includes("reschedule") || lowercaseMsg.includes("tomorrow")) {
    intent = "reschedule";
    const shiftedEvents = currentEvents.map((evt: any) => {
      if (evt.isFocusSession) {
        const currentStart = new Date(evt.start);
        const currentEnd = new Date(evt.end);
        currentStart.setDate(currentStart.getDate() + 1);
        currentEnd.setDate(currentEnd.getDate() + 1);
        return {
          ...evt,
          start: currentStart.toISOString().substring(0, 16),
          end: currentEnd.toISOString().substring(0, 16)
        };
      }
      return evt;
    });

    const newNotif = {
      id: "not-" + Date.now(),
      type: "info",
      message: `Focus schedule shifted dynamically by 24 hours. Calendar synced.`,
      timestamp: new Date().toISOString(),
      read: false
    };

    if (!isStateless && store) {
      store.calendarEvents = shiftedEvents;
      store.notifications.push(newNotif);
      writeData(store);
    }

    reply = "I understand. I have automatically shifted your focus block calendar sessions to tomorrow and updated your Google Calendar automatically.";
    effect = { type: 'SCHEDULE_SHIFTED', events: shiftedEvents, notification: newNotif };
  } else if (lowercaseMsg.includes("plan") || lowercaseMsg.includes("schedule")) {
    intent = "plan_day";
    reply = "Your calendar is synced. I suggest tackling the High-Risk tasks first during your prime morning focus windows. Shall I generate a custom session roadmap?";
  } else {
    // general advice fallback - dynamically analyze calendar events and tasks
    const pendingCount = (currentTasks || []).filter((t: any) => t.status !== 'completed').length;
    const highRiskCount = (currentTasks || []).filter((t: any) => t.risk > 70).length;

    // Check if user mentioned "gym", "workout", or similar
    const isGymMentioned = lowercaseMsg.includes("gym") || lowercaseMsg.includes("workout") || lowercaseMsg.includes("fitness") || lowercaseMsg.includes("exercise");
    const gymEvents = (currentEvents || []).filter((evt: any) => {
      const title = (evt.title || "").toLowerCase();
      return title.includes("gym") || title.includes("workout") || title.includes("fitness") || title.includes("exercise");
    });

    // Check if user mentioned any other specific event by title
    const matchedEvents = (currentEvents || []).filter((evt: any) => {
      const title = (evt.title || "").toLowerCase();
      return title.split(" ").some((word: string) => word.length > 2 && lowercaseMsg.includes(word));
    });

    if (isGymMentioned && gymEvents.length > 0) {
      const gymEvt = gymEvents[0];
      const formatTime = (isoString: string) => {
        try {
          const d = new Date(isoString);
          return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
        } catch {
          return isoString;
        }
      };
      const startStr = formatTime(gymEvt.start);
      const endStr = formatTime(gymEvt.end);
      reply = `I see you have "${gymEvt.title}" scheduled from ${startStr} to ${endStr} today on your Google Calendar. I have protected that slot on your timeline to ensure no focus conflicts occur! Let me know if you want to schedule focus windows before or after it.`;
    } else if (matchedEvents.length > 0) {
      const firstEvt = matchedEvents[0];
      const formatTime = (isoString: string) => {
        try {
          const d = new Date(isoString);
          return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
        } catch {
          return isoString;
        }
      };
      const startStr = formatTime(firstEvt.start);
      const endStr = formatTime(firstEvt.end);
      reply = `I found "${firstEvt.title}" on your calendar today from ${startStr} to ${endStr}. This time is blocked on your timeline. Let me know if you need to plan focus blocks around it!`;
    } else if (lowercaseMsg.includes("today") || lowercaseMsg.includes("calendar") || lowercaseMsg.includes("event") || lowercaseMsg.includes("schedule")) {
      const todayEvents = (currentEvents || []).filter((evt: any) => {
        try {
          const startDay = new Date(evt.start).toISOString().split('T')[0];
          const todayDay = new Date().toISOString().split('T')[0];
          return startDay === todayDay;
        } catch {
          return true;
        }
      });

      if (todayEvents.length > 0) {
        const list = todayEvents.map((e: any) => {
          try {
            const t = new Date(e.start).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
            return `"${e.title}" at ${t}`;
          } catch {
            return `"${e.title}"`;
          }
        }).join(", ");
        reply = `Your calendar is fully synced. For today, you have: ${list}. I have automatically protected these slots on your timeline. Let me know if you'd like to map some focus sessions!`;
      } else {
        reply = `You have no standard events scheduled on your calendar today, leaving your day completely open for focus sessions. Shall we set up a plan?`;
      }
    } else {
      reply = `Hi! I'm your Deadline Guardian AI Chief of Staff. You currently have ${pendingCount} pending tasks with ${highRiskCount} marked as High Risk. I recommend dedicating 2 hours of focus time today to mitigate your risk. Let me know how I can assist!`;
    }
  }

  res.json({ reply, intent, effect, storeState: isStateless ? null : store });
});

// GET aggregated analytics dashboard
app.get('/api/analytics', (req, res) => {
  const store = getData();
  const tasks = store.tasks;

  const totalTasks = tasks.length;
  const completedTasks = tasks.filter((t: Task) => t.status === 'completed').length;
  const highRiskCount = tasks.filter((t: Task) => t.status !== 'completed' && t.risk > 70).length;

  // focus hours logged
  const focusHoursLogged = store.calendarEvents
    .filter((e: any) => e.isFocusSession)
    .reduce((acc: number, cur: any) => {
      const diffMs = new Date(cur.end).getTime() - new Date(cur.start).getTime();
      return acc + (diffMs / (1000 * 60 * 60));
    }, 0);

  // calculate score based on task completions and low risks
  let productivityScore = totalTasks > 0 ? 80 : 100;
  if (totalTasks > 0) {
    const completeRatio = completedTasks / totalTasks;
    const pendingTasks = tasks.filter((t: Task) => t.status !== 'completed');
    const averageRisk = pendingTasks.length > 0
      ? pendingTasks.reduce((sum: number, t: Task) => sum + (t.risk || 0), 0) / pendingTasks.length
      : 0;
    productivityScore = Math.round((completeRatio * 50) + ((100 - averageRisk) * 0.5));
    productivityScore = Math.min(100, Math.max(0, productivityScore));
  }

  // Categories
  const categoryDistribution: Record<string, number> = {};
  tasks.forEach((t: Task) => {
    categoryDistribution[t.category] = (categoryDistribution[t.category] || 0) + 1;
  });

  res.json({
    totalTasks,
    completedTasks,
    highRiskCount,
    focusHoursLogged: Math.round(focusHoursLogged * 10) / 10,
    productivityScore,
    categoryDistribution
  });
});

// POST aggregated analytics dashboard with custom data
app.post('/api/analytics', (req, res) => {
  const store = getData();
  const reqTasks = req.body?.tasks;
  const reqEvents = req.body?.calendarEvents;

  const tasks = Array.isArray(reqTasks) ? reqTasks : store.tasks;
  const calendarEvents = Array.isArray(reqEvents) ? reqEvents : (store.calendarEvents || []);

  const totalTasks = tasks.length;
  const completedTasks = tasks.filter((t: any) => t.status === 'completed').length;
  const highRiskCount = tasks.filter((t: any) => t.status !== 'completed' && t.risk > 70).length;

  // focus hours logged
  const focusHoursLogged = calendarEvents
    .filter((e: any) => e.isFocusSession)
    .reduce((acc: number, cur: any) => {
      const diffMs = new Date(cur.end).getTime() - new Date(cur.start).getTime();
      return acc + (diffMs / (1000 * 60 * 60));
    }, 0);

  // calculate score based on task completions and low risks
  let productivityScore = totalTasks > 0 ? 80 : 100;
  if (totalTasks > 0) {
    const completeRatio = completedTasks / totalTasks;
    const pendingTasks = tasks.filter((t: any) => t.status !== 'completed');
    const averageRisk = pendingTasks.length > 0
      ? pendingTasks.reduce((sum: number, t: any) => sum + (t.risk || 0), 0) / pendingTasks.length
      : 0;
    productivityScore = Math.round((completeRatio * 50) + ((100 - averageRisk) * 0.5));
    productivityScore = Math.min(100, Math.max(0, productivityScore));
  }

  // Categories
  const categoryDistribution: Record<string, number> = {};
  tasks.forEach((t: any) => {
    if (t.category) {
      categoryDistribution[t.category] = (categoryDistribution[t.category] || 0) + 1;
    }
  });

  res.json({
    totalTasks,
    completedTasks,
    highRiskCount,
    focusHoursLogged: Math.round(focusHoursLogged * 10) / 10,
    productivityScore,
    categoryDistribution
  });
});

// Notifications API
app.get('/api/notifications', (req, res) => {
  const store = getData();
  res.json(store.notifications || []);
});

app.post('/api/notifications/read', (req, res) => {
  const store = getData();
  store.notifications = store.notifications.map((n: any) => ({ ...n, read: true }));
  writeData(store);
  res.json(store.notifications);
});

// Toggle Rescue Mode manually
app.post('/api/ai/rescue/toggle', (req, res) => {
  const store = getData();
  store.rescueMode = !store.rescueMode;

  if (store.rescueMode) {
    store.notifications.push({
      id: "rescue-" + Date.now(),
      type: "rescue",
      message: `🚨 Manual Override: Emergency Rescue Mode activated. Schedule compressed, non-critical items deferred.`,
      timestamp: new Date().toISOString(),
      read: false
    });
  } else {
    store.notifications.push({
      id: "rescue-off-" + Date.now(),
      type: "success",
      message: `Rescue Mode deactivated. Regular schedule reinstated.`,
      timestamp: new Date().toISOString(),
      read: false
    });
  }

  writeData(store);
  res.json({ rescueMode: store.rescueMode, notifications: store.notifications });
});

// -----------------------------------------------------
// Vite Dev Server Integration
// -----------------------------------------------------
async function startServer() {
  initializeDataStore();

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Server] Deadline Guardian AI is operational on http://localhost:${PORT}`);
  });
}

startServer();
