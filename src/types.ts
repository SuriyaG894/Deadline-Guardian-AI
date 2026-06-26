/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Task {
  id: string;
  title: string;
  description: string;
  deadline: string; // ISO date string or YYYY-MM-DD
  estimatedHours: number;
  progress: number; // percentage 0-100
  status: 'not_started' | 'in_progress' | 'completed' | 'failed';
  category: string;
  priority: 'low' | 'medium' | 'high';
  difficulty: 'Low' | 'Medium' | 'High';
  risk: number; // percentage 0-100
  recommendedStart: string; // relative date/text like "Today", "Tomorrow"
  createdAt: string;
}

export interface CalendarEvent {
  id: string;
  title: string;
  start: string; // ISO string YYYY-MM-DDTHH:mm
  end: string;   // ISO string YYYY-MM-DDTHH:mm
  isFocusSession: boolean;
  taskId?: string;
  checkedIn?: boolean;
  checkInStatus?: 'completed' | 'partially_completed' | 'failed';
  acknowledged?: boolean;
  lastBombTime?: string;
}

export interface ExecutionPlanItem {
  id: string;
  day: string; // e.g., "Today", "Tomorrow", "Saturday"
  timeSlot: string; // e.g., "6 PM–8 PM"
  phase: string; // e.g., "Backend", "Frontend", "Testing"
  duration: number; // hours
}

export interface ExecutionPlan {
  id: string;
  taskId: string;
  taskTitle: string;
  items: ExecutionPlanItem[];
  approved: boolean;
  createdAt: string;
  referenceTime?: string;
}

export interface ProgressLog {
  id: string;
  taskId: string;
  taskTitle: string;
  timestamp: string;
  progress: number;
  comment: string;
  status: string;
}

export interface SystemNotification {
  id: string;
  type: 'info' | 'warning' | 'rescue' | 'success';
  message: string;
  timestamp: string;
  read: boolean;
  eventId?: string;
  isPostSessionPrompt?: boolean;
  isTaskCompletionPrompt?: boolean;
}

export interface Analytics {
  totalTasks: number;
  completedTasks: number;
  highRiskCount: number;
  focusHoursLogged: number;
  productivityScore: number;
  categoryDistribution: Record<string, number>;
}
