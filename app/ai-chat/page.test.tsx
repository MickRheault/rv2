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
        json: async () => ({ response: 'Here are some scooters.' }),
    } as Response);
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
