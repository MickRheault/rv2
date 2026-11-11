import { StrictMode } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useSearchParams } from 'next/navigation';
import ChatPage from './page';
import { AI_CHAT_LOADING_INTERVAL_MS } from '@/lib/chat/suggestions';

const originalSecret = process.env.AI_CHAT_ACCESS_SECRET;

jest.mock('react-markdown', () => ({
    __esModule: true,
    default: ({
        children,
        components,
    }: {
        children: React.ReactNode;
        components?: { a?: React.ComponentType<{ href?: string; children?: React.ReactNode }> };
    }) => {
        if (typeof children !== 'string') return <div>{children}</div>;
        const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
        const parts: React.ReactNode[] = [];
        let lastIndex = 0;
        let match: RegExpExecArray | null;
        while ((match = linkRegex.exec(children)) !== null) {
            if (match.index > lastIndex) {
                parts.push(children.slice(lastIndex, match.index));
            }
            const [, label, href] = match;
            const Anchor = components?.a;
            parts.push(
                Anchor ? (
                    <Anchor key={match.index} href={href}>
                        {label}
                    </Anchor>
                ) : (
                    <a key={match.index} href={href}>
                        {label}
                    </a>
                )
            );
            lastIndex = match.index + match[0].length;
        }
        if (lastIndex < children.length) {
            parts.push(children.slice(lastIndex));
        }
        return <div>{parts.length > 0 ? parts : children}</div>;
    },
}));
jest.mock('next/navigation', () => ({ useSearchParams: jest.fn() }));

beforeEach(() => {
    process.env.AI_CHAT_ACCESS_SECRET = 'test-only-server-access-code';
    jest.mocked(useSearchParams).mockReturnValue(new URLSearchParams({
        secret: 'test-only-user-supplied-access-code',
    }) as ReturnType<typeof useSearchParams>);
    jest.mocked(fetch).mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ response: 'Here are some scooters.' }),
    } as Response);
});

afterAll(() => {
    if (originalSecret === undefined) delete process.env.AI_CHAT_ACCESS_SECRET;
    else process.env.AI_CHAT_ACCESS_SECRET = originalSecret;
});

it.each([undefined, '', '   '])('renders usable public chat without an access code when the secret is %s', async secret => {
    if (secret === undefined) delete process.env.AI_CHAT_ACCESS_SECRET;
    else process.env.AI_CHAT_ACCESS_SECRET = secret;
    jest.mocked(useSearchParams).mockReturnValue(new URLSearchParams() as ReturnType<typeof useSearchParams>);
    const { container } = render(<ChatPage />);
    expect(screen.getByRole('heading', { level: 1, name: 'Motorcycle Rental Assistant (Beta)' })).toBeInTheDocument();
    expect(screen.getByText('Find motorcycles, compare rental shops, and explore rental options.')).toBeInTheDocument();
    expect(screen.queryByText('Access denied')).not.toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText('Ask about bikes or shops...'), {
        target: { value: 'Find scooters in Bangkok' },
    });
    fireEvent.submit(container.querySelector('form')!);
    await waitFor(() => expect(fetch).toHaveBeenCalledWith('/api/chat', expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'Find scooters in Bangkok', conversationHistory: [] }),
    })));
    expect(await screen.findByText('Here are some scooters.')).toBeInTheDocument();
});

it('allows old access-code links in public mode without sending their credentials', async () => {
    delete process.env.AI_CHAT_ACCESS_SECRET;
    const { container } = render(<ChatPage />);
    fireEvent.change(screen.getByPlaceholderText('Ask about bikes or shops...'), {
        target: { value: 'Find scooters in Bangkok' },
    });
    fireEvent.submit(container.querySelector('form')!);
    await waitFor(() => expect(fetch).toHaveBeenCalledWith('/api/chat', expect.objectContaining({
        headers: { 'Content-Type': 'application/json' },
    })));
    expect(await screen.findByText('Here are some scooters.')).toBeInTheDocument();
});

