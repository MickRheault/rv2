import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useSearchParams } from 'next/navigation';
import ChatPage from './page';

jest.mock('react-markdown', () => ({
    __esModule: true,
    default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
jest.mock('next/navigation', () => ({ useSearchParams: jest.fn() }));

beforeEach(() => {
    jest.mocked(useSearchParams).mockReturnValue(new URLSearchParams({
        secret: 'test-only-user-supplied-access-code',
    }) as ReturnType<typeof useSearchParams>);
    jest.mocked(fetch).mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ response: 'Here are some scooters.' }),
    } as Response);
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
