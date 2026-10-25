import React, { useEffect, useRef } from 'react';
import * as echarts from 'echarts';

export function EChart({ option, onClick, onContext }: { option: any; onClick?: (p: any, e: MouseEvent) => void; onContext?: (p: any, e: MouseEvent) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const chart = useRef<echarts.ECharts | null>(null);
  const handlers = useRef({ onClick, onContext });
  handlers.current = { onClick, onContext };
  useEffect(() => {
    const el = ref.current!;
    const c = echarts.init(el, undefined, { renderer: 'canvas' });
    chart.current = c;
    c.on('click', (p: any) => handlers.current.onClick?.(p, p.event?.event));
    c.on('contextmenu', (p: any) => { p.event?.event?.preventDefault?.(); handlers.current.onContext?.(p, p.event?.event); });
    c.getZr().on('click', (e: any) => { if (!e.target) handlers.current.onClick?.(null, e.event); });
    const ro = new ResizeObserver(() => c.resize());
    ro.observe(el);
    return () => { ro.disconnect(); c.dispose(); };
  }, []);
  useEffect(() => { chart.current?.setOption(option, true); }, [option]);
  return <div ref={ref} style={{ position: 'absolute', inset: 0 }} onContextMenu={e => e.preventDefault()} />;
}