it('reads the current mode on each server render', () => {
    jest.mocked(useSearchParams).mockReturnValue(new URLSearchParams() as ReturnType<typeof useSearchParams>);
    delete process.env.AI_CHAT_ACCESS_SECRET;
    const { rerender } = render(<ChatPage />);
    expect(screen.queryByText('Access denied')).not.toBeInTheDocument();
    process.env.AI_CHAT_ACCESS_SECRET = 'new-server-access-code';
    rerender(<ChatPage />);
    expect(screen.getByText('Access denied')).toBeInTheDocument();
    delete process.env.AI_CHAT_ACCESS_SECRET;
    rerender(<ChatPage />);
    expect(screen.queryByText('Access denied')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Motorcycle Rental Assistant (Beta)' })).toBeInTheDocument();
});

it.each([
    [500, '', 'The chat server returned an unexpected response (HTTP 500). Please try again.'],
    [502, '<html>Bad Gateway</html>', 'The chat server returned an unexpected response (HTTP 502). Please try again.'],
    [200, 'null', 'The chat server returned an unexpected response (HTTP 200). Please try again.'],
    [401, JSON.stringify({ error: 'Access denied' }), 'Access denied'],
    [503, JSON.stringify({ error: 'OpenAI API credits are exhausted.' }), 'OpenAI API credits are exhausted.'],
])('handles HTTP %s responses without exposing a JSON parsing error', async (status, body, message) => {
    jest.mocked(fetch).mockResolvedValue({ ok: status === 200, status, text: async () => body } as Response);
    const { container } = render(<ChatPage />);
    fireEvent.change(screen.getByPlaceholderText('Ask about bikes or shops...'), {
        target: { value: 'Find CRF rentals in Thailand' },
    });
    fireEvent.submit(container.querySelector('form')!);
    expect(await screen.findByText(`Error: ${message}`)).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Ask about bikes or shops...')).toBeEnabled();
});

it('sends the user-supplied access code with the chat request', async () => {
    const { container } = render(<ChatPage />);
    fireEvent.change(screen.getByPlaceholderText('Ask about bikes or shops...'), {
        target: { value: 'Find scooters in Bangkok' },
    });
    fireEvent.submit(container.querySelector('form')!);
    await waitFor(() => expect(fetch).toHaveBeenCalledWith('/api/chat', expect.objectContaining({
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer test-only-user-supplied-access-code',
        },
        body: JSON.stringify({ message: 'Find scooters in Bangkok', conversationHistory: [] }),
    })));
    expect(await screen.findByText('Here are some scooters.')).toBeInTheDocument();
});

it('does not show the chat or make a request when no access code was supplied', () => {
    jest.mocked(useSearchParams).mockReturnValue(new URLSearchParams() as ReturnType<typeof useSearchParams>);
    render(<ChatPage />);
    expect(screen.getByText('Access denied')).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
});

it('shows a useful error when the chat server returns an empty response', async () => {
    jest.mocked(fetch).mockResolvedValue({
        ok: false,
        status: 504,
        text: async () => '',
    } as Response);
    const { container } = render(<ChatPage />);
    fireEvent.change(screen.getByPlaceholderText('Ask about bikes or shops...'), {
        target: { value: 'where can i rent CRF (any models) in thailand' },
    });
    fireEvent.submit(container.querySelector('form')!);
    expect(await screen.findByText('Error: The chat request timed out. Please try again.')).toBeInTheDocument();
});

it('renders the minimal top navigation bar with back link, logo, Beta badge, and New Chat button', () => {
    delete process.env.AI_CHAT_ACCESS_SECRET;
    render(<ChatPage />);
    expect(screen.getByRole('link', { name: /^Back$/i })).toHaveAttribute('href', '/');
    expect(screen.getByRole('button', { name: /New Chat/i })).toBeInTheDocument();
    expect(screen.getByText('Beta')).toBeInTheDocument();
    expect(screen.getByAltText('Global Moto Rentals Logo')).toBeInTheDocument();
});

