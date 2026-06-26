/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Bot, ShieldAlert, Sparkles, Plus, CheckCircle, 
  Trash2, Layers, Calendar, AlertTriangle, ShieldCheck, 
  HelpCircle, RefreshCw, BarChart2, Bell, CheckSquare, 
  TrendingUp, CircleAlert, HelpCircle as HelpIcon, LogOut 
} from 'lucide-react';
import { 
  fetchTasks, updateTask, deleteTask, fetchCalendarEvents, 
  toggleCalendarConnection, generateExecutionPlan, fetchAnalytics, 
  fetchNotifications, markNotificationsRead, toggleRescueMode 
} from './api';
import { Task, CalendarEvent, ExecutionPlan, SystemNotification, Analytics } from './types';
import VoiceAndChat from './components/VoiceAndChat';
import TaskForm from './components/TaskForm';
import CalendarView from './components/CalendarView';
import ExecutionPlanView from './components/ExecutionPlanView';
import CheckInModal from './components/CheckInModal';
import AuthPage from './components/AuthPage';
import { 
  auth, 
  getUserMetadata, 
  getUserTasks, 
  getUserEvents, 
  getUserNotifications, 
  getUserPlans, 
  saveUserMetadata, 
  saveUserTask, 
  saveUserEvent, 
  saveUserNotification, 
  saveUserPlan, 
  deleteUserTask, 
  deleteUserEvent, 
  deleteUserPlan,
  deleteUserNotification,
  clearUserNotifications, 
  signInWithGoogleCalendar,
  logoutUser
} from './firebase';
import { onAuthStateChanged } from 'firebase/auth';

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [tasks, setTasks] = useState<Task[]>([]);
  const [calendarConnected, setCalendarConnected] = useState(false);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [notifications, setNotifications] = useState<SystemNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [activePlan, setActivePlan] = useState<ExecutionPlan | null>(null);
  const [rescueMode, setRescueMode] = useState(false);

  // Form states
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [isGeneratingPlan, setIsGeneratingPlan] = useState(false);

  // Check-in modal states
  const [checkInTask, setCheckInTask] = useState<{ id: string; title: string } | null>(null);

  // Refresh data trigger
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const refreshAllData = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  // Auth State Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (!currentUser) {
        const demoUser = localStorage.getItem('guardian_demo_user');
        if (demoUser) {
          setUser(JSON.parse(demoUser));
          setAuthLoading(false);
          return;
        }
      }
      setUser(currentUser);
      setAuthLoading(false);
    });
    return unsubscribe;
  }, []);

  // Sync state from Firestore when user changes or updates
  useEffect(() => {
    if (!user) return;
    
    async function loadUserData() {
      try {
        const uid = user.uid;
        const isDemoUser = uid === 'demo-user';
        
        let [tasksList, eventsList, notificationsList, plansList, metadata] = await Promise.all([
          getUserTasks(uid),
          getUserEvents(uid),
          getUserNotifications(uid),
          getUserPlans(uid),
          getUserMetadata(uid)
        ]);

        if (!isDemoUser) {
          const mockTaskIds = ["task-1", "task-2", "task-3"];
          const mockEventIds = ["cal-1", "cal-2", "cal-focus-1"];
          const mockPlanIds = ["plan-1"];
          const mockNotifIds = ["not-1"];

          const hasMockTasks = tasksList.some(t => mockTaskIds.includes(t.id));
          const hasMockEvents = eventsList.some(e => mockEventIds.includes(e.id));
          const hasMockPlans = plansList.some(p => mockPlanIds.includes(p.id));
          const hasMockNotifs = notificationsList.some(n => mockNotifIds.includes(n.id));

          if (hasMockTasks || hasMockEvents || hasMockPlans || hasMockNotifs) {
            tasksList = tasksList.filter(t => !mockTaskIds.includes(t.id));
            eventsList = eventsList.filter(e => !mockEventIds.includes(e.id));
            plansList = plansList.filter(p => !mockPlanIds.includes(p.id));
            notificationsList = notificationsList.filter(n => !mockNotifIds.includes(n.id));

            if (hasMockTasks) {
              mockTaskIds.forEach(id => deleteUserTask(uid, id).catch(e => console.error(e)));
            }
            if (hasMockEvents) {
              mockEventIds.forEach(id => deleteUserEvent(uid, id).catch(e => console.error(e)));
            }
            if (hasMockPlans) {
              mockPlanIds.forEach(id => deleteUserPlan(uid, id).catch(e => console.error(e)));
            }
            if (hasMockNotifs) {
              mockNotifIds.forEach(id => deleteUserNotification(uid, id).catch(e => console.error(e)));
            }
          }
        }

        setTasks(tasksList as Task[]);
        setEvents(eventsList as CalendarEvent[]);
        setNotifications(notificationsList as SystemNotification[]);
        setUnreadCount(notificationsList.filter(n => !n.read).length);
        setRescueMode(!!metadata?.rescueMode);
        const isConnected = !!metadata?.calendarConnected && (isDemoUser || !!metadata?.googleAccessToken);
        setCalendarConnected(isConnected);

        const validPlans = (plansList || []).filter((p: any) => 
          tasksList.some((t: any) => t.id === p.taskId)
        );

        if (validPlans.length > 0) {
          const unapproved = validPlans.find((p: any) => !p.approved);
          if (unapproved) {
            setActivePlan(unapproved as ExecutionPlan);
          } else {
            setActivePlan(validPlans[validPlans.length - 1] as ExecutionPlan);
          }
        } else {
          setActivePlan(null);
        }

        // Calculate stateless analytics
        const analyticsData = await fetchAnalytics(tasksList as Task[], eventsList as CalendarEvent[]);
        setAnalytics(analyticsData);
      } catch (err) {
        console.error("Error loading user firestore data:", err);
      }
    }

    loadUserData();
  }, [user, refreshTrigger]);

  const handleToggleCalendar = async () => {
    if (!user) return;
    const isDemoUser = user.uid === 'demo-user';
    try {
      if (calendarConnected) {
        // Disconnect
        if (isDemoUser) {
          setCalendarConnected(false);
          await saveUserMetadata(user.uid, { calendarConnected: false, googleAccessToken: null });
          setEvents([]);
          refreshAllData();
          return;
        }
        
        const data = await toggleCalendarConnection();
        setCalendarConnected(data.connected);
        await saveUserMetadata(user.uid, { calendarConnected: false, googleAccessToken: null });
        
        // Remove existing events from firestore
        const oldEvents = await getUserEvents(user.uid);
        for (const ev of oldEvents) {
          await deleteUserEvent(user.uid, ev.id);
        }
        setEvents([]);
        refreshAllData();
      } else {
        // Connect
        if (isDemoUser) {
          setCalendarConnected(true);
          await saveUserMetadata(user.uid, { calendarConnected: true, googleAccessToken: "mock-demo-token" });
          const defaultEvents = [
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
            }
          ];
          for (const ev of defaultEvents) {
            await saveUserEvent(user.uid, ev.id, ev);
          }
          setEvents(defaultEvents);
          refreshAllData();
          return;
        }

        // Connect via Google popup
        const token = await signInWithGoogleCalendar();
        if (token) {
          const data = await toggleCalendarConnection(token);
          setCalendarConnected(data.connected);
          await saveUserMetadata(user.uid, { calendarConnected: true, googleAccessToken: token });
          
          // Save loaded events to firestore
          for (const ev of data.events) {
            await saveUserEvent(user.uid, ev.id, ev);
          }
          setEvents(data.events);
          refreshAllData();
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleToggleRescue = async () => {
    if (!user) return;
    try {
      const newRescue = !rescueMode;
      setRescueMode(newRescue);
      await saveUserMetadata(user.uid, { rescueMode: newRescue });

      if (newRescue) {
        const notifId = "rescue-" + Date.now();
        const newNotif = {
          id: notifId,
          type: "rescue" as const,
          message: "🚨 Emergency Rescue Mode activated. Work session pacing accelerated!",
          timestamp: new Date().toISOString(),
          read: false
        };
        await saveUserNotification(user.uid, notifId, newNotif);
      }
      refreshAllData();
    } catch (e) {
      console.error(e);
    }
  };

  const handleTriggerAIPlan = async (taskId: string) => {
    if (!user) return;
    setIsGeneratingPlan(true);
    try {
      const plan = await generateExecutionPlan(taskId, tasks, events);
      await saveUserPlan(user.uid, plan.id, plan);
      setActivePlan(plan);
      refreshAllData();
    } catch (e) {
      console.error(e);
    } finally {
      setIsGeneratingPlan(false);
    }
  };

  const handleMarkComplete = async (taskId: string) => {
    if (!user) return;
    try {
      const matched = tasks.find(t => t.id === taskId);
      if (matched) {
        const updated = { ...matched, progress: 100, status: 'completed' as const, risk: 0 };
        await saveUserTask(user.uid, taskId, updated);
        refreshAllData();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!user) return;
    try {
      await deleteUserTask(user.uid, taskId);
      refreshAllData();
    } catch (e) {
      console.error(e);
    }
  };

  const handleClearNotifications = async () => {
    if (!user) return;
    try {
      await clearUserNotifications(user.uid, notifications.map(n => n.id));
      setUnreadCount(0);
      refreshAllData();
    } catch (e) {
      console.error(e);
    }
  };
  const handleTriggerCheckIn = (taskId: string, sessionTitle: string) => {
    setCheckInTask({ id: taskId, title: sessionTitle });
  };

  // Helper to format deadline days remaining
  const getDaysLeftText = (deadlineStr: string) => {
    const diffMs = new Date(deadlineStr).getTime() - Date.now();
    const days = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    if (days < 0) return "Overdue";
    if (days === 0) return "Due Today";
    if (days === 1) return "Due Tomorrow";
    return `${days} days left`;
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#050505] flex flex-col items-center justify-center space-y-4" id="auth-loading-spinner">
        <Bot className="w-12 h-12 text-red-600 animate-pulse" />
        <p className="text-zinc-400 text-xs font-mono tracking-widest uppercase">Initializing Guardian Systems...</p>
      </div>
    );
  }

  if (!user) {
    return <AuthPage />;
  }

  return (
    <div className="min-h-screen bg-[#050505] font-sans text-white flex flex-col relative" id="deadline-guardian-root">
      {/* Dynamic Ambient Background Elements */}
      <div className="absolute top-0 left-0 right-0 h-64 bg-gradient-to-b from-red-950/5 to-transparent pointer-events-none" />
      <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-red-900/5 blur-3xl pointer-events-none" />
      {rescueMode && (
        <div className="absolute inset-0 border-2 border-red-500/10 pointer-events-none animate-pulse-ring z-40" style={{ animation: 'pulse-ring 3s infinite' }} />
      )}

      {/* Main Header / Navigation */}
      <header className="border-b border-[#262626] bg-[#050505]/95 backdrop-blur-md sticky top-0 z-30 px-6 py-4">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-red-600 rounded-lg flex items-center justify-center shadow-[0_0_20px_rgba(220,38,38,0.4)]">
                <Bot className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight text-white">DEADLINE GUARDIAN AI</h1>
                <p className="text-[10px] text-red-500 uppercase tracking-widest font-semibold leading-none mt-1">
                  {rescueMode ? "Rescue Mode Active" : "Cognitive Shield Active"}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Notification Tray */}
            <div className="relative group">
              <button className="p-2.5 bg-[#111114] hover:bg-[#1c1c21] border border-[#262626] rounded-xl text-zinc-400 hover:text-white transition duration-150 cursor-pointer relative">
                <Bell className="w-4 h-4" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-600 text-[9px] font-bold text-white rounded-full flex items-center justify-center border border-[#050505]">
                    {unreadCount}
                  </span>
                )}
              </button>
              
              {/* Dropdown list */}
              <div className="absolute right-0 mt-2 w-80 bg-[#111114] border border-[#262626] rounded-2xl shadow-2xl opacity-0 translate-y-1 pointer-events-none group-hover:opacity-100 group-hover:translate-y-0 group-hover:pointer-events-auto transition duration-200 z-50 p-4 space-y-2">
                <div className="flex items-center justify-between border-b border-[#262626] pb-2">
                  <span className="text-xs font-bold text-white uppercase tracking-wider">Guardian Alerts</span>
                  {unreadCount > 0 && (
                    <button onClick={handleClearNotifications} className="text-[10px] text-red-400 hover:text-red-300 cursor-pointer uppercase tracking-wider font-semibold">
                      Mark all read
                    </button>
                  )}
                </div>
                <div className="space-y-2 max-h-[220px] overflow-y-auto scrollbar-none">
                  {notifications.length > 0 ? (
                    notifications.map(n => (
                      <div key={n.id} className={`p-2.5 rounded-xl border text-[11px] ${
                        n.type === 'rescue' 
                          ? 'bg-red-950/20 border-red-900/40 text-red-300' 
                          : n.type === 'warning'
                          ? 'bg-amber-950/20 border-amber-900/40 text-amber-300'
                          : 'bg-zinc-900 border-[#262626] text-zinc-300'
                      }`}>
                        <p className="font-semibold leading-relaxed">{n.message}</p>
                        <span className="text-[9px] text-zinc-500 font-mono block mt-1">
                          {new Date(n.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-zinc-500 text-center py-4">No active warnings.</p>
                  )}
                </div>
              </div>
            </div>

            {/* Profile sync block */}
            <div className="flex items-center gap-2.5">
              <div className="flex items-center gap-2.5 px-3.5 py-1.5 bg-[#111114] border border-[#262626] rounded-xl">
                <div className="w-6 h-6 rounded-full bg-red-950/30 border border-red-900/50 flex items-center justify-center text-xs font-bold text-red-400 uppercase">
                  {user?.displayName ? user.displayName[0] : (user?.email ? user.email[0] : 'U')}
                </div>
                <div className="text-left leading-none">
                  <span className="block text-[11px] font-bold text-white">{user?.displayName || "Guardian User"}</span>
                  <span className="text-[9px] font-mono text-zinc-400">{user?.email}</span>
                </div>
              </div>
              <button
                onClick={() => logoutUser()}
                className="p-2.5 bg-[#111114] hover:bg-red-950/20 hover:text-red-400 border border-[#262626] hover:border-red-900/35 rounded-xl text-zinc-400 transition duration-150 cursor-pointer"
                title="Sign Out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 space-y-6 z-10">
        
        {/* Row 1: Active Rescue banner & Quick Metrics Bento Section */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4" id="bento-metrics-grid">
          {/* Rescue Indicator card */}
          <div className={`md:col-span-2 p-6 rounded-3xl border flex flex-col justify-between transition duration-300 relative overflow-hidden ${
            rescueMode
              ? 'bg-red-600 border-red-500 text-white shadow-[0_0_25px_rgba(220,38,38,0.25)]'
              : 'bg-[#111114] border-[#262626] text-zinc-300'
          }`}>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className={`w-2.5 h-2.5 rounded-full ${rescueMode ? 'bg-white animate-ping' : 'bg-red-500'}`} />
                <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-400">Emergency Rescue Protocol</h3>
              </div>
              <p className="text-sm font-medium leading-relaxed">
                {rescueMode 
                  ? "CRITICAL BOTTLENECK: High Risk (>80%) detected. Schedule compressed, non-critical items deferred, and emergency overtime guides initialized."
                  : "Deadline margin levels are healthy. If a focus session is missed or risk exceeds 80%, the system will automatically activate Rescue Mode."
                }
              </p>
            </div>
            
            <div className="flex items-center justify-between pt-3 border-t border-zinc-800/40 mt-4">
              <span className="text-[9px] font-mono uppercase tracking-wider text-zinc-500 font-semibold">Test Trigger Override</span>
              <button
                onClick={handleToggleRescue}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-mono font-bold transition cursor-pointer ${
                  rescueMode
                    ? 'bg-white text-red-600 shadow-xl'
                    : 'bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-white'
                }`}
              >
                {rescueMode ? "DEACTIVATE RESCUE" : "FORCE RESCUE"}
              </button>
            </div>
          </div>

          {/* Productivity Score Bento Card */}
          <div className="p-6 bg-[#111114] border border-[#262626] rounded-3xl flex flex-col justify-between">
            <div className="flex justify-between items-start">
              <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Productivity Index</h3>
              <TrendingUp className="w-4 h-4 text-red-500" />
            </div>
            <div className="py-2">
              <div className="text-4xl font-semibold tracking-tight text-white">
                {analytics ? analytics.productivityScore : 100}%
              </div>
              <div className="text-[10px] text-zinc-400 mt-1 uppercase font-mono tracking-wider">Optimized Capacity</div>
            </div>
            <div className="w-full bg-zinc-800 h-1.5 rounded-full overflow-hidden">
              <div 
                className="bg-red-600 h-full transition-all duration-500" 
                style={{ width: `${analytics ? analytics.productivityScore : 100}%` }} 
              />
            </div>
          </div>

          {/* Focus hours Bento Card */}
          <div className="p-6 bg-[#111114] border border-[#262626] rounded-3xl flex flex-col justify-between">
            <div className="flex justify-between items-start">
              <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Focus Time Logged</h3>
              <BarChart2 className="w-4 h-4 text-red-500" />
            </div>
            <div className="py-2">
              <div className="text-4xl font-semibold tracking-tight text-white">
                {analytics ? analytics.focusHoursLogged : 0}h
              </div>
              <div className="text-[10px] text-zinc-400 mt-1 uppercase font-mono tracking-wider">This Week</div>
            </div>
            <p className="text-[10px] text-zinc-500 leading-none">Mapped safely around calendar conflicts</p>
          </div>
        </div>

        {/* Row 2: Goals / Task Dashboard & Voice Terminal (Side-by-Side) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Left panel: Task tracker list (Bento size 7/12) */}
          <div className="lg:col-span-7 space-y-4">
            
            {/* Interactive Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckSquare className="w-5 h-5 text-red-500" />
                <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-300">Monitored Goals</h2>
              </div>
              
              {!showTaskForm && (
                <button
                  onClick={() => setShowTaskForm(true)}
                  className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 shadow-[0_0_15px_rgba(220,38,38,0.3)] cursor-pointer transition duration-200"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Goal
                </button>
              )}
            </div>

            {/* Traditional Form Drawer */}
            <AnimatePresence>
              {showTaskForm && (
                <TaskForm
                  onTaskCreated={() => {
                    setShowTaskForm(false);
                    refreshAllData();
                  }}
                  onCancel={() => setShowTaskForm(false)}
                />
              )}
            </AnimatePresence>

            {/* Task list container */}
            <div className="space-y-3.5">
              {tasks.length > 0 ? (
                tasks.map((task) => (
                  <motion.div
                    key={task.id}
                    layout
                    className={`bg-[#111114] border rounded-3xl p-5 transition duration-200 ${
                      task.status === 'completed'
                        ? 'border-[#262626] opacity-60'
                        : task.risk > 70
                        ? 'border-red-900/60 hover:border-red-500 shadow-md shadow-red-950/10'
                        : 'border-[#262626] hover:border-zinc-700'
                    }`}
                  >
                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
                      <div className="space-y-1.5 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[9px] font-mono uppercase bg-zinc-800 text-zinc-300 px-2 py-0.5 rounded-md border border-zinc-700">
                            {task.category}
                          </span>
                          <span className={`text-[9px] font-mono uppercase px-2 py-0.5 rounded-md border ${
                            task.difficulty === 'High'
                              ? 'bg-red-950/40 border-red-900/50 text-red-300'
                              : task.difficulty === 'Medium'
                              ? 'bg-amber-950/40 border-amber-900/50 text-amber-300'
                              : 'bg-emerald-950/40 border-emerald-900/50 text-emerald-300'
                          }`}>
                            {task.difficulty} Complexity
                          </span>
                          <span className="text-[10px] font-mono text-zinc-400">
                            {getDaysLeftText(task.deadline)}
                          </span>
                        </div>
                        
                        <h3 className={`text-sm font-bold ${task.status === 'completed' ? 'line-through text-zinc-500' : 'text-white'}`}>
                          {task.title}
                        </h3>
                        {task.description && (
                          <p className="text-xs text-zinc-400 leading-relaxed max-w-xl">{task.description}</p>
                        )}

                        {/* Progress and Risk Slider details */}
                        <div className="space-y-1 pt-2">
                          <div className="flex items-center justify-between text-[10px] font-mono text-zinc-400">
                            <span>Progress: {task.progress}%</span>
                            <span className={task.risk > 70 ? 'text-red-400 font-bold' : 'text-emerald-400'}>
                              Deadline Risk: {task.risk}%
                            </span>
                          </div>
                          
                          <div className="w-full bg-zinc-900 h-2 border border-zinc-800/80 rounded-full overflow-hidden relative">
                            <div 
                              className={`h-full transition-all duration-300 ${
                                task.status === 'completed' 
                                  ? 'bg-zinc-600' 
                                  : task.risk > 70 
                                  ? 'bg-red-600 shadow-md shadow-red-500/20' 
                                  : 'bg-red-500'
                              }`}
                              style={{ width: `${task.progress}%` }} 
                            />
                          </div>
                        </div>
                      </div>

                      {/* Side Actions list */}
                      <div className="flex md:flex-col items-center md:items-end gap-2 self-end md:self-start justify-end">
                        {task.status !== 'completed' && (
                          <>
                            <button
                              onClick={() => handleTriggerAIPlan(task.id)}
                              className="px-3 py-1.5 bg-red-950/40 hover:bg-red-900/80 border border-red-900/60 hover:border-red-500 text-red-300 hover:text-white rounded-xl text-[10px] font-bold tracking-wide uppercase transition duration-150 flex items-center gap-1 cursor-pointer"
                              title="Generate AI Roadmap"
                            >
                              <Sparkles className="w-3.5 h-3.5" />
                              STRATEGIZE
                            </button>

                            <button
                              onClick={() => handleMarkComplete(task.id)}
                              className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-300 hover:text-white rounded-xl text-[10px] font-bold tracking-wide uppercase transition duration-150 flex items-center gap-1 cursor-pointer"
                            >
                              <CheckCircle className="w-3.5 h-3.5" />
                              COMPLETE
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => handleDeleteTask(task.id)}
                          className="p-1.5 hover:bg-red-950/40 hover:text-red-400 border border-transparent hover:border-red-900/30 rounded-lg text-zinc-500 transition duration-150 cursor-pointer"
                          title="Delete goal"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </motion.div>
                ))
              ) : (
                <div className="bg-[#111114]/50 border border-[#262626] rounded-3xl p-8 text-center text-zinc-500 flex flex-col items-center justify-center space-y-2">
                  <Bot className="w-10 h-10 text-zinc-600 animate-pulse" />
                  <div className="max-w-xs">
                    <p className="text-xs font-bold text-white uppercase tracking-wider">All guarded goals completed</p>
                    <p className="text-[10px] text-zinc-500 leading-relaxed mt-1">Deploy a goal using the "Add Goal" form or say "Create a task to finish my presentation before Sunday" using the voice console.</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right panel: AI Chief of Staff Voice/Chat Console (Bento size 5/12) */}
          <div className="lg:col-span-5 h-full flex flex-col justify-between">
            <VoiceAndChat 
              onRefreshData={refreshAllData}
              activeTaskId={tasks.length > 0 ? tasks[0].id : undefined}
              tasks={tasks}
              calendarEvents={events}
              rescueMode={rescueMode}
            />
          </div>

        </div>

        {/* Row 3: Calendar timeline and AI Strategy Plan (Split 50-50) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* Calendar visualizer */}
          <CalendarView
            events={events}
            isConnected={calendarConnected}
            onToggleConnect={handleToggleCalendar}
            onTriggerCheckin={handleTriggerCheckIn}
          />

          {/* AI Session execution plans review */}
          <ExecutionPlanView
            plan={activePlan}
            isGenerating={isGeneratingPlan}
            onPlanApproved={refreshAllData}
            onRegenerate={() => {
              if (activePlan) handleTriggerAIPlan(activePlan.taskId);
            }}
          />

        </div>

      </main>

      {/* Modal overlays */}
      <AnimatePresence>
        {checkInTask && (
          <CheckInModal
            isOpen={!!checkInTask}
            taskId={checkInTask.id}
            sessionTitle={checkInTask.title}
            onClose={() => setCheckInTask(null)}
            tasks={tasks}
            rescueMode={rescueMode}
            onCheckInCompleted={() => {
              setCheckInTask(null);
              refreshAllData();
            }}
          />
        )}
      </AnimatePresence>

      {/* Footer */}
      <footer className="border-t border-[#262626] mt-12 py-6 bg-[#050505]">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between text-[11px] text-zinc-500 gap-2 font-mono uppercase tracking-wider">
          <span>&copy; 2026 Deadline Guardian AI. Systems Operational.</span>
          <div className="flex gap-4">
            <span className="text-red-500 font-semibold">models/gemini-2.5-flash</span>
            <span>{user?.email}</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
