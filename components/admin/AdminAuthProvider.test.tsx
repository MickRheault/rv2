import React from 'react';
import { render, screen, act, waitFor, fireEvent } from '@testing-library/react';
import { AdminAuthProvider } from './AdminAuthProvider';
import AdminLoginPage from '@/app/admin/login/page';
import { supabase } from '@/lib/supabase/client';

const mockPush = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: jest.fn(),
    prefetch: jest.fn(),
  }),
  usePathname: () => '/admin/login',
}));

function captureAuthStateSubscriber() {
  let subscriber: ((event: string, session: any) => Promise<void> | void) | null = null;
  jest.spyOn(supabase.auth, 'onAuthStateChange').mockImplementation((cb: any) => {
    subscriber = cb;
    return {
      data: {
        subscription: {
          id: 'sub-mock',
          callback: cb,
          unsubscribe: jest.fn(),
        },
      },
    } as any;
  });
  return {
    emit: async (event: string, session: any) => {
      if (subscriber) {
        await subscriber(event, session);
      }
    },
  };
}

function mockUserRoleQuery(roleData: { role: string } | null) {
  jest.spyOn(supabase, 'from').mockReturnValue({
    select: jest.fn().mockReturnValue({
      eq: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          maybeSingle: jest.fn().mockResolvedValue({
            data: roleData,
            error: null,
          }),
        }),
      }),
    }),
  } as any);
}