it('resets conversation and restores prompt suggestions when New Chat is clicked', async () => {
    delete process.env.AI_CHAT_ACCESS_SECRET;
    const { container } = render(<ChatPage />);
    fireEvent.change(screen.getByPlaceholderText('Ask about bikes or shops...'), {
        target: { value: 'Find scooters in Bangkok' },
    });
    fireEvent.submit(container.querySelector('form')!);
    expect(await screen.findByText('Here are some scooters.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /New Chat/i }));

    expect(screen.queryByText('Here are some scooters.')).not.toBeInTheDocument();
    expect(screen.getByText(/Find scooters in Bangkok/)).toBeInTheDocument();
});

it('submits on Enter keypress and allows newline on Shift+Enter', async () => {
    delete process.env.AI_CHAT_ACCESS_SECRET;
    render(<ChatPage />);
    const textarea = screen.getByPlaceholderText('Ask about bikes or shops...');
    
    // Shift+Enter does not submit
    fireEvent.change(textarea, { target: { value: 'First line' } });
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: true });
    expect(fetch).not.toHaveBeenCalled();

    // Enter without Shift submits
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false });
    await waitFor(() => expect(fetch).toHaveBeenCalledWith('/api/chat', expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ message: 'First line', conversationHistory: [] }),
    })));
});

it('does not submit on Enter when IME is actively composing (e.g. Thai/Japanese input)', () => {
    delete process.env.AI_CHAT_ACCESS_SECRET;
    render(<ChatPage />);
    const textarea = screen.getByPlaceholderText('Ask about bikes or shops...');
    fireEvent.change(textarea, { target: { value: 'มอเตอร์ไซค์' } });
    
    // Simulate IME composition selection
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false, isComposing: true, nativeEvent: { isComposing: true } });
    expect(fetch).not.toHaveBeenCalled();
});

it('aborts active in-flight request when New Chat is clicked', async () => {
    delete process.env.AI_CHAT_ACCESS_SECRET;
    let signalCaptured: AbortSignal | undefined;
    jest.mocked(fetch).mockImplementation((_url, init) => {
        signalCaptured = (init as RequestInit)?.signal as AbortSignal;
        return new Promise(() => {}); // never resolves to keep in flight
    });

    const { container } = render(<ChatPage />);
    fireEvent.change(screen.getByPlaceholderText('Ask about bikes or shops...'), {
        target: { value: 'Find scooters' },
    });
    fireEvent.submit(container.querySelector('form')!);

    expect(signalCaptured).toBeDefined();
    expect(signalCaptured?.aborted).toBe(false);

    fireEvent.click(screen.getByRole('button', { name: /New Chat/i }));

    expect(signalCaptured?.aborted).toBe(true);
});

it('provides accessible labels for input and live region for message history', () => {
    delete process.env.AI_CHAT_ACCESS_SECRET;
    render(<ChatPage />);
    expect(screen.getByRole('log', { name: /Conversation history/i })).toHaveAttribute('aria-live', 'polite');
    expect(screen.getByRole('button', { name: 'Send message' })).toBeInTheDocument();
    expect(screen.getByLabelText('Ask about bikes or shops...')).toBeInTheDocument();
});

it('automatically sends the initial prompt from the ?q= query parameter once on load and clears on New Chat without re-sending', async () => {
    delete process.env.AI_CHAT_ACCESS_SECRET;
    jest.mocked(useSearchParams).mockReturnValue(new URLSearchParams({
        q: 'Find scooters in Bangkok',
    }) as ReturnType<typeof useSearchParams>);

    const { rerender } = render(<ChatPage />);

    expect(await screen.findByText('Find scooters in Bangkok')).toBeInTheDocument();
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    expect(fetch).toHaveBeenCalledWith('/api/chat', expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'Find scooters in Bangkok', conversationHistory: [] }),
    }));
    expect(await screen.findByText('Here are some scooters.')).toBeInTheDocument();

    // Re-rendering with the same searchParams should not re-send the initial query
    rerender(<ChatPage />);
    expect(fetch).toHaveBeenCalledTimes(1);

    // Clicking New Chat clears the conversation and does not re-send ?q=
    fireEvent.click(screen.getByRole('button', { name: /New Chat/i }));
    expect(screen.queryByText('Here are some scooters.')).not.toBeInTheDocument();
    expect(fetch).toHaveBeenCalledTimes(1);
});

