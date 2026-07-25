'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Send, Loader2 } from 'lucide-react';
import { C, inputStyle } from './tokens';
import { SectionHeader, EmptyState } from './ui';

export default function AIAssistant({ context }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const send = async (overrideText) => {
    const text = (overrideText ?? input).trim();
    if (!text || loading) return;
    setInput('');
    setError('');
    const nextMessages = [...messages, { role: 'user', content: text }];
    setMessages(nextMessages);
    setLoading(true);
    try {
      const res = await fetch('/api/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          history: messages.slice(-8),
          context,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Hitilafu imetokea.');
      setMessages((prev) => [...prev, { role: 'assistant', content: data.reply, source: data.source, note: data.note }]);
    } catch (e) {
      setError(e.message || 'Hitilafu imetokea. Jaribu tena.');
    } finally {
      setLoading(false);
    }
  };

  const suggestions = [
    'Nifanyeje kuongeza faida mwezi huu?',
    'Ni wateja gani niwafuatilie leo?',
    'Eleza mwenendo wa mauzo mwezi huu',
    'Fedha zangu ziko sawa kwenye akaunti?',
  ];

  return (
    <div className="flex flex-col" style={{ minHeight: '60vh' }}>
      <SectionHeader title="Msaidizi wa AI" sub="Uliza chochote kuhusu biashara yako — anajua takwimu zako za sasa" />

      <div className="flex-1 space-y-2 pb-3">
        {messages.length === 0 && (
          <div className="space-y-2">
            <EmptyState text="Hujauliza swali bado. Jaribu mojawapo ya haya:" />
            <div className="flex flex-wrap gap-1.5">
              {suggestions.map((s, i) => (
                <button
                  key={i}
                  onClick={() => send(s)}
                  className="text-xs px-3 py-1.5 rounded-full text-left"
                  style={{ background: C.sageLight, color: C.sage }}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
            <div
              className="rounded-2xl px-3 py-2 text-sm max-w-[85%] whitespace-pre-wrap"
              style={{
                background: m.role === 'user' ? C.dark : C.paper,
                color: m.role === 'user' ? '#fff' : C.text,
                border: m.role === 'user' ? 'none' : `1px solid ${C.border}`,
              }}
            >
              {m.content}
            </div>
            {m.role === 'assistant' && m.source === 'local' && (
              <span className="text-[10px] mt-1 px-2 py-0.5 rounded-full" style={{ background: '#F6EBD0', color: '#8A6412' }}>
                Msaidizi wa Ndani (bure, bila AI kamili)
              </span>
            )}
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div
              className="rounded-2xl px-3 py-2 text-sm flex items-center gap-2"
              style={{ background: C.paper, border: `1px solid ${C.border}`, color: C.muted }}
            >
              <Loader2 size={14} className="animate-spin" /> Anafikiri...
            </div>
          </div>
        )}

        {error && (
          <div className="text-xs px-3 py-2 rounded-lg" style={{ background: C.brickLight, color: C.brick }}>{error}</div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="flex gap-2 pt-2 sticky bottom-16" style={{ background: C.bg }}>
        <input
          style={inputStyle}
          placeholder="Andika swali lako..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') send(); }}
        />
        <button
          onClick={() => send()}
          disabled={loading}
          className="p-2.5 rounded-xl"
          style={{ background: C.dark, color: '#fff', opacity: loading ? 0.6 : 1 }}
        >
          <Send size={16} />
        </button>
      </div>
    </div>
  );
}
