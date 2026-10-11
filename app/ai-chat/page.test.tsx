import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useSearchParams } from 'next/navigation';
import ChatPage from './page';

const originalSecret = process.env.AI_CHAT_ACCESS_SECRET;

jest.mock('react-markdown', () => ({
    __esModule: true,
    default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
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
    fireEvent.change(screen.getByPlaceholderText('Ask about motorcycles, shops, or locations...'), {
        target: { value: 'Find scooters in Bangkok' },
    });
    fireEvent.submit(container.querySelector('form')!);
    await waitFor(() => expect(fetch).toHaveBeenCalledWith('/api/chat', expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'Find scooters in Bangkok' }),
    })));
    expect(await screen.findByText('Here are some scooters.')).toBeInTheDocument();
});

it('allows old access-code links in public mode without sending their credentials', async () => {
    delete process.env.AI_CHAT_ACCESS_SECRET;
    const { container } = render(<ChatPage />);
    fireEvent.change(screen.getByPlaceholderText('Ask about motorcycles, shops, or locations...'), {
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
    fireEvent.change(screen.getByPlaceholderText('Ask about motorcycles, shops, or locations...'), {
        target: { value: 'Find CRF rentals in Thailand' },
    });
    fireEvent.submit(container.querySelector('form')!);
    expect(await screen.findByText(`Error: ${message}`)).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Ask about motorcycles, shops, or locations...')).toBeEnabled();
});

it('sends the user-supplied access code with the chat request', async () => {
    const { container } = render(<ChatPage />);
    fireEvent.change(screen.getByPlaceholderText('Ask about motorcycles, shops, or locations...'), {
        target: { value: 'Find scooters in Bangkok' },
    });
    fireEvent.submit(container.querySelector('form')!);
    await waitFor(() => expect(fetch).toHaveBeenCalledWith('/api/chat', expect.objectContaining({
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer test-only-user-supplied-access-code',
        },
        body: JSON.stringify({ message: 'Find scooters in Bangkok' }),
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
    fireEvent.change(screen.getByPlaceholderText('Ask about motorcycles, shops, or locations...'), {
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
    fireEvent.change(screen.getByPlaceholderText('Ask about motorcycles, shops, or locations...'), {
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
    const textarea = screen.getByPlaceholderText('Ask about motorcycles, shops, or locations...');
    
    // Shift+Enter does not submit
    fireEvent.change(textarea, { target: { value: 'First line' } });
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: true });
    expect(fetch).not.toHaveBeenCalled();

    // Enter without Shift submits
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false });
    await waitFor(() => expect(fetch).toHaveBeenCalledWith('/api/chat', expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ message: 'First line' }),
    })));
});

it('does not submit on Enter when IME is actively composing (e.g. Thai/Japanese input)', () => {
    delete process.env.AI_CHAT_ACCESS_SECRET;
    render(<ChatPage />);
    const textarea = screen.getByPlaceholderText('Ask about motorcycles, shops, or locations...');
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
    fireEvent.change(screen.getByPlaceholderText('Ask about motorcycles, shops, or locations...'), {
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
    expect(screen.getByLabelText('Ask about motorcycles, shops, or locations...')).toBeInTheDocument();
});

it('renders an accessible sidebar toggle button and toggles 260px panel', () => {
    delete process.env.AI_CHAT_ACCESS_SECRET;
    render(<ChatPage />);
    const toggleButton = screen.getByRole('button', { name: /toggle sidebar/i });
    expect(toggleButton).toHaveAttribute('aria-expanded', 'false');
    expect(toggleButton).toHaveAttribute('aria-controls', 'chat-sidebar');

    const sidebar = screen.getByLabelText(/Rental Resources and Quick Links/i);
    expect(sidebar).toHaveClass('-translate-x-full', 'md:w-0');

    fireEvent.click(toggleButton);
    expect(toggleButton).toHaveAttribute('aria-expanded', 'true');
    expect(sidebar).toHaveClass('translate-x-0', 'md:w-[260px]');
});

it('renders mobile slide-over backdrop and closes sidebar on backdrop click or close button', () => {
    delete process.env.AI_CHAT_ACCESS_SECRET;
    render(<ChatPage />);
    const toggleButton = screen.getByRole('button', { name: /toggle sidebar/i });
    
    // Open sidebar
    fireEvent.click(toggleButton);
    const backdrop = screen.getByTestId('sidebar-backdrop');
    expect(backdrop).toBeInTheDocument();

    // Click backdrop to close
    fireEvent.click(backdrop);
    expect(screen.queryByTestId('sidebar-backdrop')).not.toBeInTheDocument();

    // Re-open and close with close button
    fireEvent.click(toggleButton);
    const closeBtn = screen.getByRole('button', { name: /close sidebar/i });
    fireEvent.click(closeBtn);
    expect(screen.queryByTestId('sidebar-backdrop')).not.toBeInTheDocument();
});

it('renders direct search navigation links to Bangkok, Phuket, Chiang Mai, and Bali', () => {
    delete process.env.AI_CHAT_ACCESS_SECRET;
    render(<ChatPage />);
    fireEvent.click(screen.getByRole('button', { name: /toggle sidebar/i }));

    expect(screen.getByRole('link', { name: /Bangkok/i })).toHaveAttribute('href', '/thailand/bangkok');
    expect(screen.getByRole('link', { name: /Phuket/i })).toHaveAttribute('href', '/thailand/phuket');
    expect(screen.getByRole('link', { name: /Chiang Mai/i })).toHaveAttribute('href', '/thailand/chiang-mai');
    expect(screen.getByRole('link', { name: /Bali/i })).toHaveAttribute('href', '/indonesia/bali');
});

it('renders essential riding guides, license requirements, and safety links', () => {
    delete process.env.AI_CHAT_ACCESS_SECRET;
    render(<ChatPage />);
    fireEvent.click(screen.getByRole('button', { name: /toggle sidebar/i }));

    expect(screen.getByText(/IDP & License Requirements/i)).toBeInTheDocument();
    expect(screen.getByText(/Helmet Laws & Safety/i)).toBeInTheDocument();
    expect(screen.getByText(/Insurance & Damage Coverage/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Full Safety Tips/i })).toHaveAttribute('href', '/safety');
});

it('updates chat input text when clicking a prompt starter chip in the sidebar', () => {
    delete process.env.AI_CHAT_ACCESS_SECRET;
    render(<ChatPage />);
    fireEvent.click(screen.getByRole('button', { name: /toggle sidebar/i }));

    const starterChip = screen.getByRole('button', { name: /Scooters under \$15\/day in Bangkok/i });
    fireEvent.click(starterChip);

    const textarea = screen.getByPlaceholderText('Ask about motorcycles, shops, or locations...');
    expect(textarea).toHaveValue('Scooters under $15/day in Bangkok');
});

it('closes sidebar on Escape key press', () => {
    delete process.env.AI_CHAT_ACCESS_SECRET;
    render(<ChatPage />);
    const toggleButton = screen.getByRole('button', { name: /toggle sidebar/i });
    
    // Open sidebar
    fireEvent.click(toggleButton);
    expect(toggleButton).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByTestId('sidebar-backdrop')).toBeInTheDocument();

    // Press Escape
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(toggleButton).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByTestId('sidebar-backdrop')).not.toBeInTheDocument();
});