it('does not auto-send the ?q= query parameter when accessRequired is true and no secret is provided', () => {
    process.env.AI_CHAT_ACCESS_SECRET = 'test-only-server-access-code';
    jest.mocked(useSearchParams).mockReturnValue(new URLSearchParams({
        q: 'Find scooters in Bangkok',
    }) as ReturnType<typeof useSearchParams>);

    render(<ChatPage />);

    expect(screen.getByText('Access denied')).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
});

it('completes the ?q= initial query under React StrictMode without losing the response or duplicating the user message', async () => {
    delete process.env.AI_CHAT_ACCESS_SECRET;
    jest.mocked(useSearchParams).mockReturnValue(new URLSearchParams({
        q: 'Find scooters in Bangkok',
    }) as ReturnType<typeof useSearchParams>);

    jest.mocked(fetch).mockImplementation((_url, init) => {
        const signal = (init as RequestInit)?.signal as AbortSignal | undefined;
        return new Promise((resolve, reject) => {
            if (signal?.aborted) {
                const abortErr = new Error('The operation was aborted.');
                abortErr.name = 'AbortError';
                reject(abortErr);
                return;
            }
            signal?.addEventListener('abort', () => {
                const abortErr = new Error('The operation was aborted.');
                abortErr.name = 'AbortError';
                reject(abortErr);
            });
            setTimeout(() => {
                resolve({
                    ok: true,
                    status: 200,
                    text: async () => JSON.stringify({ response: 'Here are some scooters.' }),
                } as Response);
            }, 10);
        });
    });

    render(
        <StrictMode>
            <ChatPage />
        </StrictMode>
    );

    expect(await screen.findByText('Here are some scooters.')).toBeInTheDocument();
    expect(screen.getAllByText('Find scooters in Bangkok')).toHaveLength(1);
});

it('normalizes hallucinated or absolute domains on /motorcycle/ and /shop/ links to relative paths while preserving genuine external links', async () => {
    delete process.env.AI_CHAT_ACCESS_SECRET;
    jest.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () =>
            JSON.stringify({
                response:
                    '1. [Honda PCX 160](https://www.globalmoto.com/motorcycle/474ae1b4-c952-42ef-b5d3-b84ef9020898) - Shop: [Mike Rentals](https://www.globalmoto.com/shop/thailand/bangkok/mikes-rentals) - [Tourism Info](https://www.tourismthailand.org/articles)',
            }),
    } as Response);

    const { container } = render(<ChatPage />);
    fireEvent.change(screen.getByPlaceholderText('Ask about bikes or shops...'), {
        target: { value: 'Show me Honda PCX in Bangkok' },
    });
    fireEvent.submit(container.querySelector('form')!);

    const bikeLink = await screen.findByRole('link', { name: 'Honda PCX 160' });
    expect(bikeLink).toHaveAttribute('href', '/motorcycle/474ae1b4-c952-42ef-b5d3-b84ef9020898');

    const shopLink = screen.getByRole('link', { name: 'Mike Rentals' });
    expect(shopLink).toHaveAttribute('href', '/shop/thailand/bangkok/mikes-rentals');

    const externalLink = screen.getByRole('link', { name: 'Tourism Info' });
    expect(externalLink).toHaveAttribute('href', 'https://www.tourismthailand.org/articles');
});

