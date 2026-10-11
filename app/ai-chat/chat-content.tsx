'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useSearchParams } from 'next/navigation';
import { 
    ArrowLeftIcon, 
    PlusIcon, 
    Bars3Icon, 
    XMarkIcon, 
    MapPinIcon, 
    ShieldCheckIcon, 
    SparklesIcon 
} from '@heroicons/react/24/outline';
import ReactMarkdown from 'react-markdown';
import './markdown.css';

interface Message {
    role: 'user' | 'assistant';
    content: string;
    toolCalls?: { name: string; args: string; result: string }[];
}

const SUGGESTION_PROMPTS = [
    'Find scooters in Bangkok',
    'List adventure bikes in Chiang Mai',
    'What brands are available?',
    'Show me shops in Phuket',
] as const;

const QUICK_CITY_LINKS = [
    { name: 'Bangkok, Thailand', city: 'Bangkok', href: '/thailand/bangkok', flag: '🇹🇭' },
    { name: 'Phuket, Thailand', city: 'Phuket', href: '/thailand/phuket', flag: '🇹🇭' },
    { name: 'Chiang Mai, Thailand', city: 'Chiang Mai', href: '/thailand/chiang-mai', flag: '🇹🇭' },
    { name: 'Bali, Indonesia', city: 'Bali', href: '/indonesia/bali', flag: '🇮🇩' },
] as const;

const RIDING_GUIDES = [
    {
        title: 'IDP & License Requirements',
        summary: '1949 or 1968 International Driving Permit with motorcycle endorsement required.',
        prompt: 'What license do I need to rent a motorcycle in Thailand and Bali?',
    },
    {
        title: 'Helmet Laws & Safety',
        summary: 'Helmets mandatory for rider & passenger. Strict traffic police checkpoints.',
        prompt: 'What are the helmet and traffic enforcement rules for tourists?',
    },
    {
        title: 'Insurance & Damage Coverage',
        summary: 'Basic insurance included; ask shops about comprehensive CDW coverage.',
        prompt: 'How does motorcycle rental insurance and damage deposit work?',
    },
] as const;

const SIDEBAR_PROMPT_CHIPS = [
    'Scooters under $15/day in Bangkok',
    'Best adventure bikes in Chiang Mai',
    'Automatic scooters in Bali',
    'Big bikes available in Phuket',
] as const;

