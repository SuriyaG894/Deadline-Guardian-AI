import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Eye, EyeOff, CheckCircle, AlertCircle, Sparkles, RefreshCw, Lock } from 'lucide-react';
import { testGeminiApiKey } from '../api';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentApiKey: string | null;
  onSave: (apiKey: string | null) => Promise<void>;
}

export default function SettingsModal({ isOpen, onClose, currentApiKey, onSave }: SettingsModalProps) {
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setApiKey(currentApiKey || '');
      setTestResult(null);
      setError(null);
      setShowKey(false);
    }
  }, [isOpen, currentApiKey]);

  if (!isOpen) return null;

  const handleTestConnection = async () => {
    if (!apiKey.trim()) {
      setTestResult({ success: false, message: 'Please enter an API key to test.' });
      return;
    }

    setIsTesting(true);
    setTestResult(null);
    try {
      await testGeminiApiKey(apiKey.trim());
      setTestResult({ success: true, message: 'Connection successful! Your API key is valid.' });
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.message || 'Failed to connect. Please check your key and quota.'
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setError(null);

    try {
      const trimmedKey = apiKey.trim();
      await onSave(trimmedKey || null);
      onClose();
    } catch (err: any) {
      console.error(err);
      setError('Failed to save API key to Firestore.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-[#050505]/80 backdrop-blur-md"
      />

      {/* Modal Card */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        className="relative w-full max-w-md bg-[#111114] border border-zinc-800 rounded-3xl p-6 shadow-2xl z-10 space-y-6 overflow-hidden"
      >
        {/* Top Glow */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-red-600 to-indigo-600" />

        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-800/60 pb-3">
          <div className="flex items-center gap-2">
            <Lock className="w-5 h-5 text-red-500" />
            <h2 className="text-base font-bold text-white tracking-tight font-display">System Configuration</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 bg-zinc-900 border border-zinc-800 rounded-lg text-zinc-400 hover:text-white transition duration-150 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="flex items-center gap-3 p-3 bg-red-950/20 border border-red-900/40 rounded-xl text-red-400 text-xs">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-4">
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest block">
              Gemini API Key
            </label>
            <div className="relative">
              <input
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={currentApiKey ? '••••••••••••••••••••••••' : 'Enter your custom Gemini API key'}
                className="w-full bg-[#050505] border border-[#262626] rounded-xl pl-4 pr-11 py-3 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-red-600 transition duration-150 font-mono"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white transition cursor-pointer"
              >
                {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-[10px] text-zinc-500 leading-relaxed font-sans">
              Your API key is stored securely in your private cloud profile in Firebase Firestore. It is never stored on our servers and is only used ephemerally to execute cognitive schedules.
            </p>
          </div>

          {/* Connection Test Results */}
          {testResult && (
            <div className={`p-3.5 rounded-xl border text-xs flex gap-2.5 items-start ${
              testResult.success
                ? 'bg-emerald-950/15 border-emerald-900/40 text-emerald-400'
                : 'bg-red-950/15 border-red-900/40 text-red-400'
            }`}>
              {testResult.success ? (
                <CheckCircle className="w-4 h-4 shrink-0 text-emerald-500 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0 text-red-500 mt-0.5" />
              )}
              <span className="leading-relaxed font-medium">{testResult.message}</span>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={handleTestConnection}
              disabled={isTesting || !apiKey.trim()}
              className="flex-1 h-11 bg-zinc-900 hover:bg-zinc-800 disabled:opacity-40 border border-[#262626] text-zinc-300 font-bold rounded-xl text-xs transition duration-150 flex items-center justify-center gap-2 cursor-pointer uppercase font-mono"
            >
              {isTesting ? (
                <RefreshCw className="w-4 h-4 animate-spin text-zinc-400" />
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Test Connection</span>
                </>
              )}
            </button>

            <button
              type="submit"
              disabled={isSaving}
              className="flex-1 h-11 bg-red-600 hover:bg-red-500 disabled:opacity-55 text-white font-bold rounded-xl text-xs transition duration-150 flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(220,38,38,0.2)] cursor-pointer uppercase font-mono"
            >
              {isSaving ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <span>Save Key</span>
              )}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
