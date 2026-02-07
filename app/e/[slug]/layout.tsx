// app/e/[slug]/layout.tsx
import '../../globals.css';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function EventLayout({ children }: { children: React.ReactNode }) {
  // Event pages don't need the public header/footer
  return <div className="min-h-screen">{children}</div>;
}
