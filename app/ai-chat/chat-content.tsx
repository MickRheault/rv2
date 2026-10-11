'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import './markdown.css';

interface Message {
    role: 'user' | 'assistant';
    content: string;
    toolCalls?: { name: string; args: string; result: string }[];
}

export default function ChatContent({ accessRequired }: { accessRequired: boolean }) {
    const searchParams = useSearchParams();
    const secret = searchParams.get('secret');

    // Hooks must be called unconditionally (before any returns)
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    // The API validates the supplied access code against a server-only environment variable.
    if (accessRequired && !secret) {
        return (
            <div style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                height: '100vh',
                background: '#0a0a0a',
                color: '#666'
            }}>
                Access denied
            </div>
        );
    }

    const sendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || isLoading) return;

        const userMessage = input.trim();
        setInput('');
        setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
        setIsLoading(true);

        try {
            const res = await fetch('/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(accessRequired && secret ? { Authorization: `Bearer ${secret}` } : {}),
                },
                body: JSON.stringify({ message: userMessage }),
            });

            const fallbackError = res.status === 504
                ? 'The chat request timed out. Please try again.'
                : `The chat server returned an unexpected response (HTTP ${res.status}). Please try again.`;
            let data;
            try {
                data = JSON.parse(await res.text());
            } catch {
                throw new Error(fallbackError);
            }
            if (!data || typeof data !== 'object' || Array.isArray(data)) {
                throw new Error(fallbackError);
            }

            if (!res.ok || data.error) {
                throw new Error(typeof data.error === 'string' ? data.error : fallbackError);
            } else {
                setMessages(prev => [
                    ...prev,
                    {
                        role: 'assistant',
                        content: data.response || 'No response',
                        toolCalls: data.toolCalls,
                    },
                ]);
            }
        } catch (error) {
            setMessages(prev => [
                ...prev,
                { role: 'assistant', content: `Error: ${error instanceof Error ? error.message : 'Unable to contact the chat server. Please try again.'}` },
            ]);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8 flex flex-col font-sans">
            <header className="text-center mb-8">
                <h1 className="text-3xl font-bold text-gray-900">Motorcycle Rental Assistant (Beta)</h1>
                <p className="mt-2 text-sm text-gray-600">Find motorcycles, compare rental shops, and explore rental options.</p>
            </header>

            <div className="w-full max-w-4xl mx-auto bg-white rounded-2xl shadow-xl border border-gray-100 flex flex-col overflow-hidden h-[70vh] min-h-[500px] max-h-[800px]">
                <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-gray-50/50">
                    {messages.length === 0 && (
                        <div className="flex flex-col items-center justify-center h-full text-gray-500 space-y-4">
                            <p className="font-medium text-lg text-gray-700">Try asking:</p>
                            <ul className="space-y-2 text-center text-sm">
                                <li className="bg-white px-4 py-2 rounded-full shadow-sm border border-gray-100 cursor-pointer hover:border-blue-300 hover:text-blue-600 transition-colors" onClick={() => setInput('Find scooters in Bangkok')}>&quot;Find scooters in Bangkok&quot;</li>
                                <li className="bg-white px-4 py-2 rounded-full shadow-sm border border-gray-100 cursor-pointer hover:border-blue-300 hover:text-blue-600 transition-colors" onClick={() => setInput('List adventure bikes in Chiang Mai')}>&quot;List adventure bikes in Chiang Mai&quot;</li>
                                <li className="bg-white px-4 py-2 rounded-full shadow-sm border border-gray-100 cursor-pointer hover:border-blue-300 hover:text-blue-600 transition-colors" onClick={() => setInput('What brands are available?')}>&quot;What brands are available?&quot;</li>
                                <li className="bg-white px-4 py-2 rounded-full shadow-sm border border-gray-100 cursor-pointer hover:border-blue-300 hover:text-blue-600 transition-colors" onClick={() => setInput('Show me shops in Phuket')}>&quot;Show me shops in Phuket&quot;</li>
                            </ul>
                        </div>
                    )}

                    {messages.map((msg, i) => (
                        <div
                            key={i}
                            className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
                        >
                            <div className="text-xs text-gray-500 mb-1 px-1">
                                {msg.role === 'user' ? '👤 You' : '🤖 Assistant'}
                            </div>
                            <div className={`max-w-[85%] rounded-2xl px-5 py-3.5 shadow-sm ${
                                msg.role === 'user' 
                                    ? 'bg-blue-600 text-white rounded-br-none' 
                                    : 'bg-white text-gray-800 border border-gray-100 rounded-bl-none'
                            }`}>
                                {msg.role === 'user' ? (
                                    <div className="whitespace-pre-wrap">{msg.content}</div>
                                ) : (
                                    <div className="prose prose-sm max-w-none prose-a:text-blue-600 prose-a:no-underline hover:prose-a:underline">
                                        <ReactMarkdown
                                            components={{
                                                a: ({ href, children }) => (
                                                    <a href={href} target="_blank" rel="noopener noreferrer">
                                                        {children}
                                                    </a>
                                                ),
                                                p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                                                ul: ({ children }) => <ul className="list-disc pl-4 mb-2">{children}</ul>,
                                                li: ({ children }) => <li className="mb-1">{children}</li>,
                                            }}
                                        >
                                            {msg.content}
                                        </ReactMarkdown>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}

                    {isLoading && (
                        <div className="flex flex-col items-start">
                            <div className="text-xs text-gray-500 mb-1 px-1">🤖 Assistant</div>
                            <div className="bg-white border border-gray-100 rounded-2xl rounded-bl-none px-5 py-4 shadow-sm flex items-center space-x-2">
                                <div className="w-2 h-2 bg-gray-300 rounded-full animate-bounce"></div>
                                <div className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                                <div className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
                            </div>
                        </div>
                    )}
                </div>

                <div className="p-4 bg-white border-t border-gray-100 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.02)]">
                    <form onSubmit={sendMessage} className="flex gap-3 max-w-4xl mx-auto">
                        <input
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            placeholder="Ask about motorcycles, shops, or locations..."
                            className="flex-1 px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all shadow-inner"
                            disabled={isLoading}
                        />
                        <button 
                            type="submit" 
                            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl transition-colors shadow-sm disabled:opacity-60 disabled:cursor-not-allowed flex items-center"
                            disabled={isLoading}
                        >
                            {isLoading ? '...' : (
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                                    <path d="M3.478 2.404a.75.75 0 00-.926.941l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.404z" />
                                </svg>
                            )}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}
