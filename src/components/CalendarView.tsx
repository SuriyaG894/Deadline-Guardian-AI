/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { motion } from 'motion/react';
import { Calendar, Check, ExternalLink, ShieldCheck, Link2, AlertCircle, Bot } from 'lucide-react';
import { CalendarEvent } from '../types';

interface CalendarViewProps {
  events: CalendarEvent[];
  isConnected: boolean;
  onToggleConnect: () => void;
  onTriggerCheckin: (taskId: string, sessionTitle: string) => void;
  error?: { message: string; details?: string; apiDisabled?: boolean } | null;
  onClearError?: () => void;
}

export default function CalendarView({ events, isConnected, onToggleConnect, onTriggerCheckin, error, onClearError }: CalendarViewProps) {
  // Sort events chronologically
  const sortedEvents = [...events].sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

  const formatDateTime = (isoStr: string) => {
    let normalized = isoStr;
    // Check if it has a time part (T) but lacks a timezone indicator (Z or +/- offset at the end)
    if (isoStr.includes('T') && !isoStr.endsWith('Z') && !/[+-]\d{2}:?\d{2}$/.test(isoStr)) {
      normalized = isoStr + 'Z';
    }
    const d = new Date(normalized);
    const day = d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
    const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return { day, time };
  };

  return (
    <div className="bg-[#111114] border border-[#262626] rounded-3xl p-6 relative overflow-hidden h-full flex flex-col" id="calendar-timeline-panel">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#262626] pb-3 mb-4">
        <div className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-red-500" />
          <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-300">Google Calendar Timeline</h3>
        </div>
        
        <button
          onClick={onToggleConnect}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-mono font-semibold transition duration-200 cursor-pointer border ${
            isConnected
              ? 'bg-emerald-950/20 hover:bg-emerald-950/40 border-emerald-900/50 text-emerald-400'
              : 'bg-red-600 hover:bg-red-500 border-none text-white shadow-[0_0_15px_rgba(220,38,38,0.3)]'
          }`}
        >
          {isConnected ? (
            <>
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>CONNECTED</span>
            </>
          ) : (
            <>
              <Link2 className="w-3.5 h-3.5" />
              <span>CONNECT CALENDAR</span>
            </>
          )}
        </button>
      </div>

      {/* Error Alert Box */}
      {error && (
        <div className="bg-red-950/20 border border-red-900/50 rounded-2xl p-4 mb-4 text-xs space-y-2 relative" id="calendar-error-banner">
          <div className="flex items-start gap-2 text-red-400 font-semibold">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <p>{error.message}</p>
              {error.apiDisabled && (
                <p className="mt-1.5 text-zinc-300 font-normal leading-relaxed">
                  Google Calendar API is not enabled in your Google Cloud Project. Please visit the Cloud Console to enable it, then try connecting again:
                </p>
              )}
            </div>
          </div>
          {error.apiDisabled && (
            <div className="pt-1">
              <a
                href="https://console.developers.google.com/apis/api/calendar-json.googleapis.com/overview"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-red-400 hover:text-red-300 font-mono font-bold underline cursor-pointer bg-red-950/40 px-2 py-1 rounded"
              >
                Enable Calendar API
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          )}
          {onClearError && (
            <button
              onClick={onClearError}
              className="absolute top-2 right-2 text-zinc-500 hover:text-zinc-300 text-sm font-bold cursor-pointer px-1"
            >
              ×
            </button>
          )}
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto pr-1 space-y-3 min-h-[220px] scrollbar-none">
        {isConnected ? (
          sortedEvents.length > 0 ? (
            <div className="relative border-l border-[#262626] pl-4 ml-2 space-y-4 py-1">
              {sortedEvents.map((evt, idx) => {
                const { day, time } = formatDateTime(evt.start);
                const end = formatDateTime(evt.end);

                return (
                  <motion.div
                    key={evt.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className={`relative p-3.5 rounded-2xl border transition duration-200 group ${
                      evt.isFocusSession
                        ? 'bg-red-950/10 hover:bg-red-950/20 border-red-900/40 hover:border-red-500 shadow-md shadow-red-950/10'
                        : 'bg-zinc-900/30 hover:bg-zinc-900/50 border-[#262626] hover:border-zinc-700'
                    }`}
                  >
                    {/* Event Type Dot on timeline line */}
                    <span className={`absolute -left-[21px] top-4.5 w-2 h-2 rounded-full border ${
                      evt.isFocusSession
                        ? 'bg-red-500 border-red-400'
                        : 'bg-zinc-600 border-[#262626]'
                    }`} />

                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5">
                          {evt.isFocusSession && (
                            <span className="text-[9px] font-mono uppercase bg-red-950/40 text-red-400 px-1.5 py-0.5 rounded-md border border-red-900/30">
                              AI FOCUS WINDOW
                            </span>
                          )}
                          <span className="text-[10px] font-mono text-zinc-400">
                            {day} · {time} - {end.time}
                          </span>
                        </div>
                        <h4 className={`text-xs font-semibold ${evt.isFocusSession ? 'text-red-200' : 'text-zinc-300'}`}>
                          {evt.title}
                        </h4>
                      </div>

                      {evt.isFocusSession && evt.taskId && (
                        <button
                          onClick={() => onTriggerCheckin(evt.taskId!, evt.title)}
                          className="shrink-0 flex items-center gap-1 px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white rounded-xl text-[10px] font-bold tracking-wide uppercase cursor-pointer transition duration-150 shadow-[0_0_12px_rgba(220,38,38,0.3)]"
                        >
                          <Check className="w-3 h-3" />
                          CHECK-IN
                        </button>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center p-6 text-center text-zinc-500">
              <AlertCircle className="w-8 h-8 text-zinc-600 mb-2" />
              <p className="text-xs">No events scheduled. Ask Gemini to create an execution plan to populate focus sessions!</p>
            </div>
          )
        ) : (
          /* Locked State if Google Calendar is disconnected */
          <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-4">
            <div className="w-12 h-12 rounded-full bg-zinc-900 flex items-center justify-center border border-[#262626] text-zinc-400 animate-pulse">
              <Calendar className="w-6 h-6 text-zinc-400" />
            </div>
            
            <div className="max-w-xs space-y-1">
              <h4 className="text-xs font-semibold text-white uppercase tracking-wider">Calendar Sync Required</h4>
              <p className="text-[11px] text-zinc-400 leading-relaxed">
                Connect your Google Calendar so the Guardian Chief of Staff can read meetings, interviews, classes, and map AI focus windows dynamically around your life events.
              </p>
            </div>

            <button
              onClick={onToggleConnect}
              className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 shadow-[0_0_15px_rgba(220,38,38,0.3)] cursor-pointer transition duration-150"
            >
              <Bot className="w-4 h-4" />
              Authorize Calendar Sync
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