it('displays playful motorcycle-themed rotating status messages while searching and resets when finished', async () => {
    jest.useFakeTimers();
    try {
        delete process.env.AI_CHAT_ACCESS_SECRET;

        let resolveFirstFetch!: (value: Response) => void;
        let resolveSecondFetch!: (value: Response) => void;

        jest.mocked(fetch)
            .mockImplementationOnce(
                () =>
                    new Promise<Response>((resolve) => {
                        resolveFirstFetch = resolve;
                    })
            )
            .mockImplementationOnce(
                () =>
                    new Promise<Response>((resolve) => {
                        resolveSecondFetch = resolve;
                    })
            );

        const { container } = render(<ChatPage />);
        const textarea = screen.getByPlaceholderText('Ask about bikes or shops...');
        const form = container.querySelector('form')!;

        fireEvent.change(textarea, { target: { value: 'Find scooters in Bangkok' } });
        fireEvent.submit(form);

        // Initial loading message appears immediately
        expect(screen.getByText('Kickstarting the engine...')).toBeInTheDocument();

        // Advance 2.2s -> 2nd message
        act(() => {
            jest.advanceTimersByTime(AI_CHAT_LOADING_INTERVAL_MS);
        });
        expect(screen.getByText('Revving up the search...')).toBeInTheDocument();

        // Advance 2.2s -> 3rd message
        act(() => {
            jest.advanceTimersByTime(AI_CHAT_LOADING_INTERVAL_MS);
        });
        expect(screen.getByText('Scanning the garage...')).toBeInTheDocument();

        // Advance 2.2s -> 4th message
        act(() => {
            jest.advanceTimersByTime(AI_CHAT_LOADING_INTERVAL_MS);
        });
        expect(screen.getByText('Dialing in your answer...')).toBeInTheDocument();

        // Resolve first response -> loading indicator disappears
        await act(async () => {
            resolveFirstFetch({
                ok: true,
                status: 200,
                text: async () => JSON.stringify({ response: 'Found 3 scooters in Bangkok.' }),
            } as Response);
        });

        expect(await screen.findByText('Found 3 scooters in Bangkok.')).toBeInTheDocument();
        expect(screen.queryByText('Dialing in your answer...')).not.toBeInTheDocument();

        // Start a second query -> resets back to the first message
        fireEvent.change(textarea, { target: { value: 'What about Chiang Mai?' } });
        fireEvent.submit(form);
        expect(screen.getByText('Kickstarting the engine...')).toBeInTheDocument();

        await act(async () => {
            resolveSecondFetch({
                ok: true,
                status: 200,
                text: async () => JSON.stringify({ response: 'Found 5 bikes in Chiang Mai.' }),
            } as Response);
        });
        expect(await screen.findByText('Found 5 bikes in Chiang Mai.')).toBeInTheDocument();
    } finally {
        jest.useRealTimers();
    }
});

it('sends prior user and assistant turns in conversationHistory on follow-up messages while excluding the outgoing prompt', async () => {
    delete process.env.AI_CHAT_ACCESS_SECRET;
    jest.mocked(fetch)
        .mockResolvedValueOnce({
            ok: true,
            status: 200,
            text: async () =>
                JSON.stringify({
                    response: 'Riders Corner in Chiang Mai lists the Honda ADV 160.',
                    toolCalls: [{ name: 'list_motorcycles', args: '{"model":"ADV 160"}', result: '{}' }],
                }),
        } as Response)
        .mockResolvedValueOnce({
            ok: true,
            status: 200,
            text: async () => JSON.stringify({ response: 'Riders Corner is open daily 09:00–18:00.' }),
        } as Response)
        .mockResolvedValueOnce({
            ok: true,
            status: 200,
            text: async () => JSON.stringify({ response: 'Here are motorcycles in Rome.' }),
        } as Response);

    const { container } = render(<ChatPage />);
    const textarea = screen.getByPlaceholderText('Ask about bikes or shops...');
    const form = container.querySelector('form')!;

    fireEvent.change(textarea, { target: { value: 'Where can I rent a Honda ADV 160?' } });
    fireEvent.submit(form);
    expect(await screen.findByText('Riders Corner in Chiang Mai lists the Honda ADV 160.')).toBeInTheDocument();

    fireEvent.change(textarea, { target: { value: 'What are their opening hours?' } });
    fireEvent.submit(form);
    expect(await screen.findByText('Riders Corner is open daily 09:00–18:00.')).toBeInTheDocument();

    expect(JSON.parse(String(jest.mocked(fetch).mock.calls[0][1]?.body))).toEqual({
        message: 'Where can I rent a Honda ADV 160?',
        conversationHistory: [],
    });
    expect(JSON.parse(String(jest.mocked(fetch).mock.calls[1][1]?.body))).toEqual({
        message: 'What are their opening hours?',
        conversationHistory: [
            { role: 'user', content: 'Where can I rent a Honda ADV 160?' },
            { role: 'assistant', content: 'Riders Corner in Chiang Mai lists the Honda ADV 160.' },
        ],
    });

    // Clicking New Chat clears conversationHistory for subsequent sessions
    fireEvent.click(screen.getByRole('button', { name: /New Chat/i }));
    fireEvent.change(textarea, { target: { value: 'Motorcycles in Rome' } });
    fireEvent.submit(form);
    expect(await screen.findByText('Here are motorcycles in Rome.')).toBeInTheDocument();

    expect(JSON.parse(String(jest.mocked(fetch).mock.calls[2][1]?.body))).toEqual({
        message: 'Motorcycles in Rome',
        conversationHistory: [],
    });
});

