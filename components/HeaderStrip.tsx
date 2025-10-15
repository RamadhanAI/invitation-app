// components/HeaderStrip.tsx
export default function HeaderStrip() {
    return (
      <div className="w-full bg-[#2439A8] text-white">
        <div className="flex items-center justify-between px-4 py-2 mx-auto max-w-7xl">
          <div className="text-xs font-semibold tracking-wide md:text-sm">
            FREE FOR TRADE PROFESSIONALS
          </div>
          <a
            href="/admin/login"
            className="text-xs font-semibold underline md:text-sm underline-offset-2 hover:opacity-90"
          >
            Login
          </a>
        </div>
      </div>
    );
  }
  