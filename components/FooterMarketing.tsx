// components/FooterMarketing.tsx
// components/FooterMarketing.tsx

export default function FooterMarketing() {
  return (
    <footer
      className="mt-10 bg-[#2439A8] text-white footer-banner"
      aria-label="Marketing footer banner"
    >
      <div className="grid gap-6 px-4 py-8 mx-auto max-w-7xl md:grid-cols-2">
        <div className="text-2xl font-extrabold tracking-wide md:text-3xl">
          <div>#PRIVATELABELME</div>

          <div className="mt-2 text-base font-semibold md:text-lg">
            15 – 17 SEPTEMBER 2025
          </div>

          <a
            href="https://prime-expo.com"
            target="_blank"
            rel="noreferrer noopener"
            className="inline-block mt-1 text-sm underline md:text-base opacity-90 hover:opacity-100 underline-offset-4"
          >
            PRIME-EXPO.COM
          </a>
        </div>

        <div>
          <div className="mb-2 text-lg font-bold">IMPORTANT NOTE</div>

          <ul className="space-y-1 text-sm leading-relaxed opacity-95">
            <li>• Admission to the exhibition is restricted to trade and business professionals only.</li>
            <li>• Visitors under the age of 21 will not be admitted.</li>
            <li>• Entry to the event is free.</li>
            <li>• Beware of misleading communications from unofficial sources.</li>
            <li>
              • Report suspicious activity to{' '}
              <a
                href="mailto:primemarketing@dwtc.com"
                className="underline underline-offset-4 hover:opacity-100"
              >
                primemarketing@dwtc.com
              </a>
              .
            </li>
          </ul>
        </div>
      </div>
    </footer>
  );
}
