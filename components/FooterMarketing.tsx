// components/FooterMarketing.tsx
export default function FooterMarketing() {
    return (
      <div className="mt-10 bg-[#2439A8] text-white">
        <div className="grid gap-6 px-4 py-8 mx-auto max-w-7xl md:grid-cols-2">
          <div className="text-2xl font-extrabold tracking-wide md:text-3xl">
            #PRIVATELABELME
            <div className="mt-2 text-base font-semibold md:text-lg">
              15 – 17 SEPTEMBER 2025
            </div>
            <div className="text-sm md:text-base opacity-90">PRIME-EXPO.COM</div>
          </div>
  
          <div>
            <div className="mb-2 text-lg font-bold">IMPORTANT NOTE</div>
            <ul className="space-y-1 text-sm leading-relaxed opacity-95">
              <li>• Admission to the exhibition is restricted to trade and business professionals only.</li>
              <li>• Visitors under the age of 21 will not be admitted.</li>
              <li>• Entry to the event is free.</li>
              <li>• Beware of misleading communications from unofficial sources.</li>
              <li>• Report suspicious activity to primemarketing@dwtc.com.</li>
            </ul>
          </div>
        </div>
      </div>
    );
  }
  