/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Bot, Check, AlertTriangle, Sparkles, X, Send, Mic, MicOff } from 'lucide-react';
import { checkInSession } from '../api';
import { auth, saveUserTask, saveUserLog, saveUserNotification, saveUserMetadata, saveUserEvent } from '../firebase';
import { Task } from '../types';

interface CheckInModalProps {
  isOpen: boolean;
  onClose: () => void;
  taskId: string;
  sessionTitle: string;
  onCheckInCompleted: () => void;
  tasks?: Task[];
  rescueMode?: boolean;
  eventId?: string;
  geminiApiKey?: string;
}

export default function CheckInModal({ 
  isOpen, 
  onClose, 
  taskId, 
  sessionTitle, 
  onCheckInCompleted,
  tasks,
  rescueMode,
  eventId,
  geminiApiKey
}: CheckInModalProps) {
  const [status, setStatus] = useState<'completed' | 'partially_completed' | 'failed' | null>(null);
  const [textFeedback, setTextFeedback] = useState('');
  const [progressVal, setProgressVal] = useState<number>(50);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [coachingResult, setCoachingResult] = useState<{ advice: string; risk: number; progress: number } | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async () => {
    if (!status) return;
    setIsSubmitting(true);
    try {
      const currentUser = auth.currentUser;
      
      const response = await checkInSession({
        taskId,
        status,
        progressVal: status === 'completed' ? 100 : progressVal,
        textFeedback,
        tasks,
        rescueMode
      }, geminiApiKey);

      if (currentUser) {
        // Save to Firestore
        await saveUserTask(currentUser.uid, taskId, response.task);
        
        if (response.newLog) {
          await saveUserLog(currentUser.uid, response.newLog.id, response.newLog);
        }

        if (response.newNotification) {
          await saveUserNotification(currentUser.uid, response.newNotification.id, response.newNotification);
        }

        if (eventId) {
          await saveUserEvent(currentUser.uid, eventId, { checkedIn: true, checkInStatus: status });
        }

        await saveUserMetadata(currentUser.uid, { rescueMode: response.rescueMode });
      }

      setCoachingResult({
        advice: response.coachingAdvice,
        risk: response.task.risk,
        progress: response.task.progress
      });

      onCheckInCompleted();
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleVoiceFeedback = () => {
    if (isListening) {
      setIsListening(false);
    } else {
      setIsListening(true);
      // Simulating voice input in modal
      setTimeout(() => {
        setTextFeedback("Finished setup, authentication, and half of the APIs. Ready for deployment tomorrow.");
        setIsListening(false);
      }, 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" id="checkin-modal-overlay">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-md bg-[#111114] border border-[#262626] rounded-3xl overflow-hidden shadow-2xl flex flex-col"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 bg-zinc-900 border-b border-[#262626]">
          <div className="flex items-center gap-2">
            <Bot className="w-5 h-5 text-red-500" />
            <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-300">Focus Session Check-in</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-zinc-800 rounded-md text-zinc-400 hover:text-white transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-5 space-y-4">
          {!coachingResult ? (
            <>
              <div className="space-y-1">
                <p className="text-xs text-zinc-400">The session has completed:</p>
                <p className="text-xs font-bold text-red-400">"{sessionTitle}"</p>
                <p className="text-sm font-semibold text-white mt-2">How did the session go?</p>
              </div>

              {/* Status Select Buttons */}
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => { setStatus('completed'); setProgressVal(100); }}
                  className={`p-3 rounded-xl border text-xs font-medium flex flex-col items-center justify-center gap-1.5 transition duration-150 cursor-pointer ${
                    status === 'completed'
                      ? 'bg-emerald-950/20 border-emerald-900/50 text-emerald-400'
                      : 'bg-zinc-900 border-[#262626] text-zinc-400 hover:text-white'
                  }`}
                >
                  <Check className="w-4 h-4" />
                  <span>Completed</span>
                </button>

                <button
                  type="button"
                  onClick={() => { setStatus('partially_completed'); setProgressVal(50); }}
                  className={`p-3 rounded-xl border text-xs font-medium flex flex-col items-center justify-center gap-1.5 transition duration-150 cursor-pointer ${
                    status === 'partially_completed'
                      ? 'bg-red-950/20 border-red-900/50 text-red-300'
                      : 'bg-zinc-900 border-[#262626] text-zinc-400 hover:text-white'
                  }`}
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Partial</span>
                </button>

                <button
                  type="button"
                  onClick={() => { setStatus('failed'); setProgressVal(0); }}
                  className={`p-3 rounded-xl border text-xs font-medium flex flex-col items-center justify-center gap-1.5 transition duration-150 cursor-pointer ${
                    status === 'failed'
                      ? 'bg-red-950/20 border-red-900/50 text-red-400'
                      : 'bg-zinc-900 border-[#262626] text-zinc-400 hover:text-white'
                  }`}
                >
                  <AlertTriangle className="w-4 h-4" />
                  <span>Missed</span>
                </button>
              </div>

              {/* Conditional Progress Slider */}
              {status === 'partially_completed' && (
                <div className="space-y-1.5 p-3.5 bg-zinc-900 border border-[#262626] rounded-2xl">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-zinc-400">Total Task Progress Achieved:</span>
                    <span className="font-mono font-bold text-red-400">{progressVal}%</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="99"
                    value={progressVal}
                    onChange={(e) => setProgressVal(Number(e.target.value))}
                    className="w-full accent-red-600 h-1 bg-zinc-850 rounded-lg cursor-pointer"
                  />
                </div>
              )}

              {/* Text / Voice Feedback */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-zinc-300">Feedback or Obstacles</label>
                  <button
                    type="button"
                    onClick={toggleVoiceFeedback}
                    className={`flex items-center gap-1 px-2 py-1 rounded-md border text-[10px] font-mono transition cursor-pointer ${
                      isListening
                        ? 'bg-red-950 text-red-300 border-red-800 animate-pulse'
                        : 'bg-zinc-900 text-zinc-400 border-[#262626] hover:text-white'
                    }`}
                  >
                    {isListening ? <MicOff className="w-3 h-3" /> : <Mic className="w-3 h-3" />}
                    <span>{isListening ? "Listening..." : "Speak Progress"}</span>
                  </button>
                </div>
                
                <textarea
                  value={textFeedback}
                  onChange={(e) => setTextFeedback(e.target.value)}
                  placeholder="e.g., Finished authentication and half of the APIs..."
                  rows={3}
                  className="w-full px-3 py-2.5 bg-zinc-900 border border-[#262626] hover:border-zinc-700 focus:border-red-500 rounded-xl text-white text-xs focus:outline-none resize-none transition duration-150"
                />
              </div>

              <div className="flex gap-2 justify-end pt-3 border-t border-[#262626]">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 hover:bg-zinc-800 border border-[#262626] text-zinc-300 rounded-xl text-xs transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={!status || isSubmitting}
                  className="px-4 py-2 bg-red-600 hover:bg-red-500 disabled:bg-zinc-800 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-[0_0_15px_rgba(220,38,38,0.25)] cursor-pointer"
                >
                  {isSubmitting ? (
                    <>
                      <Bot className="w-4 h-4 animate-spin" />
                      Recalculating Risk...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      Publish Status
                    </>
                  )}
                </button>
              </div>
            </>
          ) : (
            /* Results Screen */
            <div className="space-y-4 text-center py-2">
              <div className="w-12 h-12 rounded-full bg-zinc-900 border border-[#262626] text-red-500 flex items-center justify-center mx-auto">
                <Bot className="w-6 h-6 animate-pulse" />
              </div>

              <div className="space-y-1 max-w-sm mx-auto">
                <h4 className="text-sm font-bold text-white uppercase tracking-wider">Analysis Concluded</h4>
                <div className="flex justify-center gap-4 text-xs font-mono py-1.5">
                  <div className="bg-zinc-900 border border-[#262626] px-2.5 py-1.5 rounded-xl">
                    <span className="block text-zinc-500 text-[10px]">PROGRESS</span>
                    <span className="text-red-400 font-bold text-sm">{coachingResult.progress}%</span>
                  </div>
                  <div className="bg-zinc-900 border border-[#262626] px-2.5 py-1.5 rounded-xl">
                    <span className="block text-zinc-500 text-[10px]">RISK FACTOR</span>
                    <span className={`font-bold text-sm ${coachingResult.risk > 70 ? 'text-red-400' : 'text-emerald-400'}`}>
                      {coachingResult.risk}%
                    </span>
                  </div>
                </div>
              </div>

              <div className="p-3.5 bg-zinc-900 border border-[#262626] rounded-2xl text-xs text-left leading-relaxed text-zinc-300 max-h-[120px] overflow-y-auto scrollbar-none">
                <span className="font-bold text-[9px] font-mono text-red-400 block mb-1 uppercase tracking-widest">COACHING ANALYSIS</span>
                {coachingResult.advice}
              </div>

              <div className="flex justify-center pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setCoachingResult(null);
                    onClose();
                  }}
                  className="px-6 py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-bold uppercase tracking-wider shadow-[0_0_15px_rgba(220,38,38,0.3)] cursor-pointer transition duration-150"
                >
                  Synchronize Dashboard
                </button>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
