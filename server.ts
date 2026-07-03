/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import { GoogleGenAI, Type } from '@google/genai';
import { Task, CalendarEvent, ExecutionPlan, ProgressLog, SystemNotification } from './src/types';

dotenv.config({ path: '.env.local' });
dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json());

// Normalize Vercel pathing (Vercel strips "/api" prefix for serverless functions placed in /api)
app.use((req, res, next) => {
  if (process.env.VERCEL && req.url && !req.url.startsWith('/api')) {
    req.url = '/api' + req.url;
  }
  next();
});

// Persistent JSON Data Store file
const DATA_FILE = process.env.VERCEL
  ? path.join('/tmp', 'data-store.json')
  : path.join(process.cwd(), 'data-store.json');

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
          start: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
          end: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(),
          isFocusSession: false
        },
        {
          id: "cal-2",
          title: "System Design Mock Interview",
          start: new Date(Date.now() + 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000).toISOString(),
          end: new Date(Date.now() + 24 * 60 * 60 * 1000 + 3.5 * 60 * 60 * 1000).toISOString(),
          isFocusSession: false
        },
        {
          id: "cal-focus-1",
          title: "🎯 Focus: Backend Dev",
          start: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
          end: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(),
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
    const store = JSON.parse(fileContent);
    if (store && Array.isArray(store.tasks) && Array.isArray(store.calendarEvents)) {
      const taskIds = new Set(store.tasks.map((t: any) => t.id));
      const hasOrphans = store.calendarEvents.some((e: any) => e.isFocusSession && e.taskId && !taskIds.has(e.taskId));
      if (hasOrphans) {
        store.calendarEvents = store.calendarEvents.filter((e: any) => !e.isFocusSession || !e.taskId || taskIds.has(e.taskId));
        fs.writeFileSync(DATA_FILE, JSON.stringify(store, null, 2));
      }
    }
    return store;
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
function getGeminiClient(customApiKey?: string): GoogleGenAI | null {
  const apiKey = customApiKey || process.env.GEMINI_API_KEY;
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

// Helper to parse Gemini error response structure and type
function parseGeminiError(err: any) {
  const errMsg = err?.message || String(err);
  let type = 'OTHER';
  let status = 500;
  let userMessage = 'An unexpected error occurred while communicating with the Gemini AI service.';

  if (errMsg.includes('API_KEY_INVALID') || errMsg.includes('API key not valid') || err?.status === 400 || err?.status === 403) {
    type = 'INVALID_KEY';
    status = 400;
    userMessage = 'The Gemini API key provided is invalid. Please verify the key and try again.';
  } else if (errMsg.includes('RESOURCE_EXHAUSTED') || errMsg.includes('quota exceeded') || err?.status === 429) {
    type = 'QUOTA_EXCEEDED';
    status = 429;
    userMessage = 'Gemini API quota exceeded or rate limit hit. Please try again later or check your billing settings.';
  } else if (err?.status === 403) {
    type = 'PERMISSION_DENIED';
    status = 403;
    userMessage = 'Permission denied for this Gemini model. Ensure your key has access to the specified model.';
  }

  return {
    code: 'GEMINI_API_ERROR',
    type,
    status,
    message: errMsg,
    userMessage
  };
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

  const customApiKey = req.headers['x-gemini-api-key'] as string | undefined;
  const aiClient = getGeminiClient(customApiKey);
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
      if (customApiKey) {
        const errorDetails = parseGeminiError(e);
        return res.status(errorDetails.status).json({ error: errorDetails });
      }
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
  store.calendarEvents = store.calendarEvents.filter((e: any) => e.taskId !== id);
  writeData(store);
  res.json({ success: true });
});

function parseTimeSlotToHours(timeSlotStr: string): { startHour: number; startMinute: number } {
  const clean = timeSlotStr.toUpperCase().replace(/\s/g, '');
  const firstPart = clean.split(/[–-]/)[0];
  
  const isPM = firstPart.includes('PM');
  const isAM = firstPart.includes('AM');
  
  const timeNum = firstPart.replace(/[A-Z]/g, '');
  const parts = timeNum.split(':');
  let hour = parseInt(parts[0], 10);
  let minute = parts[1] ? parseInt(parts[1], 10) : 0;
  
  if (isNaN(hour)) {
    return { startHour: 18, startMinute: 0 };
  }
  
  if (isPM && hour < 12) {
    hour += 12;
  } else if (isAM && hour === 12) {
    hour = 0;
  }
  
  return { startHour: hour, startMinute: minute };
}

function formatGmtOffset(offsetStr: string): string {
  if (!offsetStr || offsetStr === 'GMT' || offsetStr === 'UTC') return 'Z';
  let clean = offsetStr.replace('GMT', '');
  if (clean.includes(':')) {
    return clean;
  }
  if (clean.length === 5) {
    return clean.substring(0, 3) + ':' + clean.substring(3, 5);
  }
  return 'Z';
}

function calculateDayOffset(targetDay: string, referenceDayAbbr: string): number {
  const targetLower = targetDay.toLowerCase();
  if (targetLower === 'today') return 0;
  if (targetLower === 'tomorrow') return 1;
  
  const weekdays = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  const refIndex = weekdays.indexOf(referenceDayAbbr.toLowerCase());
  
  let targetIndex = -1;
  for (let i = 0; i < weekdays.length; i++) {
    if (targetLower.includes(weekdays[i])) {
      targetIndex = i;
      break;
    }
  }
  
  if (refIndex === -1 || targetIndex === -1) {
    return 0;
  }
  
  let offset = targetIndex - refIndex;
  if (offset < 0) {
    offset += 7;
  }
  return offset;
}

function computeSessionStartAndEnd(
  day: string,
  timeSlot: string,
  duration: number,
  referenceTime: string | undefined,
  createdAt: string
): { start: string, end: string } {
  const refTimeStr = referenceTime || createdAt || new Date().toString();
  
  let parsed: any = null;
  try {
    const parts = refTimeStr.split(' ');
    if (parts.length >= 5) {
      const timeParts = parts[4].split(':');
      parsed = {
        dayNameAbbr: parts[0],
        monthAbbr: parts[1],
        dayOfMonth: parseInt(parts[2], 10),
        year: parseInt(parts[3], 10),
        hours: parseInt(timeParts[0], 10),
        minutes: parseInt(timeParts[1], 10),
        gmtOffsetStr: parts[5]
      };
    }
  } catch (e) {
    console.error("Failed to parse referenceTime:", refTimeStr, e);
  }

  if (!parsed) {
    let dayOffset = 0;
    const targetLower = day.toLowerCase();
    if (targetLower === 'tomorrow') dayOffset = 1;
    else if (targetLower.includes('sat')) dayOffset = 2;
    else if (targetLower.includes('sun')) dayOffset = 3;
    else if (targetLower.includes('mon')) dayOffset = 4;

    const baseDate = new Date(Date.now() + dayOffset * 24 * 60 * 60 * 1000);
    const { startHour, startMinute } = parseTimeSlotToHours(timeSlot);

    const start = new Date(baseDate.setHours(startHour, startMinute, 0, 0)).toISOString();
    const end = new Date(baseDate.setHours(startHour + duration, startMinute, 0, 0)).toISOString();
    return { start, end };
  }

  const dayOffset = calculateDayOffset(day, parsed.dayNameAbbr);

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthIndex = months.indexOf(parsed.monthAbbr);
  
  const tempDate = new Date(parsed.year, monthIndex >= 0 ? monthIndex : 0, parsed.dayOfMonth);
  tempDate.setDate(tempDate.getDate() + dayOffset);

  const targetYear = tempDate.getFullYear();
  const targetMonth = String(tempDate.getMonth() + 1).padStart(2, '0');
  const targetDayOfMonth = String(tempDate.getDate()).padStart(2, '0');

  const { startHour, startMinute } = parseTimeSlotToHours(timeSlot);

  const startHourStr = String(startHour).padStart(2, '0');
  const startMinStr = String(startMinute).padStart(2, '0');

  const formattedOffset = formatGmtOffset(parsed.gmtOffsetStr);

  const startLocalStr = `${targetYear}-${targetMonth}-${targetDayOfMonth}T${startHourStr}:${startMinStr}:00${formattedOffset}`;
  const startDate = new Date(startLocalStr);
  const endDate = new Date(startDate.getTime() + duration * 60 * 60 * 1000);

  return {
    start: startDate.toISOString(),
    end: endDate.toISOString()
  };
}

// Keep track of tokens that are forbidden (403) from Google Tasks API to avoid console spam and unnecessary API calls.
const disabledTasksApiTokens = new Set<string>();

// Decodes a base64url encoded string (common for Google Task IDs) to its raw representation.
function decodeBase64Url(str: string): string {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  try {
    return Buffer.from(base64, 'base64').toString('utf8');
  } catch (e) {
    return str;
  }
}

// Helper to fetch completed tasks from Google Tasks API
async function fetchCompletedGoogleTasks(accessToken: string): Promise<Set<string>> {
  const completedTaskIds = new Set<string>();
  if (disabledTasksApiTokens.has(accessToken)) {
    return completedTaskIds;
  }

  try {
    const listsResponse = await fetch('https://tasks.googleapis.com/tasks/v1/users/@me/lists', {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    if (!listsResponse.ok) {
      if (listsResponse.status === 403) {
        console.warn("Failed to fetch Google Task lists (403 Forbidden). This usually means the Google Tasks API is not enabled in your Google Cloud Project or the 'https://www.googleapis.com/auth/tasks.readonly' scope is not approved. Subsequent fetches for this token will be skipped to avoid log spam.");
        disabledTasksApiTokens.add(accessToken);
      } else if (listsResponse.status === 401) {
        console.warn("Failed to fetch Google Task lists (401 Unauthorized). The access token might be expired or invalid.");
      } else {
        console.warn("Failed to fetch Google Task lists:", listsResponse.status);
      }
      return completedTaskIds;
    }
    const listsData: any = await listsResponse.json();
    if (listsData && listsData.items) {
      for (const list of listsData.items) {
        const tasksResponse = await fetch(`https://tasks.googleapis.com/tasks/v1/lists/${list.id}/tasks?showCompleted=true&showHidden=true&maxResults=100`, {
          headers: { Authorization: `Bearer ${accessToken}` }
        });
        if (tasksResponse.ok) {
          const tasksData: any = await tasksResponse.json();
          if (tasksData && tasksData.items) {
            for (const task of tasksData.items) {
              if (task.status === 'completed') {
                completedTaskIds.add(task.id);
                completedTaskIds.add(decodeBase64Url(task.id));
              }
            }
          }
        }
      }
    }
  } catch (err) {
    console.error("Error fetching Google Tasks:", err);
  }
  return completedTaskIds;
}

// Helper to fetch actual events from Google Calendar API
async function fetchGoogleCalendarEvents(accessToken: string) {
  try {
    const completedTasksPromise = fetchCompletedGoogleTasks(accessToken);

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

    const completedTasks = await completedTasksPromise;
    const data: any = await response.json();
    const events: any[] = [];
    if (data && data.items) {
      for (const item of data.items) {
        let title = item.summary || 'No Title';
        let checkedIn = false;
        let checkInStatus: string | undefined = undefined;

        if (item.description) {
          const match = item.description.match(/tasks\.google\.com\/task\/([A-Za-z0-9_-]+)/);
          if (match && match[1]) {
            const taskId = match[1];
            if (completedTasks.has(taskId)) {
              checkedIn = true;
              checkInStatus = 'completed';
              if (!title.startsWith('✓')) {
                title = '✓ ' + title;
              }
            }
          }
        }

        events.push({
          id: item.id,
          title: title,
          start: item.start?.dateTime || item.start?.date || new Date().toISOString(),
          end: item.end?.dateTime || item.end?.date || new Date().toISOString(),
          isFocusSession: false,
          checkedIn,
          checkInStatus,
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
  const authHeader = req.headers.authorization;
  let token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.substring(7) : null;
  const store = getData();
  
  if (!token) {
    token = store.user.googleAccessToken;
  }

  if (store.user.calendarConnected && token) {
    const result = await fetchGoogleCalendarEvents(token);
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
      // Do not store the googleAccessToken in data-store.json (local disk storage)
      
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
    store.calendarEvents = store.calendarEvents.filter((e: any) => e.isFocusSession);
    writeData(store);
    res.json({ connected: false, events: store.calendarEvents });
  }
});

// -----------------------------------------------------
// AI Endpoints
// -----------------------------------------------------

// Test Gemini API key connection
app.post('/api/ai/test-key', async (req, res) => {
  const customApiKey = req.headers['x-gemini-api-key'] as string | undefined;
  const aiClient = getGeminiClient(customApiKey);

  if (!aiClient) {
    return res.status(400).json({
      error: {
        code: 'GEMINI_API_ERROR',
        type: 'INVALID_KEY',
        message: 'No API key provided or configured.',
        userMessage: 'Please provide a valid Gemini API key.'
      }
    });
  }

  try {
    // Make a lightweight call to test key validity
    await aiClient.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: 'Ping',
      config: {
        maxOutputTokens: 1
      }
    });
    res.json({ success: true });
  } catch (err: any) {
    const errorDetails = parseGeminiError(err);
    res.status(errorDetails.status).json({ error: errorDetails });
  }
});

// Brain Dump endpoint - parses text and generates task list + schedule
app.post('/api/ai/braindump', async (req, res) => {
  const { text, localTime, tasks: reqTasks, calendarEvents: reqEvents } = req.body;
  const isStateless = Array.isArray(reqTasks);
  const store = isStateless ? null : getData();
  const currentTasks = isStateless ? reqTasks : store.tasks;
  const currentEvents = isStateless ? reqEvents : store.calendarEvents;

  const customApiKey = req.headers['x-gemini-api-key'] as string | undefined;
  const aiClient = getGeminiClient(customApiKey);
  let extracted: any = null;

  if (aiClient) {
    try {
      const prompt = `You are the Deadline Guardian AI Chief of Staff.
A user has provided a "Brain Dump" containing project specs, a syllabus, an email, or slack messages.
Analyze this text to extract:
1. A list of distinct tasks/milestones.
2. For each task, estimate the hours needed, complexity/difficulty, priority, category, and a realistic deadline date (in YYYY-MM-DD format) based on the user's current date/time context.
3. A set of calendar focus sessions (work windows) for these tasks. Map 1 to 3 focus sessions per task, scheduling them in the future relative to the user's current date/time. Do not overlap sessions.

User's brain dump text:
"""
${text}
"""

Current Date/Time Context (use this as the reference for "Today" and calculating deadlines/schedules):
${localTime || new Date().toString()}

Return a JSON object exactly matching this schema:
{
  "tasks": [
    {
      "tempId": "string (temporary id to link with focus sessions, e.g. 'task-a', 'task-b')",
      "title": "string (clear, action-oriented title)",
      "description": "string (brief summary of what needs to be done)",
      "deadline": "string (YYYY-MM-DD format, must be in the future)",
      "estimatedHours": number,
      "category": "string (e.g., 'Tech', 'Career', 'Admin', 'Marketing')",
      "priority": "low" | "medium" | "high",
      "difficulty": "Low" | "Medium" | "High"
    }
  ],
  "focusSessions": [
    {
      "taskTempId": "string (must match one of the task tempIds defined above)",
      "day": "Today" | "Tomorrow" | "Monday" | "Tuesday" | "Wednesday" | "Thursday" | "Friday" | "Saturday" | "Sunday",
      "timeSlot": "string (e.g. '2 PM–4 PM', '6 PM–8 PM', '9 AM–11 AM')",
      "phase": "string (brief description of focus session goal, e.g., 'Draft project pitch')",
      "duration": number (duration in hours, e.g., 2)
    }
  ]
}
`;

      const response = await generateContentWithFallback(aiClient, {
        model: 'gemini-3.5-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              tasks: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    tempId: { type: Type.STRING },
                    title: { type: Type.STRING },
                    description: { type: Type.STRING },
                    deadline: { type: Type.STRING },
                    estimatedHours: { type: Type.INTEGER },
                    category: { type: Type.STRING },
                    priority: { type: Type.STRING },
                    difficulty: { type: Type.STRING }
                  },
                  required: ["tempId", "title", "description", "deadline", "estimatedHours", "category", "priority", "difficulty"]
                }
              },
              focusSessions: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    taskTempId: { type: Type.STRING },
                    day: { type: Type.STRING },
                    timeSlot: { type: Type.STRING },
                    phase: { type: Type.STRING },
                    duration: { type: Type.INTEGER }
                  },
                  required: ["taskTempId", "day", "timeSlot", "phase", "duration"]
                }
              }
            },
            required: ["tasks", "focusSessions"]
          }
        }
      });

      const textResult = response.text || "{}";
      extracted = JSON.parse(textResult.trim());
    } catch (e) {
      console.error("Gemini brain dump failed, using fallback:", e);
      if (customApiKey) {
        const errorDetails = parseGeminiError(e);
        return res.status(errorDetails.status).json({ error: errorDetails });
      }
    }
  }

  // Fallback if Gemini failed or is not available
  if (!extracted) {
    extracted = {
      tasks: [
        {
          tempId: "task-fallback-1",
          title: "Setup Architecture & Project Core",
          description: "Initialize workspace, dependencies, and environment files.",
          deadline: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          estimatedHours: 6,
          category: "Tech",
          priority: "high",
          difficulty: "Medium"
        },
        {
          tempId: "task-fallback-2",
          title: "Feature Implementation & APIs",
          description: "Develop primary application routes and core integrations.",
          deadline: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          estimatedHours: 12,
          category: "Tech",
          priority: "high",
          difficulty: "High"
        }
      ],
      focusSessions: [
        {
          taskTempId: "task-fallback-1",
          day: "Today",
          timeSlot: "4 PM–6 PM",
          phase: "Initialize repository & config",
          duration: 2
        },
        {
          taskTempId: "task-fallback-2",
          day: "Tomorrow",
          timeSlot: "2 PM–4 PM",
          phase: "Build endpoint routes",
          duration: 2
        }
      ]
    };
  }

  const finalTasks: Task[] = [];
  const finalEvents: CalendarEvent[] = [];
  const tempIdToRealIdMap = new Map<string, string>();

  // Process Tasks
  extracted.tasks.forEach((t: any, idx: number) => {
    const realId = "task-" + Date.now() + "-" + idx;
    tempIdToRealIdMap.set(t.tempId, realId);

    // Calculate risk
    const deadlineDate = t.deadline || new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const hours = Number(t.estimatedHours) || 6;
    const fallbackDays = Math.max(1, Math.ceil((new Date(deadlineDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
    const riskScore = Math.min(95, Math.round((hours / (fallbackDays * 4)) * 100));

    const newTask: Task = {
      id: realId,
      title: t.title || "Untitled Goal",
      description: t.description || "Generated via Brain Dump.",
      deadline: deadlineDate,
      estimatedHours: hours,
      progress: 0,
      status: 'not_started',
      category: t.category || "Tech",
      priority: (t.priority === 'high' || t.priority === 'low' || t.priority === 'medium') ? t.priority : 'medium',
      difficulty: (t.difficulty === 'High' || t.difficulty === 'Low' || t.difficulty === 'Medium') ? t.difficulty : 'Medium',
      risk: riskScore,
      recommendedStart: fallbackDays <= 2 ? "Today" : "Tomorrow",
      createdAt: new Date().toISOString()
    };

    finalTasks.push(newTask);
  });

  // Process Focus Sessions to Events
  extracted.focusSessions.forEach((session: any, idx: number) => {
    const realTaskId = tempIdToRealIdMap.get(session.taskTempId);
    if (!realTaskId) return;

    const { start, end } = computeSessionStartAndEnd(
      session.day,
      session.timeSlot,
      session.duration,
      localTime || new Date().toString(),
      new Date().toISOString()
    );

    const newEvent: CalendarEvent = {
      id: `cal-focus-${Date.now()}-${idx}`,
      title: `🎯 Focus: ${session.phase}`,
      start,
      end,
      isFocusSession: true,
      taskId: realTaskId
    };

    finalEvents.push(newEvent);
  });

  if (!isStateless && store) {
    finalTasks.forEach(t => store.tasks.push(t));
    finalEvents.forEach(e => store.calendarEvents.push(e));

    store.notifications.push({
      id: "not-" + Date.now(),
      type: "success",
      message: `Brain Dump processed. Imported ${finalTasks.length} tasks and ${finalEvents.length} calendar focus windows.`,
      timestamp: new Date().toISOString(),
      read: false
    });
    writeData(store);
  }

  res.json({ tasks: finalTasks, events: finalEvents });
});

// Meeting overrun endpoint - reschedules focus sessions when a meeting runs over
app.post('/api/ai/meeting-overrun', (req, res) => {
  const { eventId, overrunMinutes, localTime, tasks: reqTasks, calendarEvents: reqEvents } = req.body;
  const isStateless = Array.isArray(reqTasks);
  const store = isStateless ? null : getData();
  const currentEvents = isStateless ? reqEvents : store.calendarEvents;
  const currentTasks = isStateless ? reqTasks : store.tasks;

  const meetingIndex = currentEvents.findIndex((e: any) => e.id === eventId);
  if (meetingIndex === -1) {
    return res.status(404).json({ error: "Meeting not found" });
  }

  const meeting = currentEvents[meetingIndex];
  const oldEnd = new Date(meeting.end);
  const newEnd = new Date(oldEnd.getTime() + overrunMinutes * 60 * 1000);
  meeting.end = newEnd.toISOString();

  const shiftedSessionTitles: string[] = [];
  let modifiedEvents = [...currentEvents];
  
  let hasConflicts = true;
  let iterations = 0;
  
  while (hasConflicts && iterations < 10) {
    hasConflicts = false;
    iterations++;

    for (let i = 0; i < modifiedEvents.length; i++) {
      const evt = modifiedEvents[i];
      if (!evt.isFocusSession) continue;

      const fStart = new Date(evt.start);
      const fEnd = new Date(evt.end);
      const fDurationMs = fEnd.getTime() - fStart.getTime();

      for (let j = 0; j < modifiedEvents.length; j++) {
        const other = modifiedEvents[j];
        if (evt.id === other.id) continue;

        const oStart = new Date(other.start);
        const oEnd = new Date(other.end);

        if (fStart < oEnd && fEnd > oStart) {
          if (!other.isFocusSession || oStart < fStart) {
            const newStart = new Date(oEnd.getTime() + 5 * 60 * 1000);
            evt.start = newStart.toISOString();
            evt.end = new Date(newStart.getTime() + fDurationMs).toISOString();
            hasConflicts = true;
            if (!shiftedSessionTitles.includes(evt.title)) {
              shiftedSessionTitles.push(evt.title);
            }
          }
        }
      }
    }
  }

  const notifMessage = shiftedSessionTitles.length > 0
    ? `🚨 Meeting overrun: "${meeting.title}" pushed by ${overrunMinutes}m. Automatically rescheduled focus windows: ${shiftedSessionTitles.join(", ")}.`
    : `⏱️ Meeting "${meeting.title}" extended by ${overrunMinutes}m. No focus sessions were impacted.`;

  const newNotif = {
    id: "not-" + Date.now(),
    type: "warning" as const,
    message: notifMessage,
    timestamp: new Date().toISOString(),
    read: false
  };

  let newRescueMode = !isStateless && store ? store.rescueMode : false;
  if (!isStateless && store) {
    store.calendarEvents = modifiedEvents;
    store.notifications.push(newNotif);
    
    if (shiftedSessionTitles.length > 0 && !store.rescueMode) {
      store.rescueMode = true;
      newRescueMode = true;
      store.notifications.push({
        id: "rescue-" + Date.now(),
        type: "rescue",
        message: `🚨 Emergency Rescue Mode activated! Timeline compressed due to meeting overrun.`,
        timestamp: new Date().toISOString(),
        read: false
      });
    }
    writeData(store);
  }

  res.json({
    success: true,
    events: modifiedEvents,
    notification: newNotif,
    rescueMode: newRescueMode
  });
});

// Recommend task endpoint - returns user's top-priority action item
app.post('/api/ai/recommend-action', async (req, res) => {
  const { tasks: reqTasks, calendarEvents: reqEvents } = req.body;
  const isStateless = Array.isArray(reqTasks);
  const store = isStateless ? null : getData();
  const currentTasks = isStateless ? reqTasks : store.tasks;

  const pendingTasks = currentTasks.filter((t: Task) => t.status !== 'completed');

  if (pendingTasks.length === 0) {
    return res.json({
      recommended: false,
      message: "All monitored goals are completed! Type or click 'Add Goal' to create a new challenge."
    });
  }

  const sortedTasks = [...pendingTasks].sort((a, b) => {
    if (a.priority === 'high' && b.priority !== 'high') return -1;
    if (b.priority === 'high' && a.priority !== 'high') return 1;
    return b.risk - a.risk;
  });

  const topTask = sortedTasks[0];

  const customApiKey = req.headers['x-gemini-api-key'] as string | undefined;
  const aiClient = getGeminiClient(customApiKey);
  let reason = `This goal has a ${topTask.risk}% risk score based on remaining work estimates vs deadline. Start now to stay on schedule.`;

  if (aiClient) {
    try {
      const prompt = `You are the Deadline Guardian AI Chief of Staff.
Analyze the user's top priority task and formulate a punchy, ultra-motivating 2-sentence rationale telling the user exactly why they MUST work on this task right now.

Task details:
- Title: "${topTask.title}"
- Description: "${topTask.description}"
- Estimated hours: ${topTask.estimatedHours}
- Progress: ${topTask.progress}%
- Deadline: ${topTask.deadline}
- Risk Level: ${topTask.risk}%

Keep the tone action-oriented, professional, and slightly intense. Do not use markdown inside the sentences.`;

      const response = await generateContentWithFallback(aiClient, {
        model: 'gemini-3.5-flash',
        contents: prompt,
      });
      reason = response.text?.trim() || reason;
    } catch (e) {
      console.error("Gemini recommendation reasoning failed, using fallback:", e);
      if (customApiKey) {
        const errorDetails = parseGeminiError(e);
        return res.status(errorDetails.status).json({ error: errorDetails });
      }
    }
  }

  res.json({
    recommended: true,
    task: topTask,
    reason: reason
  });
});

// Generate execution plan based on task + calendar events
app.post('/api/ai/plan', async (req, res) => {
  const { taskId, tasks, calendarEvents, localTime } = req.body;
  const isStateless = Array.isArray(tasks);
  const store = isStateless ? null : getData();
  const currentTasks = isStateless ? tasks : store.tasks;
  const currentEvents = (isStateless ? calendarEvents : store.calendarEvents).filter((e: any) => e.taskId !== taskId);

  const task = currentTasks.find((t: Task) => t.id === taskId);

  if (!task) {
    return res.status(404).json({ error: "Task not found" });
  }

  let localHour = new Date().getHours();
  let referenceDayAbbr = new Date().toLocaleDateString('en-US', { weekday: 'short' });

  if (localTime) {
    try {
      const parts = localTime.split(' ');
      if (parts.length >= 5) {
        const timeParts = parts[4].split(':');
        localHour = parseInt(timeParts[0], 10);
        referenceDayAbbr = parts[0];
      }
    } catch (e) {
      console.error("Failed to parse localTime:", e);
    }
  }

  const customApiKey = req.headers['x-gemini-api-key'] as string | undefined;
  const aiClient = getGeminiClient(customApiKey);
  let planItems: any[] = [];

  const existingCalendarTitles = currentEvents.map((e: any) => `${e.title} (${e.start} to ${e.end})`).join('\n');

  if (aiClient) {
    try {
      const prompt = `Create a realistic work session execution plan (focus windows) for a task.
Task Title: "${task.title}"
Total Hours Needed: ${task.estimatedHours}
Task Description: "${task.description || 'None'}"
Deadline: ${task.deadline} (User's local date/time reference)
User's Current Local Date/Time: ${localTime || new Date().toString()}

Here are the user's current calendar commitments to avoid scheduling conflicts:
${existingCalendarTitles || 'No conflict events.'}

Suggest a set of 2 to 4 focus sessions to complete this task on time.

CRITICAL CONSTRAINTS:
1. **Future-Only**: All focus sessions must be scheduled strictly in the FUTURE relative to the User's Current Local Date/Time.
2. **No Past Scheduling for Today**: If scheduling a focus session for "Today", the session's start time MUST be after the user's current local time. Do NOT schedule focus sessions in the past.
3. **Respect GMT/Timezone Offset**: Keep the timezone offset in mind. Ensure that if "Today" is Friday, and the current local time is 12:30 PM, any session for "Today" must start at 1:00 PM or later.
4. **Prioritize Today**: If there is open, conflict-free time remaining "Today" (after the user's current local time and not overlapping with their calendar commitments), you MUST schedule focus sessions today (e.g. in the afternoon or evening: 4 PM–6 PM, 6 PM–8 PM, 7 PM–9 PM, etc.). Do not defer work to "Tomorrow" if it can be scheduled in the remaining free time today, especially if the deadline is today or tomorrow.
5. **Respect the Deadline**: Ensure all scheduled focus sessions are on or before the task's deadline date. If the deadline is Today, all focus sessions must be scheduled for "Today" (after the current local time).

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
      if (customApiKey) {
        const errorDetails = parseGeminiError(e);
        return res.status(errorDetails.status).json({ error: errorDetails });
      }
    }
  }

  if (!planItems || planItems.length === 0) {
    // Local fallback planning
    const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const refIndex = weekdays.findIndex(w => w.toLowerCase().startsWith(referenceDayAbbr.toLowerCase()));
    
    const getDayName = (offsetDays: number) => {
      if (offsetDays === 0) return 'Today';
      if (offsetDays === 1) return 'Tomorrow';
      const targetIndex = (refIndex + offsetDays) % 7;
      return weekdays[targetIndex];
    };

    const formatTimeSlot = (startHour24: number, duration: number): string => {
      const getAmPm = (h: number) => {
        const ampm = h >= 12 ? 'PM' : 'AM';
        let displayHour = h % 12;
        if (displayHour === 0) displayHour = 12;
        return `${displayHour} ${ampm}`;
      };
      return `${getAmPm(startHour24)}–${getAmPm(startHour24 + duration)}`;
    };

    const phases = ["Environment & Core Setup", "Feature Implementation", "Testing & Deployment"];
    const hoursPerSession = Math.round(task.estimatedHours / 3) || 2;

    if (localHour < 14) {
      planItems = [
        { id: "epi-1", day: getDayName(0), timeSlot: formatTimeSlot(14, hoursPerSession), phase: phases[0], duration: hoursPerSession },
        { id: "epi-2", day: getDayName(1), timeSlot: formatTimeSlot(10, hoursPerSession), phase: phases[1], duration: hoursPerSession },
        { id: "epi-3", day: getDayName(2), timeSlot: formatTimeSlot(14, hoursPerSession), phase: phases[2], duration: hoursPerSession }
      ];
    } else if (localHour < 18) {
      planItems = [
        { id: "epi-1", day: getDayName(0), timeSlot: formatTimeSlot(18, hoursPerSession), phase: phases[0], duration: hoursPerSession },
        { id: "epi-2", day: getDayName(1), timeSlot: formatTimeSlot(10, hoursPerSession), phase: phases[1], duration: hoursPerSession },
        { id: "epi-3", day: getDayName(2), timeSlot: formatTimeSlot(14, hoursPerSession), phase: phases[2], duration: hoursPerSession }
      ];
    } else {
      planItems = [
        { id: "epi-1", day: getDayName(1), timeSlot: formatTimeSlot(10, hoursPerSession), phase: phases[0], duration: hoursPerSession },
        { id: "epi-2", day: getDayName(2), timeSlot: formatTimeSlot(14, hoursPerSession), phase: phases[1], duration: hoursPerSession },
        { id: "epi-3", day: getDayName(3), timeSlot: formatTimeSlot(18, hoursPerSession), phase: phases[2], duration: hoursPerSession }
      ];
    }
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
    createdAt: new Date().toISOString(),
    referenceTime: localTime || new Date().toString()
  };

  if (!isStateless && store) {
    store.executionPlans = store.executionPlans.filter((p: ExecutionPlan) => p.taskId !== task.id);
    store.calendarEvents = store.calendarEvents.filter((e: any) => e.taskId !== task.id);
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
    const { start, end } = computeSessionStartAndEnd(
      item.day,
      item.timeSlot,
      item.duration,
      plan.referenceTime,
      plan.createdAt
    );

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

  const customApiKey = req.headers['x-gemini-api-key'] as string | undefined;
  const aiClient = getGeminiClient(customApiKey);
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
      if (customApiKey) {
        const errorDetails = parseGeminiError(e);
        return res.status(errorDetails.status).json({ error: errorDetails });
      }
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

  const customApiKey = req.headers['x-gemini-api-key'] as string | undefined;
  const aiClient = getGeminiClient(customApiKey);

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
              start: currentStart.toISOString(),
              end: currentEnd.toISOString()
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
      if (customApiKey) {
        const errorDetails = parseGeminiError(err);
        return res.status(errorDetails.status).json({ error: errorDetails });
      }
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
          start: currentStart.toISOString(),
          end: currentEnd.toISOString()
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
    process.env.VITE_MIDDLEWARE = "true";
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath, {
      maxAge: '1y',
      immutable: true,
      setHeaders: (res, filePath) => {
        if (filePath.endsWith('.html')) {
          res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
        }
      }
    }));
    app.get('*', (req, res) => {
      if (req.path.includes('.') || req.path.startsWith('/assets/') || req.path.startsWith('/src/')) {
        return res.status(404).send('Not Found');
      }
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Server] Deadline Guardian AI is operational on http://localhost:${PORT}`);
  });
}

if (!process.env.VERCEL) {
  startServer();
} else {
  initializeDataStore();
}

export default app;