it('sets inert attribute on sidebar when collapsed and removes when open', () => {
    delete process.env.AI_CHAT_ACCESS_SECRET;
    render(<ChatPage />);
    const toggleButton = screen.getByRole('button', { name: /toggle sidebar/i });
    const sidebar = screen.getByLabelText(/Rental Resources and Quick Links/i);

    expect(sidebar).toHaveAttribute('inert');

    fireEvent.click(toggleButton);
    expect(sidebar).not.toHaveAttribute('inert');
});

it('closes mobile sidebar when clicking a city link or safety guide link on mobile viewports', () => {
    delete process.env.AI_CHAT_ACCESS_SECRET;
    const originalInnerWidth = window.innerWidth;
    try {
        Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 500 });
        render(<ChatPage />);
        const toggleButton = screen.getByRole('button', { name: /toggle sidebar/i });

        // Open sidebar on mobile
        fireEvent.click(toggleButton);
        expect(screen.getByTestId('sidebar-backdrop')).toBeInTheDocument();

        // Click city link
        fireEvent.click(screen.getByRole('link', { name: /Bangkok/i }));
        expect(screen.queryByTestId('sidebar-backdrop')).not.toBeInTheDocument();

        // Re-open and click safety link
        fireEvent.click(toggleButton);
        expect(screen.getByTestId('sidebar-backdrop')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('link', { name: /Full Safety Tips/i }));
        expect(screen.queryByTestId('sidebar-backdrop')).not.toBeInTheDocument();
    } finally {
        Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: originalInnerWidth });
    }
});

