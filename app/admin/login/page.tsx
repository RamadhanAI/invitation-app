// app/admin/login/page.tsx
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default function AdminLoginPage() {
  return (
    <div className="max-w-sm p-6 mx-auto space-y-4">
      <h1 className="text-xl font-semibold">Admin login</h1>
      <form method="post" action="/api/admin/session" className="grid gap-3">
        <label className="grid gap-1">
          <span className="text-sm">Admin / Organizer API Key</span>
          <input name="key" className="p-2 border rounded" />
        </label>
        <button className="px-3 py-2 text-white bg-black rounded">Sign in</button>
      </form>

      <form method="post" action="/api/admin/session?_method=DELETE" className="pt-2">
        <button className="text-sm underline" type="submit">Sign out</button>
      </form>
    </div>
  );
}