it('excludes both failed user prompts and synthetic client-side error banners from conversationHistory on subsequent turns', async () => {
    delete process.env.AI_CHAT_ACCESS_SECRET;
    jest.mocked(fetch)
        .mockResolvedValueOnce({
            ok: true,
            status: 200,
            text: async () => JSON.stringify({ response: 'They have a Honda ADV 160 and CRF300L.' }),
        } as Response)
        .mockResolvedValueOnce({
            ok: false,
            status: 500,
            text: async () => JSON.stringify({ error: 'Internal server error' }),
        } as Response)
        .mockRejectedValueOnce(new Error('Failed to fetch'))
        .mockResolvedValueOnce({
            ok: true,
            status: 200,
            text: async () => JSON.stringify({ response: 'Open daily 09:00–18:00.' }),
        } as Response);

    const { container } = render(<ChatPage />);
    const textarea = screen.getByPlaceholderText('Ask about bikes or shops...');
    const form = container.querySelector('form')!;

    fireEvent.change(textarea, { target: { value: 'What bikes does Riders Corner have?' } });
    fireEvent.submit(form);
    expect(await screen.findByText('They have a Honda ADV 160 and CRF300L.')).toBeInTheDocument();

    fireEvent.change(textarea, { target: { value: 'What are their opening hours?' } });
    fireEvent.submit(form);
    expect(await screen.findByText('Error: Internal server error')).toBeInTheDocument();

    fireEvent.change(textarea, { target: { value: 'How much is the deposit?' } });
    fireEvent.submit(form);
    expect(await screen.findByText('Error: Failed to fetch')).toBeInTheDocument();

    fireEvent.change(textarea, { target: { value: 'Try opening hours again' } });
    fireEvent.submit(form);
    expect(await screen.findByText('Open daily 09:00–18:00.')).toBeInTheDocument();

    const fourthRequestBody = JSON.parse(String(jest.mocked(fetch).mock.calls[3][1]?.body));
    expect(fourthRequestBody).toEqual({
        message: 'Try opening hours again',
        conversationHistory: [
            { role: 'user', content: 'What bikes does Riders Corner have?' },
            { role: 'assistant', content: 'They have a Honda ADV 160 and CRF300L.' },
        ],
    });
});

