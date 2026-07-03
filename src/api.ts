/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Task, CalendarEvent, ExecutionPlan, ProgressLog, SystemNotification, Analytics } from './types';

// Centralized fetch helper that injects x-gemini-api-key header and handles non-OK responses
async function apiFetch(url: string, options: RequestInit = {}, geminiApiKey?: string) {
  const headers = new Headers(options.headers || {});
  if (!headers.has('Content-Type') && options.method && options.method !== 'GET') {
    headers.set('Content-Type', 'application/json');
  }
  if (geminiApiKey) {
    headers.set('x-gemini-api-key', geminiApiKey);
  }
  
  const response = await fetch(url, {
    ...options,
    headers
  });
  
  const data = await response.json().catch(() => ({}));
  
  if (!response.ok) {
    const errorMsg = data.error?.userMessage || data.error?.message || 'API request failed';
    const errObj = new Error(errorMsg) as any;
    errObj.status = response.status;
    errObj.error = data.error;
    throw errObj;
  }
  
  return data;
}

export async function testGeminiApiKey(apiKey: string): Promise<boolean> {
  await apiFetch('/api/ai/test-key', { method: 'POST' }, apiKey);
  return true;
}

export async function login() {
  return apiFetch('/api/login', { method: 'POST' });
}

export async function logout() {
  return apiFetch('/api/logout', { method: 'POST' });
}

export async function fetchTasks(): Promise<Task[]> {
  return apiFetch('/api/tasks');
}

export async function createTask(taskData: Partial<Task>, geminiApiKey?: string): Promise<Task> {
  return apiFetch('/api/tasks', {
    method: 'POST',
    body: JSON.stringify(taskData)
  }, geminiApiKey);
}

export async function updateTask(id: string, updates: Partial<Task> & { comment?: string }): Promise<Task> {
  return apiFetch(`/api/tasks/${id}`, {
    method: 'PUT',
    body: JSON.stringify(updates)
  });
}

export async function deleteTask(id: string): Promise<{ success: boolean }> {
  return apiFetch(`/api/tasks/${id}`, { method: 'DELETE' });
}

export async function fetchCalendarEvents(accessToken?: string): Promise<{ connected: boolean; events?: CalendarEvent[]; error?: string; apiDisabled?: boolean; details?: string }> {
  const headers: Record<string, string> = {};
  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }
  return apiFetch('/api/calendar/events', { headers });
}

export async function toggleCalendarConnection(accessToken?: string): Promise<{ connected: boolean; events?: CalendarEvent[]; error?: string; apiDisabled?: boolean; details?: string }> {
  return apiFetch('/api/calendar/connect', {
    method: 'POST',
    body: JSON.stringify({ accessToken })
  });
}

export async function generateExecutionPlan(taskId: string, tasks?: Task[], calendarEvents?: CalendarEvent[], localTime?: string, geminiApiKey?: string): Promise<ExecutionPlan> {
  return apiFetch('/api/ai/plan', {
    method: 'POST',
    body: JSON.stringify({ taskId, tasks, calendarEvents, localTime })
  }, geminiApiKey);
}

export async function approveExecutionPlan(
  planId: string, 
  executionPlans?: ExecutionPlan[], 
  calendarEvents?: CalendarEvent[]
): Promise<{ success: boolean; plan: ExecutionPlan; newEvents?: CalendarEvent[] }> {
  return apiFetch('/api/ai/plan/approve', {
    method: 'POST',
    body: JSON.stringify({ planId, executionPlans, calendarEvents })
  });
}

export async function checkInSession(data: {
  taskId: string;
  status: 'completed' | 'partially_completed' | 'failed';
  progressVal?: number;
  textFeedback?: string;
  tasks?: Task[];
  rescueMode?: boolean;
}, geminiApiKey?: string): Promise<{ task: Task; coachingAdvice: string; rescueMode: boolean; newLog?: any; newNotification?: any }> {
  return apiFetch('/api/ai/checkin', {
    method: 'POST',
    body: JSON.stringify(data)
  }, geminiApiKey);
}

export interface ChatResponse {
  reply: string;
  intent: string;
  effect: { 
    type: string; 
    task?: Task; 
    events?: CalendarEvent[]; 
    log?: any; 
    rescueMode?: boolean; 
    notification?: any; 
  } | null;
  storeState?: any;
}

export async function sendChatMessage(
  message: string, 
  context?: any, 
  tasks?: Task[], 
  calendarEvents?: CalendarEvent[], 
  rescueMode?: boolean,
  geminiApiKey?: string
): Promise<ChatResponse> {
  return apiFetch('/api/ai/chat', {
    method: 'POST',
    body: JSON.stringify({ message, context, tasks, calendarEvents, rescueMode })
  }, geminiApiKey);
}

export async function fetchAnalytics(tasks?: Task[], calendarEvents?: CalendarEvent[]): Promise<Analytics> {
  const isPost = Array.isArray(tasks);
  return apiFetch('/api/analytics', {
    method: isPost ? 'POST' : 'GET',
    body: isPost ? JSON.stringify({ tasks, calendarEvents }) : undefined
  });
}

export async function fetchNotifications(): Promise<SystemNotification[]> {
  return apiFetch('/api/notifications');
}

export async function markNotificationsRead(): Promise<SystemNotification[]> {
  return apiFetch('/api/notifications/read', { method: 'POST' });
}

export async function toggleRescueMode(): Promise<{ rescueMode: boolean; notifications: SystemNotification[] }> {
  return apiFetch('/api/ai/rescue/toggle', { method: 'POST' });
}

export async function importBrainDump(
  text: string, 
  localTime: string, 
  tasks?: Task[], 
  calendarEvents?: CalendarEvent[],
  geminiApiKey?: string
): Promise<{ tasks: Task[]; events: CalendarEvent[] }> {
  return apiFetch('/api/ai/braindump', {
    method: 'POST',
    body: JSON.stringify({ text, localTime, tasks, calendarEvents })
  }, geminiApiKey);
}

export async function triggerMeetingOverrun(
  eventId: string, 
  overrunMinutes: number, 
  localTime: string, 
  tasks?: Task[], 
  calendarEvents?: CalendarEvent[]
): Promise<{ success: boolean; events: CalendarEvent[]; notification: SystemNotification; rescueMode: boolean }> {
  return apiFetch('/api/ai/meeting-overrun', {
    method: 'POST',
    body: JSON.stringify({ eventId, overrunMinutes, localTime, tasks, calendarEvents })
  });
}

export async function getRecommendedAction(
  tasks: Task[], 
  calendarEvents: CalendarEvent[],
  geminiApiKey?: string
): Promise<{ recommended: boolean; task?: Task; reason?: string; message?: string }> {
  return apiFetch('/api/ai/recommend-action', {
    method: 'POST',
    body: JSON.stringify({ tasks, calendarEvents })
  }, geminiApiKey);
}
