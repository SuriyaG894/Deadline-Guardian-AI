/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Sparkles, Calendar, Clock, Plus, Tag, AlertCircle } from 'lucide-react';
import { createTask } from '../api';
import { auth, saveUserTask, saveUserNotification } from '../firebase';

interface TaskFormProps {
  onTaskCreated: () => void;
  onCancel: () => void;
}

export default function TaskForm({ onTaskCreated, onCancel }: TaskFormProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [deadline, setDeadline] = useState(
    new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );
  const [estimatedHours, setEstimatedHours] = useState('8');
  const [category, setCategory] = useState('Tech');
  const [priority, setPriority] = useState('medium');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError("Please provide a task title.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const currentUser = auth.currentUser;
      if (currentUser) {
        // Compute risk based on estimatedHours and deadline
        const deadlineDate = deadline;
        const hours = Number(estimatedHours) || 8;
        const fallbackDays = Math.max(1, Math.ceil((new Date(deadlineDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
        const riskScore = Math.min(95, Math.round((hours / (fallbackDays * 4)) * 100));

        const taskId = "task-" + Date.now();
        const newTask = {
          id: taskId,
          title,
          description: description || "Created via goal form.",
          deadline,
          estimatedHours: hours,
          progress: 0,
          status: 'not_started',
          category,
          priority: priority as 'low' | 'medium' | 'high',
          difficulty: hours > 12 ? "High" : "Medium",
          risk: riskScore,
          recommendedStart: "Today",
          createdAt: new Date().toISOString()
        };

        await saveUserTask(currentUser.uid, taskId, newTask);
        
        // Save alert
        const notifId = "not-" + Date.now();
        await saveUserNotification(currentUser.uid, notifId, {
          id: notifId,
          type: riskScore > 75 ? "warning" : "info",
          message: `Goal created: "${newTask.title}" (${hours}h). Risk is ${riskScore}%.`,
          timestamp: new Date().toISOString(),
          read: false
        });
      } else {
        await createTask({
          title,
          description,
          deadline,
          estimatedHours: Number(estimatedHours) || 4,
          category,
          priority: priority as 'low' | 'medium' | 'high'
        });
      }
      onTaskCreated();
    } catch (err) {
      console.error(err);
      setError("Failed to create task. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <motion.form
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      onSubmit={handleSubmit}
      className="bg-[#111114] border border-[#262626] rounded-3xl p-6 space-y-4 shadow-xl"
      id="task-creation-form"
    >
      <div className="flex items-center gap-2 border-b border-[#262626] pb-3">
        <Sparkles className="w-5 h-5 text-red-500" />
        <div>
          <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-300">Deploy New Goal</h3>
          <p className="text-[10px] text-zinc-400">Gemini will auto-analyze risk and estimate scheduling slots</p>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-950/20 border border-red-900/40 text-red-300 text-xs rounded-xl flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Title */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-zinc-300 flex items-center gap-1.5">Goal Title</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g., Shoot Project Demo Video"
          className="w-full px-3.5 py-2.5 bg-zinc-900 border border-[#262626] hover:border-zinc-700 focus:border-red-500 rounded-xl text-white text-xs focus:outline-none focus:ring-1 focus:ring-red-500 transition duration-150"
          required
        />
      </div>

      {/* Description */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-zinc-300">Detailed Scope</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Brief description of sub-tasks or target goals..."
          rows={3}
          className="w-full px-3.5 py-2.5 bg-zinc-900 border border-[#262626] hover:border-zinc-700 focus:border-red-500 rounded-xl text-white text-xs focus:outline-none focus:ring-1 focus:ring-red-500 transition duration-150 resize-none"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        {/* Deadline */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-zinc-300 flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-zinc-500" /> Deadline
          </label>
          <input
            type="date"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
            className="w-full px-3.5 py-2.5 bg-zinc-900 border border-[#262626] hover:border-zinc-700 focus:border-red-500 rounded-xl text-white text-xs focus:outline-none focus:ring-1 focus:ring-red-500 transition duration-150"
            required
          />
        </div>

        {/* Hours */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-zinc-300 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-zinc-500" /> Est. Effort (Hours)
          </label>
          <input
            type="number"
            min="1"
            max="120"
            value={estimatedHours}
            onChange={(e) => setEstimatedHours(e.target.value)}
            className="w-full px-3.5 py-2.5 bg-zinc-900 border border-[#262626] hover:border-zinc-700 focus:border-red-500 rounded-xl text-white text-xs focus:outline-none focus:ring-1 focus:ring-red-500 transition duration-150"
            required
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {/* Category */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-zinc-300 flex items-center gap-1.5">
            <Tag className="w-3.5 h-3.5 text-zinc-500" /> Category
          </label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full px-3 py-2.5 bg-zinc-900 border border-[#262626] hover:border-zinc-700 focus:border-red-500 rounded-xl text-white text-xs focus:outline-none transition duration-150"
          >
            <option value="Tech">Tech / Engineering</option>
            <option value="Career">Career Development</option>
            <option value="Marketing">Marketing / Creative</option>
            <option value="Admin">Admin / Management</option>
            <option value="Personal">Personal / Life</option>
          </select>
        </div>

        {/* Priority */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-zinc-300 flex items-center gap-1.5">Priority</label>
          <div className="flex bg-zinc-900 p-1 border border-[#262626] rounded-xl">
            {['low', 'medium', 'high'].map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPriority(p)}
                className={`flex-1 text-[10px] uppercase font-mono py-1.5 rounded-lg transition duration-150 cursor-pointer ${
                  priority === p
                    ? p === 'high'
                      ? 'bg-red-950/60 text-red-300 border border-red-800/50 font-bold'
                      : p === 'medium'
                      ? 'bg-amber-950/60 text-amber-300 border border-amber-800/50 font-bold'
                      : 'bg-zinc-800 text-zinc-300 font-bold'
                    : 'text-zinc-500 hover:text-zinc-200'
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex gap-2 justify-end pt-3 border-t border-[#262626]">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 hover:bg-zinc-800 border border-[#262626] text-zinc-300 rounded-xl text-xs transition duration-150 cursor-pointer"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="px-4 py-2 bg-red-600 hover:bg-red-500 disabled:bg-zinc-800 text-white rounded-xl text-xs font-bold uppercase tracking-wider shadow-[0_0_15px_rgba(220,38,38,0.25)] cursor-pointer"
        >
          {isSubmitting ? (
            <>
              <Sparkles className="w-4 h-4 animate-spin" />
              Analyzing with Gemini...
            </>
          ) : (
            <>
              <Plus className="w-4 h-4" />
              Generate Goal Profile
            </>
          )}
        </button>
      </div>
    </motion.form>
  );
}