it('bounds client-side conversationHistory to the most recent 10 messages and 2500 characters per message', async () => {
    delete process.env.AI_CHAT_ACCESS_SECRET;
    let turn = 0;
    jest.mocked(fetch).mockImplementation(async () => {
        turn += 1;
        const longReply = `Assistant reply ${turn} ` + 'r'.repeat(2800);
        return {
            ok: true,
            status: 200,
            text: async () => JSON.stringify({ response: longReply }),
        } as Response;
    });

    const { container } = render(<ChatPage />);
    const textarea = screen.getByPlaceholderText('Ask about bikes or shops...');
    const form = container.querySelector('form')!;

    // Complete 6 turns (12 messages total), then submit turn 7
    for (let i = 1; i <= 6; i++) {
        fireEvent.change(textarea, { target: { value: `User question ${i}` } });
        fireEvent.submit(form);
        expect(await screen.findByText(new RegExp(`^Assistant reply ${i} `))).toBeInTheDocument();
    }

    fireEvent.change(textarea, { target: { value: 'User question 7' } });
    fireEvent.submit(form);
    expect(await screen.findByText(/^Assistant reply 7 /)).toBeInTheDocument();

    const seventhRequestBody = JSON.parse(String(jest.mocked(fetch).mock.calls[6][1]?.body));
    expect(seventhRequestBody.message).toBe('User question 7');
    expect(seventhRequestBody.conversationHistory).toHaveLength(10);
    // Oldest turn (User question 1 + Assistant reply 1) dropped; starts at User question 2
    expect(seventhRequestBody.conversationHistory[0]).toEqual({
        role: 'user',
        content: 'User question 2',
    });
    for (const item of seventhRequestBody.conversationHistory) {
        expect(item.content.length).toBeLessThanOrEqual(2500);
    }
    expect(seventhRequestBody.conversationHistory[1].content.length).toBe(2500);
});

it('retains the initial ?q= prompt and assistant reply in conversationHistory on follow-up turns without duplicating the ?q= prompt under StrictMode', async () => {
    delete process.env.AI_CHAT_ACCESS_SECRET;
    jest.mocked(useSearchParams).mockReturnValue(new URLSearchParams({
        q: 'Where can I rent a Honda ADV 160?',
    }) as ReturnType<typeof useSearchParams>);

    const completedBodies: unknown[] = [];
    jest.mocked(fetch).mockImplementation((_url, init) => {
        const signal = (init as RequestInit)?.signal as AbortSignal | undefined;
        const parsedBody = JSON.parse(String((init as RequestInit)?.body));
        return new Promise((resolve, reject) => {
            if (signal?.aborted) {
                const abortErr = new Error('The operation was aborted.');
                abortErr.name = 'AbortError';
                reject(abortErr);
                return;
            }
            const timer = setTimeout(() => {
                completedBodies.push(parsedBody);
                const reply =
                    completedBodies.length === 1
                        ? 'Available in Bangkok, Chiang Mai, and Phuket.'
                        : 'In Chiang Mai, Riders Corner has the Honda ADV 160 for ฿600/day.';
                resolve({
                    ok: true,
                    status: 200,
                    text: async () => JSON.stringify({ response: reply }),
                } as Response);
            }, 10);
            signal?.addEventListener('abort', () => {
                clearTimeout(timer);
                const abortErr = new Error('The operation was aborted.');
                abortErr.name = 'AbortError';
                reject(abortErr);
            });
        });
    });

    const { container } = render(
        <StrictMode>
            <ChatPage />
        </StrictMode>
    );

    expect(await screen.findByText('Available in Bangkok, Chiang Mai, and Phuket.')).toBeInTheDocument();

    const textarea = screen.getByPlaceholderText('Ask about bikes or shops...');
    fireEvent.change(textarea, { target: { value: 'In Chiang Mai' } });
    fireEvent.submit(container.querySelector('form')!);

    expect(
        await screen.findByText('In Chiang Mai, Riders Corner has the Honda ADV 160 for ฿600/day.')
    ).toBeInTheDocument();

    expect(completedBodies).toEqual([
        {
            message: 'Where can I rent a Honda ADV 160?',
            conversationHistory: [],
        },
        {
            message: 'In Chiang Mai',
            conversationHistory: [
                { role: 'user', content: 'Where can I rent a Honda ADV 160?' },
                { role: 'assistant', content: 'Available in Bangkok, Chiang Mai, and Phuket.' },
            ],
        },
    ]);
});





