import React, { useState, useRef, useEffect } from 'react';
import { Send, Sparkles, Globe2, Activity } from 'lucide-react';
import { ChatMessage } from '../types';
import { sendMessageToGemini } from '../services/geminiService';

const ChatInterface: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'init',
      role: 'model',
      text: 'Planetary link established. I am Gaia. Monitoring global systems. How can I assist you?',
      timestamp: new Date()
    }
  ]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      text: input,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    const responseText = await sendMessageToGemini(messages, input);

    const botMsg: ChatMessage = {
      id: (Date.now() + 1).toString(),
      role: 'model',
      text: responseText,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, botMsg]);
    setIsLoading(false);
  };

  // Minimized State
  if (!isOpen) {
    return (
      <button 
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 bg-[#0533F3] hover:bg-blue-600 text-white p-4 rounded-full shadow-lg shadow-blue-900/50 transition-all duration-300 z-50 group"
      >
        <Globe2 className="w-6 h-6 animate-pulse group-hover:scale-110 transition-transform" />
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 w-96 max-w-[calc(100vw-48px)] h-[500px] bg-black/80 backdrop-blur-md border border-[#0533F3]/30 rounded-2xl shadow-2xl shadow-blue-900/20 flex flex-col overflow-hidden z-50 animate-in slide-in-from-bottom-10 fade-in duration-300">
      
      {/* Header */}
      <div className="p-4 border-b border-[#0533F3]/20 bg-gradient-to-r from-blue-950/50 to-transparent flex justify-between items-center">
        <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-[#0533F3]" />
            <h3 className="text-blue-100 font-medium tracking-widest text-sm uppercase">Gaia Interface</h3>
        </div>
        <button 
            onClick={() => setIsOpen(false)}
            className="text-blue-300 hover:text-white transition-colors"
        >
            <span className="text-xl">&times;</span>
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`
                    max-w-[85%] p-3 rounded-lg text-sm leading-relaxed
                    ${msg.role === 'user' 
                        ? 'bg-[#0533F3]/20 text-blue-100 border border-[#0533F3]/30 rounded-tr-none' 
                        : 'bg-zinc-900/80 text-gray-300 border border-zinc-800 rounded-tl-none'}
                `}>
                    {msg.text}
                </div>
            </div>
        ))}
        {isLoading && (
             <div className="flex justify-start">
                <div className="bg-zinc-900/80 text-gray-300 border border-zinc-800 rounded-lg p-3 rounded-tl-none flex gap-2 items-center">
                    <Sparkles className="w-3 h-3 text-[#0533F3] animate-spin" />
                    <span className="text-xs tracking-wider opacity-70">PROCESSING</span>
                </div>
             </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="p-4 border-t border-[#0533F3]/20 bg-black/40">
        <div className="relative">
            <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Query planetary database..."
                className="w-full bg-black/50 border border-[#0533F3]/30 rounded-lg pl-4 pr-12 py-3 text-sm text-white focus:outline-none focus:border-[#0533F3] focus:ring-1 focus:ring-[#0533F3] transition-all placeholder-blue-900/50"
            />
            <button 
                type="submit"
                disabled={isLoading}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-[#0533F3] hover:text-white disabled:opacity-50 transition-colors"
            >
                <Send className="w-4 h-4" />
            </button>
        </div>
      </form>
    </div>
  );
};

export default ChatInterface;
