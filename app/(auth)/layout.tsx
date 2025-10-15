// app/(auth)/layout.tsx
// app/(auth)/layout.tsx
import '../globals.css';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  // no <html> or <body> here
  return <div className="min-h-screen">{children}</div>;
}