export default function ChatContent({ accessRequired }: { accessRequired: boolean }) {
    const searchParams = useSearchParams();
    const secret = searchParams.get('secret');

    // Hooks must be called unconditionally (before any returns)
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    const formRef = useRef<HTMLFormElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const abortControllerRef = useRef<AbortController | null>(null);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView?.({ behavior: 'smooth' });
    }, [messages, isLoading]);

    // Abort any in-flight request when component unmounts
    useEffect(() => {
        return () => {
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }
        };
    }, []);

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
        textareaRef.current?.focus();
    };

    const handlePromptSelect = (promptText: string) => {
        setInput(promptText);
        textareaRef.current?.focus();
        if (typeof window !== 'undefined' && window.innerWidth < 768) {
            setIsSidebarOpen(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        const isComposing = e.nativeEvent.isComposing;
        if (e.key === 'Enter' && !e.shiftKey && !isComposing) {
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
            <header className="h-14 shrink-0 border-b border-gray-200 bg-white px-4 sm:px-6 flex items-center justify-between z-20">
                <div className="flex items-center space-x-3">
                    <button
                        type="button"
                        onClick={() => setIsSidebarOpen(prev => !prev)}
                        className="p-1.5 -ml-1 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
                        aria-label="Toggle sidebar"
                        aria-expanded={isSidebarOpen}
                        aria-controls="chat-sidebar"
                    >
                        <Bars3Icon className="w-5 h-5" />
                    </button>

                    <Link href="/" className="flex items-center space-x-2 group" aria-label="Global Moto Rentals Home">
                        <div className="flex items-center justify-center w-8 h-8 group-hover:scale-105 transition-transform">
                            <Image
                                src="/gmr-logo.png"
                                alt="Global Moto Rentals Logo"
                                width={32}
                                height={32}
                                className="w-full h-full object-contain"
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
                        aria-label="New Chat"
                    >
                        <PlusIcon className="w-4 h-4" />
                        <span>New Chat</span>
                    </button>

                    <Link
                        href="/"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs sm:text-sm font-medium text-gray-600 hover:text-blue-600 hover:bg-gray-50 rounded-lg transition-colors"
                        aria-label="Back"
                    >
                        <ArrowLeftIcon className="w-4 h-4" />
                        <span className="inline">Back</span>
                    </Link>
                </div>
            </header>

            {/* Body: Sidebar + Message Canvas */}
            <div className="flex-1 flex min-h-0 overflow-hidden relative">
                {/* Mobile Slide-Over Backdrop */}
                {isSidebarOpen && (
                    <div
                        className="fixed inset-0 bg-black/40 z-30 md:hidden transition-opacity"
                        onClick={() => setIsSidebarOpen(false)}
                        aria-hidden="true"
                        data-testid="sidebar-backdrop"
                    />
                )}

                {/* Collapsible Resource Sidebar */}
                <aside
                    id="chat-sidebar"
                    aria-label="Rental Resources and Quick Links"
                    className={`
                        fixed inset-y-0 left-0 z-40 md:static md:z-auto
                        w-[260px] shrink-0 bg-white border-r border-gray-200
                        flex flex-col h-full transition-all duration-300 ease-in-out shadow-lg md:shadow-none
                        ${isSidebarOpen 
                            ? 'translate-x-0 md:w-[260px] md:opacity-100' 
                            : '-translate-x-full md:w-0 md:opacity-0 md:overflow-hidden md:border-r-0'
                        }
                    `}
                >
                    {/* Sidebar Header / Mobile Close */}
                    <div className="h-14 shrink-0 px-4 border-b border-gray-100 flex items-center justify-between">
                        <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                            <SparklesIcon className="w-4 h-4 text-blue-600" />
                            <span>Rental Resources</span>
                        </div>
                        <button
                            type="button"
                            onClick={() => setIsSidebarOpen(false)}
                            className="p-1 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg md:hidden cursor-pointer"
                            aria-label="Close sidebar"
                        >
                            <XMarkIcon className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Scrollable Sidebar Content */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-6 text-sm">
                        {/* Direct City Links */}
                        <div>
                            <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2.5 flex items-center gap-1.5">
                                <MapPinIcon className="w-3.5 h-3.5 text-gray-500" />
                                <span>Top Rental Cities</span>
                            </h2>
                            <nav aria-label="Top rental cities" className="space-y-1">
                                {QUICK_CITY_LINKS.map((city) => (
                                    <Link
                                        key={city.city}
                                        href={city.href}
                                        className="flex items-center justify-between px-3 py-2 rounded-lg text-gray-700 hover:text-blue-600 hover:bg-blue-50/60 transition-colors group"
                                    >
                                        <span className="font-medium text-xs sm:text-sm">{city.city}</span>
                                        <span className="text-xs opacity-75 group-hover:translate-x-0.5 transition-transform">
                                            {city.flag} →
                                        </span>
                                    </Link>
                                ))}
                            </nav>
                        </div>

                        {/* Riding Guides & Requirements */}
                        <div>
                            <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2.5 flex items-center gap-1.5">
                                <ShieldCheckIcon className="w-3.5 h-3.5 text-gray-500" />
                                <span>Riding Guides</span>
                            </h2>
                            <div className="space-y-2.5">
                                {RIDING_GUIDES.map((guide) => (
                                    <div
                                        key={guide.title}
                                        className="p-2.5 bg-gray-50 rounded-xl border border-gray-100 space-y-1.5"
                                    >
                                        <div className="font-semibold text-xs text-gray-900">{guide.title}</div>
                                        <p className="text-[11px] text-gray-600 leading-relaxed">{guide.summary}</p>
                                        <button
                                            type="button"
                                            onClick={() => handlePromptSelect(guide.prompt)}
                                            className="text-[11px] font-medium text-blue-600 hover:text-blue-800 hover:underline text-left cursor-pointer"
                                        >
                                            Ask assistant →
                                        </button>
                                    </div>
                                ))}
                                <Link
                                    href="/safety"
                                    className="inline-flex items-center gap-1 text-xs font-medium text-gray-600 hover:text-blue-600 pt-1"
                                >
                                    <span>Full Safety Tips</span>
                                    <span>→</span>
                                </Link>
                            </div>
                        </div>

                        {/* Quick Question Chips */}
                        <div>
                            <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2.5">
                                Quick Questions
                            </h2>
                            <div className="space-y-1.5">
                                {SIDEBAR_PROMPT_CHIPS.map((chip) => (
                                    <button
                                        key={chip}
                                        type="button"
                                        onClick={() => handlePromptSelect(chip)}
                                        className="w-full text-left px-3 py-2 text-xs text-gray-700 bg-white border border-gray-200 rounded-lg hover:border-blue-300 hover:text-blue-600 hover:bg-blue-50/50 transition-colors shadow-2xs cursor-pointer"
                                    >
                                        &quot;{chip}&quot;
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </aside>

                {/* Main Chat Experience */}
                <main className="flex-1 flex flex-col min-h-0 overflow-hidden">
                    {/* Centered Message Canvas */}
                    <div 
                        className="flex-1 overflow-y-auto px-4 py-6"
                        role="log"
                        aria-live="polite"
                        aria-label="Conversation history"
                    >
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
                                        {SUGGESTION_PROMPTS.map((prompt) => (
                                            <button
                                                key={prompt}
                                                type="button"
                                                className="bg-white px-4 py-2.5 rounded-xl shadow-sm border border-gray-200 text-gray-700 hover:border-blue-300 hover:text-blue-600 hover:bg-blue-50/50 transition-colors text-left cursor-pointer"
                                                onClick={() => handleSuggestionClick(prompt)}
                                            >
                                                &quot;{prompt}&quot;
                                            </button>
                                        ))}
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
                                ref={textareaRef}
                                rows={1}
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder="Ask about motorcycles, shops, or locations..."
                                aria-label="Ask about motorcycles, shops, or locations..."
                                className="flex-1 px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all shadow-inner resize-none min-h-[48px] max-h-36 leading-normal"
                                disabled={isLoading}
                            />
                            <button 
                                type="submit" 
                                aria-label="Send message"
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
                    </form>
                </div>
            </main>
        </div>
    </div>
);
}
