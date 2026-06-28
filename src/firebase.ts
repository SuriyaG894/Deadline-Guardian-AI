import { initializeApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  linkWithPopup,
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  signOut
} from 'firebase/auth';
import {
  getFirestore,
  collection,
  doc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  addDoc,
  query,
  orderBy,
  getDoc
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';
import { Task, CalendarEvent, ExecutionPlan, ProgressLog, SystemNotification } from './types';

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

// LocalStorage Sandbox Helpers for Demo Bypass Mode
export const isDemo = (uid: string) => uid === 'demo-user';

function getLocalItem<T>(uid: string, key: string, defaultVal: T): T {
  const data = localStorage.getItem(`guardian_${uid}_${key}`);
  return data ? JSON.parse(data) : defaultVal;
}

function setLocalItem(uid: string, key: string, value: any) {
  localStorage.setItem(`guardian_${uid}_${key}`, JSON.stringify(value));
}

// Google Auth Provider for Google Sign-In & Google Calendar scopes
const provider = new GoogleAuthProvider();
provider.addScope('https://www.googleapis.com/auth/calendar');
provider.addScope('https://www.googleapis.com/auth/calendar.events');
provider.addScope('https://www.googleapis.com/auth/tasks.readonly');

export const signInWithGoogleCalendar = async (): Promise<string | null> => {
  try {
    const currentUser = auth.currentUser;
    let result;
    if (currentUser) {
      const isGoogleUser = currentUser.providerData.some(p => p.providerId === GoogleAuthProvider.PROVIDER_ID);
      if (isGoogleUser) {
        result = await signInWithPopup(auth, provider);
      } else {
        result = await linkWithPopup(currentUser, provider);
      }
    } else {
      result = await signInWithPopup(auth, provider);
    }
    const credential = GoogleAuthProvider.credentialFromResult(result);
    return credential?.accessToken || null;
  } catch (error: any) {
    console.error('Google Calendar Sign-In/Link error:', error);
    if (error.code === 'auth/provider-already-linked' || error.code === 'auth/credential-already-in-use') {
      try {
        const result = await signInWithPopup(auth, provider);
        const credential = GoogleAuthProvider.credentialFromResult(result);
        return credential?.accessToken || null;
      } catch (err2) {
        console.error('Fallback Google Calendar Sign-In error:', err2);
        throw err2;
      }
    }
    throw error;
  }
};

// -----------------------------------------------------
// Authentication Helpers
// -----------------------------------------------------
export const logInWithEmail = (email: string, password: string) => {
  return signInWithEmailAndPassword(auth, email, password);
};

export const signUpWithEmail = async (email: string, password: string, displayName: string) => {
  const userCredential = await createUserWithEmailAndPassword(auth, email, password);
  if (userCredential.user) {
    await updateProfile(userCredential.user, { displayName });
  }
  return userCredential;
};

export const logoutUser = () => {
  localStorage.removeItem('guardian_demo_user');
  return signOut(auth);
};

// -----------------------------------------------------
// Firestore User Data Schema Helper Functions
// -----------------------------------------------------

export interface UserMetadata {
  email: string;
  name: string;
  calendarConnected: boolean;
  rescueMode: boolean;
  googleAccessToken?: string | null;
  bombFrequency?: number;
  hasCompletedTour?: boolean;
}

// 1. User Profile Document Schema
export async function getUserMetadata(uid: string): Promise<UserMetadata | null> {
  if (isDemo(uid)) {
    return getLocalItem<UserMetadata | null>(uid, 'metadata', null);
  }
  const userDocRef = doc(db, 'users', uid);
  const docSnap = await getDoc(userDocRef);
  if (docSnap.exists()) {
    return docSnap.data() as UserMetadata;
  }
  return null;
}

export async function saveUserMetadata(uid: string, metadata: Partial<UserMetadata>) {
  if (isDemo(uid)) {
    const current = getLocalItem<UserMetadata>(uid, 'metadata', {
      email: 'demo@guardian.ai',
      name: 'Demo Commander',
      calendarConnected: true,
      rescueMode: false
    });
    setLocalItem(uid, 'metadata', { ...current, ...metadata });
    return;
  }
  const userDocRef = doc(db, 'users', uid);
  await setDoc(userDocRef, metadata, { merge: true });
}

// 2. Tasks Collection Schema
export async function getUserTasks(uid: string): Promise<Task[]> {
  if (isDemo(uid)) {
    return getLocalItem<Task[]>(uid, 'tasks', []);
  }
  const colRef = collection(db, 'users', uid, 'tasks');
  const q = query(colRef, orderBy('createdAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() })) as Task[];
}

export async function saveUserTask(uid: string, taskId: string, taskData: any) {
  if (isDemo(uid)) {
    const list = getLocalItem<Task[]>(uid, 'tasks', []);
    const idx = list.findIndex(t => t.id === taskId);
    const updatedTask = { ...taskData, id: taskId };
    if (idx >= 0) {
      list[idx] = { ...list[idx], ...updatedTask };
    } else {
      list.push(updatedTask);
    }
    setLocalItem(uid, 'tasks', list);
    return;
  }
  const docRef = doc(db, 'users', uid, 'tasks', taskId);
  await setDoc(docRef, { ...taskData, id: taskId }, { merge: true });
}

export async function deleteUserTask(uid: string, taskId: string) {
  if (isDemo(uid)) {
    const list = getLocalItem<Task[]>(uid, 'tasks', []);
    setLocalItem(uid, 'tasks', list.filter(t => t.id !== taskId));
    return;
  }
  const docRef = doc(db, 'users', uid, 'tasks', taskId);
  await deleteDoc(docRef);
}

// 3. Calendar Events Collection Schema
export async function getUserEvents(uid: string): Promise<CalendarEvent[]> {
  if (isDemo(uid)) {
    return getLocalItem<CalendarEvent[]>(uid, 'calendarEvents', []);
  }
  const colRef = collection(db, 'users', uid, 'calendarEvents');
  const snap = await getDocs(colRef);
  return snap.docs.map(d => ({ id: d.id, ...d.data() })) as CalendarEvent[];
}

export async function saveUserEvent(uid: string, eventId: string, eventData: any) {
  if (isDemo(uid)) {
    const list = getLocalItem<CalendarEvent[]>(uid, 'calendarEvents', []);
    const idx = list.findIndex(e => e.id === eventId);
    const updatedEvent = { ...eventData, id: eventId };
    if (idx >= 0) {
      list[idx] = { ...list[idx], ...updatedEvent };
    } else {
      list.push(updatedEvent);
    }
    setLocalItem(uid, 'calendarEvents', list);
    return;
  }
  const docRef = doc(db, 'users', uid, 'calendarEvents', eventId);
  await setDoc(docRef, { ...eventData, id: eventId }, { merge: true });
}

export async function deleteUserEvent(uid: string, eventId: string) {
  if (isDemo(uid)) {
    const list = getLocalItem<CalendarEvent[]>(uid, 'calendarEvents', []);
    setLocalItem(uid, 'calendarEvents', list.filter(e => e.id !== eventId));
    return;
  }
  const docRef = doc(db, 'users', uid, 'calendarEvents', eventId);
  await deleteDoc(docRef);
}

// 4. Execution Plans Collection Schema
export async function getUserPlans(uid: string): Promise<ExecutionPlan[]> {
  if (isDemo(uid)) {
    return getLocalItem<ExecutionPlan[]>(uid, 'executionPlans', []);
  }
  const colRef = collection(db, 'users', uid, 'executionPlans');
  const snap = await getDocs(colRef);
  return snap.docs.map(d => ({ id: d.id, ...d.data() })) as ExecutionPlan[];
}

export async function saveUserPlan(uid: string, planId: string, planData: any) {
  if (isDemo(uid)) {
    const list = getLocalItem<ExecutionPlan[]>(uid, 'executionPlans', []);
    const idx = list.findIndex(p => p.id === planId);
    const updatedPlan = { ...planData, id: planId };
    if (idx >= 0) {
      list[idx] = { ...list[idx], ...updatedPlan };
    } else {
      list.push(updatedPlan);
    }
    setLocalItem(uid, 'executionPlans', list);
    return;
  }
  const docRef = doc(db, 'users', uid, 'executionPlans', planId);
  await setDoc(docRef, { ...planData, id: planId }, { merge: true });
}

export async function deleteUserPlan(uid: string, planId: string) {
  if (isDemo(uid)) {
    const list = getLocalItem<ExecutionPlan[]>(uid, 'executionPlans', []);
    setLocalItem(uid, 'executionPlans', list.filter(p => p.id !== planId));
    return;
  }
  const docRef = doc(db, 'users', uid, 'executionPlans', planId);
  await deleteDoc(docRef);
}

// 5. Progress Logs Collection Schema
export async function getUserLogs(uid: string): Promise<ProgressLog[]> {
  if (isDemo(uid)) {
    return getLocalItem<ProgressLog[]>(uid, 'progressLogs', []);
  }
  const colRef = collection(db, 'users', uid, 'progressLogs');
  const q = query(colRef, orderBy('timestamp', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() })) as ProgressLog[];
}

export async function saveUserLog(uid: string, logId: string, logData: any) {
  if (isDemo(uid)) {
    const list = getLocalItem<ProgressLog[]>(uid, 'progressLogs', []);
    const idx = list.findIndex(l => l.id === logId);
    const updatedLog = { ...logData, id: logId };
    if (idx >= 0) {
      list[idx] = { ...list[idx], ...updatedLog };
    } else {
      list.push(updatedLog);
    }
    setLocalItem(uid, 'progressLogs', list);
    return;
  }
  const docRef = doc(db, 'users', uid, 'progressLogs', logId);
  await setDoc(docRef, { ...logData, id: logId }, { merge: true });
}

// 6. Notifications Collection Schema
export async function getUserNotifications(uid: string): Promise<SystemNotification[]> {
  if (isDemo(uid)) {
    return getLocalItem<SystemNotification[]>(uid, 'notifications', []);
  }
  const colRef = collection(db, 'users', uid, 'notifications');
  const q = query(colRef, orderBy('timestamp', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() })) as SystemNotification[];
}

export async function saveUserNotification(uid: string, notifId: string, notifData: any) {
  if (isDemo(uid)) {
    const list = getLocalItem<SystemNotification[]>(uid, 'notifications', []);
    const idx = list.findIndex(n => n.id === notifId);
    const updatedNotif = { ...notifData, id: notifId };
    if (idx >= 0) {
      list[idx] = { ...list[idx], ...updatedNotif };
    } else {
      list.push(updatedNotif);
    }
    setLocalItem(uid, 'notifications', list);
    return;
  }
  const docRef = doc(db, 'users', uid, 'notifications', notifId);
  await setDoc(docRef, { ...notifData, id: notifId }, { merge: true });
}

export async function deleteUserNotification(uid: string, notifId: string) {
  if (isDemo(uid)) {
    const list = getLocalItem<SystemNotification[]>(uid, 'notifications', []);
    setLocalItem(uid, 'notifications', list.filter(n => n.id !== notifId));
    return;
  }
  const docRef = doc(db, 'users', uid, 'notifications', notifId);
  await deleteDoc(docRef);
}

export async function clearUserNotifications(uid: string, notifIds: string[]) {
  if (isDemo(uid)) {
    const list = getLocalItem<SystemNotification[]>(uid, 'notifications', []);
    const updated = list.map(n => notifIds.includes(n.id) ? { ...n, read: true } : n);
    setLocalItem(uid, 'notifications', updated);
    return;
  }
  for (const id of notifIds) {
    const docRef = doc(db, 'users', uid, 'notifications', id);
    await updateDoc(docRef, { read: true });
  }
}

// 7. Data Seeding Helper
export async function seedUserData(uid: string, email: string, name: string) {
  // Check if user already exists in Firestore
  const meta = await getUserMetadata(uid);
  if (meta) return; // already seeded

  const isDemoUser = isDemo(uid);

  // Create Metadata Document
  await saveUserMetadata(uid, {
    email,
    name,
    calendarConnected: isDemoUser,
    rescueMode: false,
    googleAccessToken: null
  });

  // Only seed the rest of the mock data for demo sandbox mode
  if (!isDemoUser) {
    return;
  }

  // Default tasks
  const twoDays = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const threeDays = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const fiveDays = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const defaultTasks = [
    {
      id: "task-1",
      title: "Backend Development & Authentication",
      description: "Build Express APIs and establish Firestore data persistence schemas.",
      deadline: twoDays,
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
      deadline: threeDays,
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
      deadline: fiveDays,
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
  ];

  for (const t of defaultTasks) {
    await saveUserTask(uid, t.id, t);
  }

  // Default Calendar Events
  const defaultEvents = [
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
  ];

  for (const ev of defaultEvents) {
    await saveUserEvent(uid, ev.id, ev);
  }

  // Default plan
  const defaultPlan = {
    id: "plan-1",
    taskId: "task-1",
    taskTitle: "Backend Development & Authentication",
    approved: true,
    createdAt: new Date().toISOString(),
    items: [
      { id: "epi-1", day: "Today", timeSlot: "6 PM–8 PM", phase: "API Setup", duration: 2 },
      { id: "epi-2", day: "Tomorrow", timeSlot: "7 PM–9 PM", phase: "Schema Integration", duration: 2 }
    ]
  };
  await saveUserPlan(uid, defaultPlan.id, defaultPlan);

  // Default log
  const defaultLog = {
    id: "log-1",
    taskId: "task-1",
    taskTitle: "Backend Development & Authentication",
    timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
    progress: 45,
    comment: "Created JSON data store, schema, and routing structure",
    status: "partially_completed"
  };
  await saveUserLog(uid, defaultLog.id, defaultLog);

  // Default Notification
  const defaultNotif = {
    id: "not-1",
    type: "info",
    message: "Deadline Guardian activated. Monitoring 3 critical projects.",
    timestamp: new Date().toISOString(),
    read: false
  };
  await saveUserNotification(uid, defaultNotif.id, defaultNotif);
}
