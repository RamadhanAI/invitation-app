'use client';
import { useEffect, useState } from 'react';

export default function LanguageToggle() {
  const [lang, setLang] = useState<'en'|'ar'>(() => (typeof window !== 'undefined'
    ? (localStorage.getItem('lang') as 'en' | 'ar') ?? 'en'
    : 'en'));

  useEffect(() => {
    localStorage.setItem('lang', lang);
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
  }, [lang]);

  return (
    <button
      className="text-sm px-3 py-1.5 rounded-lg hover:bg-white/10"
      onClick={() => setLang((p) => (p === 'en' ? 'ar' : 'en'))}
      title="Toggle language"
    >
      {lang === 'en' ? 'العربية' : 'English'}
    </button>
  );
}
