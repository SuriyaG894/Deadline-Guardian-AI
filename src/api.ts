/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Task, CalendarEvent, ExecutionPlan, ProgressLog, SystemNotification, Analytics } from './types';

export async function login() {
  const res = await fetch('/api/login', { method: 'POST' });
  return res.json();
}

export async function logout() {
  const res = await fetch('/api/logout', { method: 'POST' });
  return res.json();
}

export async function fetchTasks(): Promise<Task[]> {
  const res = await fetch('/api/tasks');
  return res.json();
}

export async function createTask(taskData: Partial<Task>): Promise<Task> {
  const res = await fetch('/api/tasks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(taskData)
  });
  return res.json();
}

export async function updateTask(id: string, updates: Partial<Task> & { comment?: string }): Promise<Task> {
  const res = await fetch(`/api/tasks/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates)
  });
  return res.json();
}

export async function deleteTask(id: string): Promise<{ success: boolean }> {
  const res = await fetch(`/api/tasks/${id}`, { method: 'DELETE' });
  return res.json();
}

export async function fetchCalendarEvents(): Promise<{ connected: boolean; events?: CalendarEvent[]; error?: string; apiDisabled?: boolean; details?: string }> {
  const res = await fetch('/api/calendar/events');
  return res.json();
}

export async function toggleCalendarConnection(accessToken?: string): Promise<{ connected: boolean; events?: CalendarEvent[]; error?: string; apiDisabled?: boolean; details?: string }> {
  const res = await fetch('/api/calendar/connect', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ accessToken })
  });
  return res.json();
}

export async function generateExecutionPlan(taskId: string, tasks?: Task[], calendarEvents?: CalendarEvent[], localTime?: string): Promise<ExecutionPlan> {
  const res = await fetch('/api/ai/plan', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ taskId, tasks, calendarEvents, localTime })
  });
  return res.json();
}

export async function approveExecutionPlan(
  planId: string, 
  executionPlans?: ExecutionPlan[], 
  calendarEvents?: CalendarEvent[]
): Promise<{ success: boolean; plan: ExecutionPlan; newEvents?: CalendarEvent[] }> {
  const res = await fetch('/api/ai/plan/approve', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ planId, executionPlans, calendarEvents })
  });
  return res.json();
}

export async function checkInSession(data: {
  taskId: string;
  status: 'completed' | 'partially_completed' | 'failed';
  progressVal?: number;
  textFeedback?: string;
  tasks?: Task[];
  rescueMode?: boolean;
}): Promise<{ task: Task; coachingAdvice: string; rescueMode: boolean; newLog?: any; newNotification?: any }> {
  const res = await fetch('/api/ai/checkin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  return res.json();
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
  rescueMode?: boolean
): Promise<ChatResponse> {
  const res = await fetch('/api/ai/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, context, tasks, calendarEvents, rescueMode })
  });
  return res.json();
}

export async function fetchAnalytics(tasks?: Task[], calendarEvents?: CalendarEvent[]): Promise<Analytics> {
  const isPost = Array.isArray(tasks);
  const res = await fetch('/api/analytics', {
    method: isPost ? 'POST' : 'GET',
    headers: isPost ? { 'Content-Type': 'application/json' } : undefined,
    body: isPost ? JSON.stringify({ tasks, calendarEvents }) : undefined
  });
  return res.json();
}

export async function fetchNotifications(): Promise<SystemNotification[]> {
  const res = await fetch('/api/notifications');
  return res.json();
}

export async function markNotificationsRead(): Promise<SystemNotification[]> {
  const res = await fetch('/api/notifications/read', { method: 'POST' });
  return res.json();
}

export async function toggleRescueMode(): Promise<{ rescueMode: boolean; notifications: SystemNotification[] }> {
  const res = await fetch('/api/ai/rescue/toggle', { method: 'POST' });
  return res.json();
}
