// types/react-qr-scanner.d.ts
// types/react-qr-scanner.d.ts
declare module 'react-qr-scanner' {
    import * as React from 'react';
    export interface QrScannerProps {
      delay?: number;
      style?: React.CSSProperties;
      onError?: (error: any) => void;
      onScan?: (data: string | null) => void;
      facingMode?: 'user' | 'environment';
      constraints?: MediaStreamConstraints; // ⬅️ change from MediaTrackConstraints
      className?: string;
    }
    export default class QrScanner extends React.Component<QrScannerProps> {}
  }
  