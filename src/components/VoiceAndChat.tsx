/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Mic, MicOff, Send, Sparkles, Bot, User, Volume2, AlertCircle } from 'lucide-react';
import { sendChatMessage } from '../api';
import { 
  auth, 
  saveUserTask, 
  saveUserNotification, 
  saveUserLog, 
  saveUserMetadata, 
  saveUserEvent, 
  deleteUserEvent,
  getUserEvents
} from '../firebase';
import { Task, CalendarEvent } from '../types';

interface Message {
  id: string;
  sender: 'ai' | 'user';
  text: string;
  timestamp: string;
  intent?: string;
  isApiError?: boolean;
  errorType?: string;
}

interface VoiceAndChatProps {
  onRefreshData: () => void;
  activeTaskId?: string;
  tasks?: Task[];
  calendarEvents?: CalendarEvent[];
  rescueMode?: boolean;
  geminiApiKey?: string;
}

// Browser SpeechRecognition Type Declarations
interface SpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message: string;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  onstart: (event: Event) => void;
  onend: (event: Event) => void;
  onresult: (event: SpeechRecognitionEvent) => void;
  onerror: (event: SpeechRecognitionErrorEvent) => void;
}

export default function VoiceAndChat({ 
  onRefreshData, 
  activeTaskId,
  tasks,
  calendarEvents,
  rescueMode,
  geminiApiKey
}: VoiceAndChatProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      sender: 'ai',
      text: "Hello! I am your Deadline Guardian Chief of Staff. I track your focus, analyze risk, and trigger Rescue Mode when tasks slip. Ask me to 'Plan my day', 'Finished around 60%', or say 'Create a task to finish my portfolio by Friday.'",
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [speechError, setSpeechError] = useState<string | null>(null);
  const [transcription, setTranscription] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  // Suggested shortcut commands
  const suggestions = [
    { text: "Finish my AI project before Sunday. 20 hours.", icon: "🎯" },
    { text: "Finished around 60%", icon: "📈" },
    { text: "Move today's work to tomorrow", icon: "🗓️" },
    { text: "What's my most important task?", icon: "🧠" }
  ];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Setup Browser Web Speech API
  useEffect(() => {
    const SpeechRecognitionClass = 
      (window as any).SpeechRecognition || 
      (window as any).webkitSpeechRecognition;

    if (SpeechRecognitionClass) {
      const rec = new SpeechRecognitionClass() as SpeechRecognition;
      rec.continuous = false;
      rec.interimResults = true;
      rec.lang = 'en-US';

      rec.onstart = () => {
        setIsListening(true);
        setSpeechError(null);
        setTranscription('');
      };

      rec.onresult = (event: SpeechRecognitionEvent) => {
        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          } else {
            interimTranscript += event.results[i][0].transcript;
          }
        }

        const currentText = finalTranscript || interimTranscript;
        setTranscription(currentText);
        setInputMessage(currentText);
      };

      rec.onerror = (event: SpeechRecognitionErrorEvent) => {
        console.error("Speech Recognition Error:", event.error);
        if (event.error === 'not-allowed') {
          setSpeechError("Microphone permission denied. Using text input.");
        } else {
          setSpeechError(`Error: ${event.error}. Please try again.`);
        }
        setIsListening(false);
      };

      rec.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = rec;
    }
  }, []);

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputMessage).trim();
    if (!text) return;

    setInputMessage('');
    setTranscription('');
    
    // Add User Message
    const userMsg: Message = {
      id: `msg-${Date.now()}`,
      sender: 'user',
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    setMessages(prev => [...prev, userMsg]);
    setIsLoading(true);

    try {
      const currentUser = auth.currentUser;
      const response = await sendChatMessage(text, null, tasks, calendarEvents, rescueMode, geminiApiKey);
      
      const aiMsg: Message = {
        id: `msg-ai-${Date.now()}`,
        sender: 'ai',
        text: response.reply,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        intent: response.intent
      };
      setMessages(prev => [...prev, aiMsg]);

      // If there was a side-effect created on server state, trigger reload / save to Firestore
      if (response.effect) {
        if (currentUser) {
          const eff = response.effect;
          if (eff.type === 'TASK_CREATED' && eff.task) {
            await saveUserTask(currentUser.uid, eff.task.id, eff.task);
            if (eff.notification) {
              await saveUserNotification(currentUser.uid, eff.notification.id, eff.notification);
            }
          } else if (eff.type === 'PROGRESS_UPDATED' && eff.task) {
            await saveUserTask(currentUser.uid, eff.task.id, eff.task);
            if (eff.log) {
              await saveUserLog(currentUser.uid, eff.log.id, eff.log);
            }
            if (typeof eff.rescueMode === 'boolean') {
              await saveUserMetadata(currentUser.uid, { rescueMode: eff.rescueMode });
            }
            if (eff.notification) {
              await saveUserNotification(currentUser.uid, eff.notification.id, eff.notification);
            }
          } else if (eff.type === 'SCHEDULE_SHIFTED' && Array.isArray(eff.events)) {
            const oldEvents = await getUserEvents(currentUser.uid);
            for (const old of oldEvents) {
              await deleteUserEvent(currentUser.uid, old.id);
            }
            for (const ev of eff.events) {
              await saveUserEvent(currentUser.uid, ev.id, ev);
            }
            if (eff.notification) {
              await saveUserNotification(currentUser.uid, eff.notification.id, eff.notification);
            }
          }
        }
        onRefreshData();
      }
    } catch (err: any) {
      console.error(err);
      let errorText = "I encountered a communication bottleneck with the core scheduler. Please verify your connection.";
      
      const isPermissionDenied = 
        err?.code === 'permission-denied' || 
        err?.message?.includes('permission-denied') || 
        err?.message?.includes('permissions');
        
      if (isPermissionDenied) {
        errorText = "Database Permission Issue: Your custom Firebase project security rules are currently blocking writes. Please make sure to deploy the Firestore Security Rules for your project 'deadline-guardian-ai-894f', or use Demo Sandbox Mode from the top-right sign-out menu to bypass real-time DB limits instantly.";
      }
      
      const isGeminiError = err?.error?.code === 'GEMINI_API_ERROR' || err?.message?.includes('Gemini API') || err?.message?.includes('API key');
      
      const errorMsg: Message = {
        id: `msg-err-${Date.now()}`,
        sender: 'ai',
        text: isGeminiError ? err.message : errorText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isApiError: isGeminiError,
        errorType: err?.error?.type
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
    } else {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.start();
        } catch (e) {
          console.error("Start speech failed:", e);
        }
      } else {
        // Mock listener if not supported in iframe/browser
        setIsListening(true);
        setSpeechError(null);
        setTranscription("Listening...");
        
        const mockPhrases = [
          "Plan my day.",
          "Finished around 60% of backend development.",
          "Move today's focus block to tomorrow morning.",
          "Create a task to finish my presentation before Friday. 12 hours."
        ];
        
        // Select a random phrase to simulate voice input
        const randomPhrase = mockPhrases[Math.floor(Math.random() * mockPhrases.length)];
        
        setTimeout(() => {
          setTranscription(randomPhrase);
          setInputMessage(randomPhrase);
          setIsListening(false);
        }, 2200);
      }
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#0d1527] border border-slate-800 rounded-xl overflow-hidden shadow-xl" id="voice-chat-console">
      {/* Console Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-[#111c38] border-b border-slate-800">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-indigo-400 animate-pulse" />
          <span className="font-display font-medium text-slate-100 text-sm">AI Chief of Staff Console</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
          <span className="text-[10px] font-mono text-slate-400">COGNITIVE ENGINE LIVE</span>
        </div>
      </div>

      {/* Messages Window */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-[250px] scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent">
        <AnimatePresence initial={false}>
          {messages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className={`flex gap-3 max-w-[85%] ${msg.sender === 'user' ? 'ml-auto flex-row-reverse' : ''}`}
            >
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border ${
                msg.sender === 'user' 
                  ? 'bg-indigo-900/40 border-indigo-700 text-indigo-300' 
                  : 'bg-slate-800 border-slate-700 text-slate-300'
              }`}>
                {msg.sender === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
              </div>

              <div className="space-y-1">
                {msg.isApiError ? (
                  <div className="bg-red-950/20 border border-red-900/40 p-4 rounded-xl text-red-400 space-y-3 rounded-tl-none">
                    <div className="flex items-start gap-2.5">
                      <AlertCircle className="w-5 h-5 shrink-0 text-red-500 mt-0.5" />
                      <div>
                        <p className="font-bold text-xs uppercase tracking-wide">Gemini API Connection Issue</p>
                        <p className="text-xs text-red-300 mt-1 leading-relaxed font-sans">{msg.text}</p>
                      </div>
                    </div>
                    {(msg.errorType === 'INVALID_KEY' || msg.errorType === 'QUOTA_EXCEEDED' || msg.text?.includes('key')) && (
                      <button
                        onClick={() => {
                          window.dispatchEvent(new CustomEvent('open-api-settings'));
                        }}
                        className="px-3 py-1.5 bg-red-900/40 hover:bg-red-800/60 border border-red-800/50 rounded-lg text-[10px] font-mono font-bold text-white transition duration-150 uppercase cursor-pointer"
                      >
                        Configure API Key
                      </button>
                    )}
                  </div>
                ) : (
                  <div className={`px-3.5 py-2.5 rounded-xl text-sm leading-relaxed ${
                    msg.sender === 'user'
                      ? 'bg-indigo-600/90 text-white rounded-tr-none border border-indigo-500'
                      : 'bg-slate-800/80 text-slate-200 rounded-tl-none border border-slate-700'
                  }`}>
                    {msg.text}
                  </div>
                )}
                <div className={`text-[10px] font-mono text-slate-500 px-1 ${msg.sender === 'user' ? 'text-right' : ''}`}>
                  {msg.timestamp}
                  {msg.intent && <span className="ml-2 text-indigo-400 capitalize">· {msg.intent.replace('_', ' ')}</span>}
                </div>
              </div>
            </motion.div>
          ))}
          
          {isLoading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex gap-3 max-w-[80%]"
            >
              <div className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-indigo-400">
                <Bot className="w-4 h-4 animate-spin" />
              </div>
              <div className="bg-slate-800/50 border border-slate-800 text-slate-400 px-4 py-2.5 rounded-xl rounded-tl-none text-sm flex items-center gap-2">
                <span className="flex gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '0ms' }}></span>
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '150ms' }}></span>
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '300ms' }}></span>
                </span>
                Recalculating timeline risk...
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        <div ref={messagesEndRef} />
      </div>

      {/* Voice input state alerts */}
      {isListening && (
        <div className="mx-4 mb-2 p-2 bg-indigo-950/40 border border-indigo-800/50 rounded-lg flex items-center gap-2 text-indigo-300 text-xs font-mono animate-pulse">
          <Volume2 className="w-3.5 h-3.5 animate-bounce" />
          <span>{transcription || "Listening for speech... say anything"}</span>
        </div>
      )}

      {speechError && (
        <div className="mx-4 mb-2 p-2 bg-amber-950/40 border border-amber-800/50 rounded-lg flex items-center gap-2 text-amber-300 text-xs font-mono">
          <AlertCircle className="w-3.5 h-3.5" />
          <span>{speechError}</span>
        </div>
      )}

      {/* Shortcuts */}
      <div className="px-4 py-2 bg-[#0a101e] border-t border-slate-800/50 flex gap-2 overflow-x-auto scrollbar-none scroll-smooth">
        {suggestions.map((s, idx) => (
          <button
            key={idx}
            onClick={() => handleSendMessage(s.text)}
            className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-slate-800/50 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-slate-300 rounded-lg text-xs transition duration-200"
          >
            <span>{s.icon}</span>
            <span>{s.text}</span>
          </button>
        ))}
      </div>

      {/* Input Box */}
      <div className="p-3 bg-[#0d1527] border-t border-slate-800 flex gap-2 items-center">
        <button
          onClick={toggleListening}
          className={`w-10 h-10 rounded-xl flex items-center justify-center transition duration-200 border cursor-pointer ${
            isListening 
              ? 'bg-rose-600 hover:bg-rose-700 border-rose-500 text-white animate-pulse' 
              : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-300 hover:text-white'
          }`}
          title={isListening ? "Stop listening" : "Tap to speak task or update"}
          id="voice-mic-trigger"
        >
          {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
        </button>

        <input
          type="text"
          value={inputMessage}
          onChange={(e) => setInputMessage(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
          placeholder="Ask AI to plan, check-in, create tasks, or reschedule..."
          className="flex-1 min-w-0 px-4 py-2 bg-slate-900 border border-slate-800 hover:border-slate-700 focus:border-indigo-500 rounded-xl text-slate-100 text-sm focus:outline-none transition duration-150"
        />

        <button
          onClick={() => handleSendMessage()}
          disabled={!inputMessage.trim() || isLoading}
          className="w-10 h-10 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-600 border border-indigo-500 disabled:border-slate-800 text-white rounded-xl flex items-center justify-center transition duration-150 cursor-pointer"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
