// components/HeaderStrip.tsx
// components/HeaderStrip.tsx
import Link from 'next/link';

export default function HeaderStrip() {
  return (
    <div className="w-full text-sm text-white border-b bg-gradient-to-r from-indigo-800 via-blue-800 to-indigo-800 border-white/10">
      <div className="flex items-center justify-between py-2 container-page">
        <div className="truncate">
          <span className="font-semibold">AurumPass</span> — Premium ticketing, cinematic QR passes, and fast check-in.
        </div>

        <Link href="/request-demo" className="underline underline-offset-4 hover:opacity-90">
          Request a demo
        </Link>
      </div>
    </div>
  );
}
