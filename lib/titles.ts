// lib/titles.ts
export const TITLE_OPTIONS = [
    'Mr.',
    'Mrs.',
    'Ms.',
    'Miss',
    'Dr.',
    'Prof.',
    'Eng.',
    'Hon.',
    'H.E.',
    'Sheikh',
    'Sheikha',
    'Other',
  ] as const;
  
  export type TitleOption = (typeof TITLE_OPTIONS)[number];
  