describe('AdminAuthProvider & AdminLoginPage authentication loop diagnosis (#147)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it('does not deadlock on "Checking authentication..." when GoTrue emits TOKEN_REFRESHED or SIGNED_IN while holding its internal lock', async () => {
    let lockAcquired = false;
    const pendingInLock: Promise<any>[] = [];

    const acquireLock = async <T,>(fn: () => Promise<T>): Promise<T> => {
      if (lockAcquired) {
        const last = pendingInLock.length
          ? pendingInLock[pendingInLock.length - 1]
          : Promise.resolve();
        const result = (async () => {
          await last;
          return await fn();
        })();
        pendingInLock.push(result.catch(() => {}));
        return result;
      }

      lockAcquired = true;
      try {
        const result = fn();
        pendingInLock.push(result.catch(() => {}));
        await result;
        while (pendingInLock.length) {
          const waitOn = [...pendingInLock];
          await Promise.all(waitOn);
          pendingInLock.splice(0, waitOn.length);
        }
        return await result;
      } finally {
        lockAcquired = false;
      }
    };

    const authEvents = captureAuthStateSubscriber();

    let resolveInitGate!: () => void;
    const initGate = new Promise<void>((r) => {
      resolveInitGate = r;
    });

    const initializePromise = acquireLock(async () => {
      await initGate;
      await authEvents.emit('TOKEN_REFRESHED', {
        access_token: 'refreshed-jwt',
        user: { id: 'admin-1', email: 'admin@gmr.com', created_at: '2026-01-01T00:00:00Z' },
      });
    });

    jest.spyOn(supabase.auth, 'getSession').mockImplementation(async () => {
      await initializePromise;
      return await acquireLock(async () => ({
        data: { session: null },
        error: null,
      })) as any;
    });

    jest.spyOn(supabase.auth, 'getUser').mockImplementation(async () => {
      await initializePromise;
      return await acquireLock(async () => ({
        data: { user: null },
        error: null,
      })) as any;
    });

    render(
      <AdminAuthProvider>
        <AdminLoginPage />
      </AdminAuthProvider>
    );

    expect(screen.getByText(/Checking authentication\.\.\./i)).toBeInTheDocument();

    await act(async () => {
      resolveInitGate();
      await new Promise((r) => setTimeout(r, 50));
    });

    await waitFor(
      () => {
        expect(screen.queryByText(/Checking authentication\.\.\./i)).not.toBeInTheDocument();
      },
      { timeout: 500 }
    );
    expect(screen.getByText(/Sign in to Admin Panel/i)).toBeInTheDocument();
  });

  it('falls back to rendering the Sign In form after the 5s initialization timeout if getSession hangs indefinitely', async () => {
    jest.useFakeTimers();
    captureAuthStateSubscriber();

    jest.spyOn(supabase.auth, 'getSession').mockImplementation(
      () => new Promise(() => {}) as any
    );

    render(
      <AdminAuthProvider>
        <AdminLoginPage />
      </AdminAuthProvider>
    );

    expect(screen.getByText(/Checking authentication\.\.\./i)).toBeInTheDocument();

    await act(async () => {
      jest.advanceTimersByTime(5100);
    });

    expect(screen.queryByText(/Checking authentication\.\.\./i)).not.toBeInTheDocument();
    expect(screen.getByText(/Sign in to Admin Panel/i)).toBeInTheDocument();
  });

  it('keeps the login form mounted during sign-in without flashing "Checking authentication..." and shows an error when a signed-in user lacks admin privileges', async () => {
    const authEvents = captureAuthStateSubscriber();

    jest.spyOn(supabase.auth, 'getSession').mockResolvedValue({
      data: { session: null },
      error: null,
    } as any);

    const nonAdminUser = {
      id: 'user-regular',
      email: 'rider@gmr.com',
      created_at: '2026-01-01T00:00:00Z',
    };
    const nonAdminSession = {
      access_token: 'non-admin-jwt',
      refresh_token: 'refresh-1',
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      user: nonAdminUser,
    };

    jest.spyOn(supabase.auth, 'signInWithPassword').mockImplementation(async () => {
      await authEvents.emit('SIGNED_IN', nonAdminSession);
      return {
        data: { user: nonAdminUser, session: nonAdminSession },
        error: null,
      } as any;
    });

    const signOutSpy = jest.spyOn(supabase.auth, 'signOut').mockResolvedValue({
      error: null,
    } as any);

    mockUserRoleQuery(null);

    render(
      <AdminAuthProvider>
        <AdminLoginPage />
      </AdminAuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByText(/Sign in to Admin Panel/i)).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText(/Email address/i), {
      target: { value: 'rider@gmr.com' },
    });
    fireEvent.change(screen.getByLabelText(/Password/i), {
      target: { value: 'password123' },
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Sign in/i }));
    });

    expect(screen.queryByText(/Checking authentication\.\.\./i)).not.toBeInTheDocument();
    expect(screen.getByText(/Sign in to Admin Panel/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(
        screen.getByText(/does not have administrator privileges/i)
      ).toBeInTheDocument();
    });
    expect(signOutSpy).toHaveBeenCalled();
  });

  it('redirects to /admin after successful admin sign-in without flashing "Checking authentication..."', async () => {
    const authEvents = captureAuthStateSubscriber();

    jest.spyOn(supabase.auth, 'getSession').mockResolvedValue({
      data: { session: null },
      error: null,
    } as any);

    const adminUser = {
      id: 'user-admin',
      email: 'admin@gmr.com',
      created_at: '2026-01-01T00:00:00Z',
    };
    const adminSession = {
      access_token: 'admin-jwt',
      refresh_token: 'refresh-admin',
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      user: adminUser,
    };

    jest.spyOn(supabase.auth, 'signInWithPassword').mockImplementation(async () => {
      await authEvents.emit('SIGNED_IN', adminSession);
      return {
        data: { user: adminUser, session: adminSession },
        error: null,
      } as any;
    });

    mockUserRoleQuery({ role: 'admin' });

    render(
      <AdminAuthProvider>
        <AdminLoginPage />
      </AdminAuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByText(/Sign in to Admin Panel/i)).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText(/Email address/i), {
      target: { value: 'admin@gmr.com' },
    });
    fireEvent.change(screen.getByLabelText(/Password/i), {
      target: { value: 'adminpass123' },
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Sign in/i }));
    });

    expect(screen.queryByText(/Checking authentication\.\.\./i)).not.toBeInTheDocument();
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/admin');
    });
  });
});
