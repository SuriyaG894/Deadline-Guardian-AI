/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Sparkles, X, AlertCircle } from 'lucide-react';
import { importBrainDump } from '../api';
import { auth, saveUserTask, saveUserEvent, saveUserNotification } from '../firebase';
import { Task, CalendarEvent } from '../types';

interface BrainDumpModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportCompleted: () => void;
  tasks?: Task[];
  calendarEvents?: CalendarEvent[];
  geminiApiKey?: string;
}

export default function BrainDumpModal({
  isOpen,
  onClose,
  onImportCompleted,
  tasks,
  calendarEvents,
  geminiApiKey
}: BrainDumpModalProps) {
  const [text, setText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) {
      setError("Please paste some text to analyze.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const currentUser = auth.currentUser;
      const localTime = new Date().toString();

      // Call API
      const result = await importBrainDump(
        text,
        localTime,
        tasks,
        calendarEvents,
        geminiApiKey
      );

      if (currentUser) {
        // Save tasks to firestore
        for (const task of result.tasks) {
          await saveUserTask(currentUser.uid, task.id, task);
          
          // Save notification for each task
          const notifId = "not-" + Date.now() + "-" + Math.random().toString(36).substr(2, 5);
          await saveUserNotification(currentUser.uid, notifId, {
            id: notifId,
            type: task.risk > 75 ? "warning" : "info",
            message: `Brain Dump imported goal: "${task.title}". Risk: ${task.risk}%.`,
            timestamp: new Date().toISOString(),
            read: false
          });
        }

        // Save events to firestore
        for (const event of result.events) {
          await saveUserEvent(currentUser.uid, event.id, event);
        }
      }

      onImportCompleted();
      onClose();
    } catch (err) {
      console.error("Brain dump import error:", err);
      setError("Failed to parse and generate schedule. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="w-full max-w-lg bg-[#0b0b0d] border border-[#262626] rounded-3xl overflow-hidden shadow-2xl relative"
      >
        {/* Header */}
        <div className="p-6 border-b border-[#262626] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-red-500" />
            <h3 className="text-sm font-bold uppercase tracking-widest text-white">AI Brain Dump Scheduler</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-zinc-500 hover:text-zinc-300 rounded-lg hover:bg-zinc-900 transition duration-150 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <div className="p-6 space-y-4">
          <div className="space-y-1">
            <p className="text-[11px] text-zinc-400 leading-relaxed">
              Bypass manually inputting dozens of goals. Paste a project spec document, a syllabus, or an email outline below. Gemini will extract major goals, calculate deadlines, and schedule optimized focus slots in your calendar.
            </p>
          </div>

          {error && (
            <div className="bg-red-950/20 border border-red-900/50 rounded-xl p-3 flex items-start gap-2 text-xs text-red-400">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {isSubmitting ? (
            <div className="py-12 flex flex-col items-center justify-center space-y-4">
              <div className="w-8 h-8 rounded-full border-2 border-red-900 border-t-red-500 animate-spin" />
              <div className="text-center space-y-1">
                <p className="text-xs font-bold text-white uppercase tracking-wider animate-pulse">Gemini is processing...</p>
                <p className="text-[10px] text-zinc-500">Deconstructing goals & auto-scheduling focus slots...</p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <textarea
                value={text}
                onChange={(e) => {
                  setText(e.target.value);
                  if (error) setError(null);
                }}
                placeholder="Example: Let's launch this app by Wednesday. I need to spend about 4 hours on the Express routes, 6 hours on the front-end layout, and 2 hours on testing. Let's block out focus sessions to finish on time!"
                className="w-full h-44 bg-zinc-950/50 border border-[#262626] focus:border-red-900 focus:outline-none rounded-2xl p-4 text-xs text-white placeholder-zinc-600 resize-none font-mono"
              />

              <div className="flex gap-2 justify-end pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 border border-[#262626] hover:bg-zinc-900 text-zinc-400 hover:text-white rounded-xl text-xs font-bold uppercase tracking-wider transition duration-150 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmit}
                  className="px-5 py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 shadow-[0_0_15px_rgba(220,38,38,0.3)] transition duration-150 cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Auto-Generate Schedule
                </button>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
