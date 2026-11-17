import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ProtectedRoute from '../components/ProtectedRoute.jsx';
import { AuthProvider, useAuth } from '../context/AuthContext.jsx';
import LoginPage from '../pages/LoginPage.jsx';
import RegisterPage from '../pages/RegisterPage.jsx';
import api, { clearStoredToken, setStoredToken, setUnauthorizedHandler, TOKEN_STORAGE_KEY } from '../services/api.js';

// Mock the axios api instance
vi.mock('../services/api.js', async () => {
  const actual = await vi.importActual('../services/api.js');
  return {
    ...actual,
    default: {
      get: vi.fn(),
      post: vi.fn(),
      interceptors: actual.api.interceptors,
    },
  };
});

describe('T5.1 Auth Flow — ProtectedRoute, Validation, Interceptor', () => {
  beforeEach(() => {
    clearStoredToken();
    vi.clearAllMocks();
  });

  afterEach(() => {
    clearStoredToken();
    vi.restoreAllMocks();
  });

  describe('ProtectedRoute', () => {
    function TestApp({ initialRoute = '/protected' }) {
      return (
        <AuthProvider>
          <MemoryRouter initialEntries={[initialRoute]}>
            <Routes>
              <Route path="/login" element={<div>Login Page Mock</div>} />
              <Route element={<ProtectedRoute />}>
                <Route path="/protected" element={<div>Protected Secret Area</div>} />
              </Route>
            </Routes>
          </MemoryRouter>
        </AuthProvider>
      );
    }

    it('redirects unauthenticated user from protected route to /login', async () => {
      render(<TestApp initialRoute="/protected" />);

      await waitFor(() => {
        expect(screen.getByText('Login Page Mock')).toBeInTheDocument();
      });
      expect(screen.queryByText('Protected Secret Area')).not.toBeInTheDocument();
    });

    it('renders protected content when user is authenticated', async () => {
      // Simulate stored token and successful bootstrap
      setStoredToken('valid-token-123');
      api.get.mockResolvedValueOnce({
        data: {
          user: { id: 'u1', name: 'Alice Dev', email: 'alice@example.com' },
        },
      });

      render(<TestApp initialRoute="/protected" />);

      await waitFor(() => {
        expect(screen.getByText('Protected Secret Area')).toBeInTheDocument();
      });
      expect(screen.queryByText('Login Page Mock')).not.toBeInTheDocument();
    });

    it('clears token and redirects if bootstrap /auth/me returns 401', async () => {
      setStoredToken('invalid-token');
      api.get.mockRejectedValueOnce({
        response: { status: 401, data: { error: { code: 'UNAUTHENTICATED' } } },
      });

      render(<TestApp initialRoute="/protected" />);

      await waitFor(() => {
        expect(screen.getByText('Login Page Mock')).toBeInTheDocument();
      });
      expect(window.localStorage.getItem(TOKEN_STORAGE_KEY)).toBeNull();
    });
  });

  describe('LoginPage form validation & server errors', () => {
    function RenderLogin() {
      return (
        <AuthProvider>
          <MemoryRouter initialEntries={['/login']}>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/" element={<div>Dashboard Home</div>} />
            </Routes>
          </MemoryRouter>
        </AuthProvider>
      );
    }

    it('shows inline validation errors when submitted with empty fields', async () => {
      render(<RenderLogin />);

      const submitBtn = screen.getByRole('button', { name: /sign in/i });
      fireEvent.click(submitBtn);

      expect(await screen.findByText('Email is required.')).toBeInTheDocument();
      expect(screen.getByText('Password is required.')).toBeInTheDocument();
      expect(api.post).not.toHaveBeenCalled();
    });

    it('shows inline validation error for malformed email and short password', async () => {
      render(<RenderLogin />);

      const emailInput = screen.getByLabelText(/email address/i);
      const passwordInput = screen.getByLabelText(/password/i);
      const submitBtn = screen.getByRole('button', { name: /sign in/i });

      fireEvent.change(emailInput, { target: { value: 'not-an-email' } });
      fireEvent.change(passwordInput, { target: { value: 'short' } });
      fireEvent.click(submitBtn);

      expect(await screen.findByText('Please enter a valid email address.')).toBeInTheDocument();
      expect(screen.getByText('Password must be at least 8 characters long.')).toBeInTheDocument();
      expect(api.post).not.toHaveBeenCalled();
    });

    it('displays server error banner on failed login', async () => {
      api.post.mockRejectedValueOnce({
        response: {
          status: 401,
          data: {
            error: {
              code: 'INVALID_CREDENTIALS',
              message: 'Invalid email or password.',
            },
          },
        },
      });

      render(<RenderLogin />);

      fireEvent.change(screen.getByLabelText(/email address/i), {
        target: { value: 'user@example.com' },
      });
      fireEvent.change(screen.getByLabelText(/password/i), {
        target: { value: 'wrongpassword123' },
      });
      fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

      expect(await screen.findByText('Invalid email or password.')).toBeInTheDocument();
    });

    it('submits valid credentials and logs in successfully', async () => {
      api.post.mockResolvedValueOnce({
        data: {
          token: 'signed-jwt-token',
          user: { id: 'u1', name: 'Tester', email: 'user@example.com' },
        },
      });

      render(<RenderLogin />);

      fireEvent.change(screen.getByLabelText(/email address/i), {
        target: { value: 'user@example.com' },
      });
      fireEvent.change(screen.getByLabelText(/password/i), {
        target: { value: 'validPassword123' },
      });
      fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

      await waitFor(() => {
        expect(api.post).toHaveBeenCalledWith('/auth/login', {
          email: 'user@example.com',
          password: 'validPassword123',
        });
      });

      expect(await screen.findByText('Dashboard Home')).toBeInTheDocument();
      expect(window.localStorage.getItem(TOKEN_STORAGE_KEY)).toBe('signed-jwt-token');
    });
  });

  describe('RegisterPage form validation & server errors', () => {
    function RenderRegister() {
      return (
        <AuthProvider>
          <MemoryRouter initialEntries={['/register']}>
            <Routes>
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/" element={<div>Dashboard Home</div>} />
            </Routes>
          </MemoryRouter>
        </AuthProvider>
      );
    }

    it('shows inline validation errors when fields are empty or invalid', async () => {
      render(<RenderRegister />);

      fireEvent.click(screen.getByRole('button', { name: /create account/i }));

      expect(await screen.findByText('Name is required.')).toBeInTheDocument();
      expect(screen.getByText('Email is required.')).toBeInTheDocument();
      expect(screen.getByText('Password is required.')).toBeInTheDocument();
      expect(api.post).not.toHaveBeenCalled();

      // Test short name
      fireEvent.change(screen.getByLabelText(/full name/i), { target: { value: 'J' } });
      fireEvent.click(screen.getByRole('button', { name: /create account/i }));
      expect(await screen.findByText('Name must be at least 2 characters long.')).toBeInTheDocument();
    });

    it('displays server error banner on 409 EMAIL_TAKEN', async () => {
      api.post.mockRejectedValueOnce({
        response: {
          status: 409,
          data: {
            error: {
              code: 'EMAIL_TAKEN',
              message: 'An account with this email already exists.',
            },
          },
        },
      });

      render(<RenderRegister />);

      fireEvent.change(screen.getByLabelText(/full name/i), { target: { value: 'Existing User' } });
      fireEvent.change(screen.getByLabelText(/email address/i), { target: { value: 'taken@example.com' } });
      fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'password123' } });
      fireEvent.click(screen.getByRole('button', { name: /create account/i }));

      expect(await screen.findByText('An account with this email already exists.')).toBeInTheDocument();
    });

    it('submits valid registration and redirects to destination', async () => {
      api.post.mockResolvedValueOnce({
        data: {
          token: 'registered-jwt-token',
          user: { id: 'u2', name: 'New Dev', email: 'newdev@example.com' },
        },
      });

      render(<RenderRegister />);

      fireEvent.change(screen.getByLabelText(/full name/i), { target: { value: 'New Dev' } });
      fireEvent.change(screen.getByLabelText(/email address/i), { target: { value: 'newdev@example.com' } });
      fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'password123' } });
      fireEvent.click(screen.getByRole('button', { name: /create account/i }));

      await waitFor(() => {
        expect(api.post).toHaveBeenCalledWith('/auth/register', {
          name: 'New Dev',
          email: 'newdev@example.com',
          password: 'password123',
        });
      });

      expect(await screen.findByText('Dashboard Home')).toBeInTheDocument();
      expect(window.localStorage.getItem(TOKEN_STORAGE_KEY)).toBe('registered-jwt-token');
    });
  });

  describe('401 Interceptor and Logout', () => {
    function ProfileConsumer() {
      const { user, isAuthenticated, logout } = useAuth();
      return (
        <div>
          <span data-testid="auth-status">{isAuthenticated ? 'logged-in' : 'logged-out'}</span>
          <span data-testid="user-name">{user?.name || 'none'}</span>
          <button onClick={logout}>Do Logout</button>
        </div>
      );
    }

    it('clears state on manual logout', async () => {
      setStoredToken('test-token');
      api.get.mockResolvedValueOnce({
        data: { user: { id: 'u1', name: 'Bob', email: 'bob@example.com' } },
      });
      api.post.mockResolvedValueOnce({ status: 204 });

      render(
        <AuthProvider>
          <ProfileConsumer />
        </AuthProvider>,
      );

      await waitFor(() => {
        expect(screen.getByTestId('auth-status')).toHaveTextContent('logged-in');
      });

      fireEvent.click(screen.getByRole('button', { name: /do logout/i }));

      await waitFor(() => {
        expect(screen.getByTestId('auth-status')).toHaveTextContent('logged-out');
      });
      expect(window.localStorage.getItem(TOKEN_STORAGE_KEY)).toBeNull();
    });
  });
});
