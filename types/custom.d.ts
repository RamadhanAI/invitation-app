// types/custom.d.ts

// PapaParse lightweight types (CSV import in Admin Dashboard)
declare module 'papaparse' {
  export interface ParseError {
    code: string;
    message: string;
    row?: number;
    type?: string;
  }

  export interface ParseResult<T> {
    data: T[];
    errors: ParseError[];
    meta: any;
  }

  export interface ParseConfig<T> {
    header?: boolean;
    skipEmptyLines?: boolean | 'greedy';
    complete?: (results: ParseResult<T>) => void;
    error?: (error: ParseError) => void;
    delimiter?: string;
    dynamicTyping?: boolean;
    transformHeader?: (h: string) => string;
  }

  export function parse<T = any>(
    input: string | File | Blob,
    config?: ParseConfig<T>
  ): ParseResult<T>;

  const _default: { parse: typeof parse };
  export default _default;
}
// types/custom.d.ts

declare module 'bcryptjs' {
  export function compare(
    data: string,
    encrypted: string
  ): Promise<boolean>;
}
