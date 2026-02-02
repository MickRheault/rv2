'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import './markdown.css';

const SECRET = 'd4fre320X';

interface Message {
    role: 'user' | 'assistant';
    content: string;
    toolCalls?: { name: string; args: string; result: string }[];
}

export default function ChatTestPage() {
    const searchParams = useSearchParams();
    const secret = searchParams.get('secret');

    // Hooks must be called unconditionally (before any returns)
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    // Block access if secret is wrong
    if (secret !== SECRET) {
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
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: userMessage }),
            });

            const data = await res.json();

            if (data.error) {
                setMessages(prev => [
                    ...prev,
                    { role: 'assistant', content: `Error: ${data.error}` },
                ]);
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
                { role: 'assistant', content: `Error: ${error}` },
            ]);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div style={styles.container}>
            <header style={styles.header}>
                <h1 style={styles.title}>🏍️ MCP Chat Test</h1>
                <p style={styles.subtitle}>Test the motorcycle rental AI assistant</p>
            </header>

            <div style={styles.chatContainer}>
                <div style={styles.messages}>
                    {messages.length === 0 && (
                        <div style={styles.emptyState}>
                            <p>Try asking:</p>
                            <ul style={styles.suggestions}>
                                <li>&quot;Find scooters in Bangkok&quot;</li>
                                <li>&quot;List adventure bikes in Chiang Mai&quot;</li>
                                <li>&quot;What brands are available?&quot;</li>
                                <li>&quot;Show me shops in Phuket&quot;</li>
                            </ul>
                        </div>
                    )}

                    {messages.map((msg, i) => (
                        <div
                            key={i}
                            style={{
                                ...styles.message,
                                ...(msg.role === 'user' ? styles.userMessage : styles.assistantMessage),
                            }}
                        >
                            <div style={styles.messageRole}>
                                {msg.role === 'user' ? '👤 You' : '🤖 Assistant'}
                            </div>
                            {msg.role === 'user' ? (
                                <div style={styles.messageContent}>{msg.content}</div>
                            ) : (
                                <div className="markdown-content">
                                    <ReactMarkdown
                                        components={{
                                            a: ({ href, children }) => (
                                                <a href={href} target="_blank" rel="noopener noreferrer">
                                                    {children}
                                                </a>
                                            ),
                                        }}
                                    >
                                        {msg.content}
                                    </ReactMarkdown>
                                </div>
                            )}

                            {msg.toolCalls && msg.toolCalls.length > 0 && (
                                <details style={styles.toolCalls}>
                                    <summary style={styles.toolSummary}>
                                        🔧 Tool calls ({msg.toolCalls.length})
                                    </summary>
                                    {msg.toolCalls.map((tc, j) => (
                                        <div key={j} style={styles.toolCall}>
                                            <div style={styles.toolName}>{tc.name}</div>
                                            <pre style={styles.toolArgs}>{tc.args}</pre>
                                            <pre style={styles.toolResult}>{tc.result}</pre>
                                        </div>
                                    ))}
                                </details>
                            )}
                        </div>
                    ))}

                    {isLoading && (
                        <div style={{ ...styles.message, ...styles.assistantMessage }}>
                            <div style={styles.messageRole}>🤖 Assistant</div>
                            <div style={styles.loading}>Thinking...</div>
                        </div>
                    )}

                </div>

                <form onSubmit={sendMessage} style={styles.inputForm}>
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="Ask about motorcycles, shops, or locations..."
                        style={styles.input}
                        disabled={isLoading}
                    />
                    <button type="submit" style={styles.button} disabled={isLoading}>
                        {isLoading ? '...' : 'Send'}
                    </button>
                </form>
            </div>
        </div>
    );
}

const styles: { [key: string]: React.CSSProperties } = {
    container: {
        minHeight: '100vh',
        backgroundColor: '#0a0a0a',
        color: '#fff',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: 'system-ui, -apple-system, sans-serif',
    },
    header: {
        padding: '20px',
        borderBottom: '1px solid #333',
        textAlign: 'center',
    },
    title: {
        margin: 0,
        fontSize: '24px',
        fontWeight: 600,
    },
    subtitle: {
        margin: '5px 0 0',
        color: '#888',
        fontSize: '14px',
    },
    chatContainer: {
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        maxWidth: '800px',
        width: '100%',
        margin: '0 auto',
        padding: '20px',
    },
    messages: {
        flex: 1,
        overflowY: 'auto',
        marginBottom: '20px',
    },
    emptyState: {
        textAlign: 'center',
        color: '#666',
        marginTop: '40px',
    },
    suggestions: {
        listStyle: 'none',
        padding: 0,
        marginTop: '10px',
    },
    message: {
        marginBottom: '16px',
        padding: '12px 16px',
        borderRadius: '12px',
        maxWidth: '85%',
    },
    userMessage: {
        backgroundColor: '#1a3a5c',
        marginLeft: 'auto',
    },
    assistantMessage: {
        backgroundColor: '#1a1a1a',
        border: '1px solid #333',
    },
    messageRole: {
        fontSize: '12px',
        color: '#888',
        marginBottom: '6px',
    },
    messageContent: {
        whiteSpace: 'pre-wrap',
        lineHeight: 1.5,
    },
    loading: {
        color: '#888',
        fontStyle: 'italic',
    },
    toolCalls: {
        marginTop: '12px',
        fontSize: '12px',
        color: '#888',
    },
    toolSummary: {
        cursor: 'pointer',
        padding: '4px 0',
    },
    toolCall: {
        marginTop: '8px',
        padding: '8px',
        backgroundColor: '#0a0a0a',
        borderRadius: '6px',
    },
    toolName: {
        color: '#4ade80',
        fontWeight: 600,
        marginBottom: '4px',
    },
    toolArgs: {
        margin: '4px 0',
        padding: '6px',
        backgroundColor: '#111',
        borderRadius: '4px',
        overflow: 'auto',
        fontSize: '11px',
    },
    toolResult: {
        margin: '4px 0',
        padding: '6px',
        backgroundColor: '#111',
        borderRadius: '4px',
        overflow: 'auto',
        fontSize: '11px',
        maxHeight: '200px',
    },
    inputForm: {
        display: 'flex',
        gap: '10px',
    },
    input: {
        flex: 1,
        padding: '14px 18px',
        borderRadius: '12px',
        border: '1px solid #333',
        backgroundColor: '#111',
        color: '#fff',
        fontSize: '16px',
        outline: 'none',
    },
    button: {
        padding: '14px 28px',
        borderRadius: '12px',
        border: 'none',
        backgroundColor: '#3b82f6',
        color: '#fff',
        fontWeight: 600,
        cursor: 'pointer',
        fontSize: '16px',
    },
};
