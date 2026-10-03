"use client";

import React, { useState, useRef, useEffect } from 'react';

export default function ChatPage() {
  const [chatInput, setChatInput] = useState('');
  const [chatHistory, setChatHistory] = useState([
    { 
      role: 'ai', 
      text: 'Hello. I am the CargoX Chartering Copilot. I have analyzed 44,000 historical fixtures and live AIS data. How can I assist your fixing strategy today?' 
    }
  ]);
  
  const chatEndRef = useRef<HTMLDivElement>(null);

  const handleChatSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    
    const newHistory = [...chatHistory, { role: 'user', text: chatInput }];
    setChatHistory(newHistory);
    setChatInput('');
    
    // Mock AI Response
    setTimeout(() => {
      setChatHistory([
        ...newHistory, 
        { 
          role: 'ai', 
          text: 'Based on the Holt-damped ensemble, locking a 90-day fixture on the East Coast India corridor today hedges against a projected 11.5% rate hike by Q4. Would you like me to run this through the Vessel Optimizer?' 
        }
      ]);
    }, 1000);
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
        <p className="text-mist text-sm mt-2">Chat with our domain-trained ensemble model.</p>
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
                {msg.text}
              </div>
            </div>
          ))}
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
              className="flex-1 bg-ink-950 border border-line text-paper px-4 py-3 rounded-lg focus:outline-none focus:border-brand/50 transition-colors placeholder:text-fog text-[14px]"
            />
            <button 
              type="submit" 
              className="bg-brand text-ink-950 font-bold px-6 py-3 rounded-lg hover:bg-brand-soft transition-colors shadow-[0_0_15px_-3px_rgba(242,166,59,0.4)]"
            >
              Send
            </button>
          </form>
        </div>

      </div>
    </div>
  );
}