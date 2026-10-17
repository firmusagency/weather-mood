import qrcode from 'qrcode-generator';
import { useMemo } from 'react';

/** QR code as crisp SVG; always dark-on-white so phones can scan it in any theme. */
export function Qr({ text, size = 160, label }: { text: string; size?: number; label: string }) {
  const { n, path } = useMemo(() => {
    const qr = qrcode(0, 'M');
    qr.addData(text);
    qr.make();
    const count = qr.getModuleCount();
    let d = '';
    for (let r = 0; r < count; r++) for (let c = 0; c < count; c++) if (qr.isDark(r, c)) d += `M${c + 2} ${r + 2}h1v1h-1z`;
    return { n: count + 4, path: d };
  }, [text]);
  return (
    <svg className="qr" width={size} height={size} viewBox={`0 0 ${n} ${n}`} role="img" aria-label={label} shapeRendering="crispEdges">
      <rect width={n} height={n} fill="#ffffff" />
      <path d={path} fill="#0b1214" />
    </svg>
  );
}
