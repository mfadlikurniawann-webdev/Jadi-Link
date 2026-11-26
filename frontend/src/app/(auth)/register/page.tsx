import { Suspense } from 'react';
import { AuthForm } from '@/features/auth/auth-form';
import { LoadingPage } from '@/components/ui';

export default function RegisterPage() {
  return (
    <Suspense fallback={<LoadingPage />}>
      <AuthForm mode="register" />
    </Suspense>
  );
}
