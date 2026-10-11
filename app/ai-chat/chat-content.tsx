'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useSearchParams } from 'next/navigation';
import { ArrowLeftIcon, PlusIcon } from '@heroicons/react/24/outline';
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

    const formRef = useRef<HTMLFormElement>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const abortControllerRef = useRef<AbortController | null>(null);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView?.({ behavior: 'smooth' });
    }, [messages, isLoading]);

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

    const handleNewChat = () => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }
        setMessages([]);
        setInput('');
        setIsLoading(false);
    };

    const handleSuggestionClick = (prompt: string) => {
        setInput(prompt);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            formRef.current?.requestSubmit();
        }
    };

    const sendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || isLoading) return;

        const userMessage = input.trim();
        setInput('');
        setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
        setIsLoading(true);

        const controller = new AbortController();
        abortControllerRef.current = controller;

        try {
            const res = await fetch('/api/chat', {
                method: 'POST',
                signal: controller.signal,
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
            if (error instanceof Error && error.name === 'AbortError') {
                return;
            }
            setMessages(prev => [
                ...prev,
                { role: 'assistant', content: `Error: ${error instanceof Error ? error.message : 'Unable to contact the chat server. Please try again.'}` },
            ]);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex flex-col h-full bg-gray-50 overflow-hidden font-sans">
            {/* Minimal App Header */}
            <header className="h-14 shrink-0 border-b border-gray-200 bg-white px-4 sm:px-6 flex items-center justify-between z-10">
                <div className="flex items-center space-x-3">
                    <Link href="/" className="flex items-center space-x-2 group">
                        <div className="flex items-center justify-center w-8 h-8 group-hover:scale-105 transition-transform">
                            <Image
                                src="/gmr-logo.png"
                                alt="Global Moto Rentals Logo"
                                width={32}
                                height={32}
                                className="w-full h-full object-contain"
                                priority
                            />
                        </div>
                        <span className="font-semibold text-gray-900 text-sm sm:text-base hidden sm:inline">Global Moto Rentals</span>
                    </Link>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                        Beta
                    </span>
                </div>

                <div className="flex items-center space-x-2">
                    <button
                        type="button"
                        onClick={handleNewChat}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs sm:text-sm font-medium text-gray-700 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors cursor-pointer"
                        title="Start a new chat session"
                    >
                        <PlusIcon className="w-4 h-4" />
                        <span>New Chat</span>
                    </button>

                    <Link
                        href="/"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs sm:text-sm font-medium text-gray-600 hover:text-blue-600 hover:bg-gray-50 rounded-lg transition-colors"
                    >
                        <ArrowLeftIcon className="w-4 h-4" />
                        <span className="hidden sm:inline">Back to Fleet</span>
                        <span className="sm:hidden">Fleet</span>
                    </Link>
                </div>
            </header>

            {/* Centered Message Canvas */}
            <div className="flex-1 overflow-y-auto px-4 py-6">
                <div className="max-w-3xl mx-auto w-full space-y-6">
                    {messages.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-12 text-gray-500 space-y-6">
                            <div className="text-center">
                                <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Motorcycle Rental Assistant (Beta)</h1>
                                <p className="mt-2 text-sm text-gray-600">Find motorcycles, compare rental shops, and explore rental options.</p>
                            </div>
                            <div className="w-full max-w-lg space-y-3">
                                <p className="font-medium text-sm text-gray-700 text-center">Try asking:</p>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-center text-sm">
                                    <button
                                        type="button"
                                        className="bg-white px-4 py-2.5 rounded-xl shadow-sm border border-gray-200 text-gray-700 hover:border-blue-300 hover:text-blue-600 hover:bg-blue-50/50 transition-colors text-left cursor-pointer"
                                        onClick={() => handleSuggestionClick('Find scooters in Bangkok')}
                                    >
                                        &quot;Find scooters in Bangkok&quot;
                                    </button>
                                    <button
                                        type="button"
                                        className="bg-white px-4 py-2.5 rounded-xl shadow-sm border border-gray-200 text-gray-700 hover:border-blue-300 hover:text-blue-600 hover:bg-blue-50/50 transition-colors text-left cursor-pointer"
                                        onClick={() => handleSuggestionClick('List adventure bikes in Chiang Mai')}
                                    >
                                        &quot;List adventure bikes in Chiang Mai&quot;
                                    </button>
                                    <button
                                        type="button"
                                        className="bg-white px-4 py-2.5 rounded-xl shadow-sm border border-gray-200 text-gray-700 hover:border-blue-300 hover:text-blue-600 hover:bg-blue-50/50 transition-colors text-left cursor-pointer"
                                        onClick={() => handleSuggestionClick('What brands are available?')}
                                    >
                                        &quot;What brands are available?&quot;
                                    </button>
                                    <button
                                        type="button"
                                        className="bg-white px-4 py-2.5 rounded-xl shadow-sm border border-gray-200 text-gray-700 hover:border-blue-300 hover:text-blue-600 hover:bg-blue-50/50 transition-colors text-left cursor-pointer"
                                        onClick={() => handleSuggestionClick('Show me shops in Phuket')}
                                    >
                                        &quot;Show me shops in Phuket&quot;
                                    </button>
                                </div>
                            </div>
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
                    <div ref={messagesEndRef} />
                </div>
            </div>

            {/* Pinned Bottom Prompt Bar */}
            <div className="shrink-0 p-4 bg-white/95 backdrop-blur border-t border-gray-200 shadow-sm">
                <form ref={formRef} onSubmit={sendMessage} className="max-w-3xl mx-auto">
                    <div className="flex gap-3 items-end">
                        <textarea
                            rows={1}
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="Ask about motorcycles, shops, or locations..."
                            className="flex-1 px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all shadow-inner resize-none min-h-[48px] max-h-36 leading-normal"
                            disabled={isLoading}
                        />
                        <button 
                            type="submit" 
                            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl transition-colors shadow-sm disabled:opacity-60 disabled:cursor-not-allowed flex items-center h-[48px] cursor-pointer"
                            disabled={isLoading || !input.trim()}
                        >
                            {isLoading ? '...' : (
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                                    <path d="M3.478 2.404a.75.75 0 00-.926.941l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.404z" />
                                </svg>
                            )}
                        </button>
                    </div>
                    <p className="text-[11px] text-gray-400 text-center mt-2">
                        Assistant can make mistakes. Verify rental terms and prices directly with shops.
                    </p>
                </form>
            </div>
        </div>
    );
}
