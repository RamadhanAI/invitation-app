// lib/designations.ts
export const DESIGNATION_OPTIONS = [
    'Founder / Co-Founder',
    'Owner / Proprietor',
    'CEO / Managing Director',
    'COO / General Manager',
    'CFO / Finance Director',
    'CTO / CIO',
    'VP / SVP',
    'Head of Department',
    'Director',
    'Senior Manager',
    'Manager',
    'Team Lead / Supervisor',
    'Project Manager',
    'Program Manager',
    'Product Manager',
    'Consultant',
    'Engineer',
    'Analyst',
    'Specialist',
    'Coordinator',
    'Administrator',
    'Government Official',
    'Professor / Lecturer',
    'Researcher',
    'Student',
    'Investor',
    'Media',
    'Other',
  ] as const;
  
  export type DesignationOption = (typeof DESIGNATION_OPTIONS)[number];
  