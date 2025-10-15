// components/CopyInviteButton.tsx
'use client';

export default function CopyInviteButton({ url }: { url: string }) {
  return (
    <button
      className="btn"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(url);
          alert('Public link copied!');
        } catch {
          prompt('Copy this link:', url);
        }
      }}
    >
      Copy invite link
    </button>
  );
}
