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
