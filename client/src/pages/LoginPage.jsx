import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import Button from '../components/Button.jsx';
import ErrorBanner from '../components/ErrorBanner.jsx';
import Input from '../components/Input.jsx';
import { useAuth } from '../context/AuthContext.jsx';

export default function LoginPage() {
  const { login, isAuthenticated, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const destination = location.state?.from?.pathname || '/';

  // If already authenticated, redirect to destination
  useEffect(() => {
    if (isAuthenticated && !authLoading) {
      navigate(destination, { replace: true });
    }
  }, [isAuthenticated, authLoading, navigate, destination]);

  const validate = () => {
    const errs = {};
    const trimmedEmail = email.trim();

    if (!trimmedEmail) {
      errs.email = 'Email is required.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      errs.email = 'Please enter a valid email address.';
    }

    if (!password) {
      errs.password = 'Password is required.';
    } else if (password.length < 8) {
      errs.password = 'Password must be at least 8 characters long.';
    }

    return errs;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setServerError('');

    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setErrors({});
    setSubmitting(true);

    try {
      await login({
        email: email.trim(),
        password,
      });
      navigate(destination, { replace: true });
    } catch (err) {
      const msg =
        err.response?.data?.error?.message ||
        'Failed to sign in. Please check your credentials and try again.';
      setServerError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-xl font-bold tracking-tight text-ink">Sign in</h1>
        <p className="text-xs text-muted">
          Authenticate to manage RAGShield projects, defenses, and security runs.
        </p>
      </div>

      {serverError && (
        <ErrorBanner
          message={serverError}
          onDismiss={() => setServerError('')}
        />
      )}

      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <Input
          label="Email address"
          name="email"
          type="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (errors.email) setErrors((prev) => ({ ...prev, email: '' }));
          }}
          placeholder="developer@example.com"
          error={errors.email}
          autoComplete="email"
          required
          disabled={submitting}
        />

        <Input
          label="Password"
          name="password"
          type="password"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            if (errors.password) setErrors((prev) => ({ ...prev, password: '' }));
          }}
          placeholder="••••••••"
          error={errors.password}
          autoComplete="current-password"
          required
          disabled={submitting}
        />

        <Button
          type="submit"
          variant="primary"
          className="w-full mt-2"
          loading={submitting}
        >
          Sign in
        </Button>
      </form>

      <div className="pt-2 text-center text-xs text-muted border-t border-line">
        Don&apos;t have an account?{' '}
        <Link
          to="/register"
          className="font-medium text-brand hover:text-brand-hover focus:outline-none focus:underline"
        >
          Create an account
        </Link>
      </div>
    </div>
  );
}
