"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import React, { useState, useRef, useEffect } from 'react';

export default function ChatPage() {
  const [chatInput, setChatInput] = useState('');
  const [chatHistory, setChatHistory] = useState([
    {
      role: 'ai',
      text: 'Hello. I am CargoX Copilot. I can answer using the data and forecasts currently available in CargoX. I do not run a web search unless you explicitly ask for one.'
    }
  ]);
  const [isLoading, setIsLoading] = useState(false);
  
  const chatEndRef = useRef<HTMLDivElement>(null);

  const handleChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const message = chatInput.trim();
    if (!message || isLoading) return;

    setChatHistory((history) => [...history, { role: 'user', text: message }]);
    setChatInput('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(typeof data.error === 'string' ? data.error : 'CargoX could not answer this question.');
      }
      setChatHistory((history) => [...history, { role: 'ai', text: data.answer }]);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unexpected error. Please try again.';
      setChatHistory((history) => [...history, { role: 'ai', text: `I couldn't answer that: ${message}` }]);
    } finally {
      setIsLoading(false);
    }
  };

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatHistory]);

  return (
    <div className="anim-fade-up flex flex-col h-[calc(100vh-160px)] max-w-[900px] mx-auto">
      
      {/* Header */}
      <div className="text-center mb-6 shrink-0">
        <h2 className="text-3xl font-extrabold text-paper tracking-tight">
          Cargo<span className="text-brand">X</span> Copilot AI
        </h2>
        <p className="text-mist text-sm mt-2">Answers grounded in CargoX database data and existing forecasts.</p>
      </div>
      
      {/* Chat Container */}
      <div className="panel flex flex-col flex-1 overflow-hidden shadow-2xl">
        
        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-4">
          {chatHistory.map((msg, idx) => (
            <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div 
                className={`max-w-[80%] px-4 py-3 rounded-xl text-[14px] leading-relaxed ${
                  msg.role === 'user' 
                    ? 'bg-brand text-ink-950 font-semibold shadow-lg' 
                    : 'bg-ink-800/60 border border-line text-paper'
                }`}
              >
                <ReactMarkdown
  remarkPlugins={[remarkGfm]}
  components={{
    h1: ({ children }) => (
      <h1 className="mb-3 mt-2 text-xl font-bold text-paper">{children}</h1>
    ),
    h2: ({ children }) => (
      <h2 className="mb-2 mt-4 text-lg font-bold text-paper">{children}</h2>
    ),
    h3: ({ children }) => (
      <h3 className="mb-2 mt-3 text-base font-semibold text-paper">{children}</h3>
    ),
    p: ({ children }) => (
      <p className="mb-3 leading-7 last:mb-0">{children}</p>
    ),
    strong: ({ children }) => (
      <strong className="font-bold text-paper">{children}</strong>
    ),
    ul: ({ children }) => (
      <ul className="mb-3 list-disc space-y-1 pl-6">{children}</ul>
    ),
    ol: ({ children }) => (
      <ol className="mb-3 list-decimal space-y-1 pl-6">{children}</ol>
    ),
    li: ({ children }) => <li className="pl-1">{children}</li>,
    table: ({ children }) => (
      <div className="my-4 w-full overflow-x-auto rounded-lg border border-line">
        <table className="w-full border-collapse text-left text-sm">
          {children}
        </table>
      </div>
    ),
    thead: ({ children }) => (
      <thead className="bg-brand/15 text-paper">{children}</thead>
    ),
    th: ({ children }) => (
      <th className="whitespace-nowrap border-b border-line px-3 py-3 font-semibold">
        {children}
      </th>
    ),
    td: ({ children }) => (
      <td className="border-b border-line px-3 py-2.5 align-top">{children}</td>
    ),
    tr: ({ children }) => (
      <tr className="even:bg-ink-800/40">{children}</tr>
    ),
  }}
>
  {msg.text}
</ReactMarkdown>
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex justify-start">
              <div className="max-w-[80%] px-4 py-3 rounded-xl text-[14px] bg-ink-800/60 border border-line text-mist">
                Checking CargoX data and preparing an answer…
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>
        
        {/* Input Area */}
        <div className="p-4 bg-ink-900/80 border-t border-line shrink-0">
          <form onSubmit={handleChatSubmit} className="flex gap-3">
            <input 
              type="text" 
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="Ask about rate trends, port limits, or optimal entry windows..." 
              disabled={isLoading}
              className="flex-1 bg-ink-950 border border-line text-paper px-4 py-3 rounded-lg focus:outline-none focus:border-brand/50 transition-colors placeholder:text-fog text-[14px]"
            />
            <button 
              type="submit"
              disabled={isLoading || !chatInput.trim()}
              className="bg-brand disabled:opacity-50 disabled:cursor-not-allowed text-ink-950 font-bold px-6 py-3 rounded-lg hover:bg-brand-soft transition-colors shadow-[0_0_15px_-3px_rgba(242,166,59,0.4)]"
            >
              {isLoading ? 'Thinking…' : 'Send'}
            </button>
          </form>
        </div>

      </div>
    </div>
  );
}