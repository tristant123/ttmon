// Microsoft Purview sensitivity labels used by the sandbox tenant (ordered from least to most sensitive).
export const LABELS: { name: string; color: string; desc: string; protect?: boolean }[] = [
  { name: 'Public', color: '#107c10', desc: 'Data that can be shared outside the organization.' },
  { name: 'General', color: '#0078d4', desc: 'Business data that isn\'t meant for the public.' },
  { name: 'Confidential', color: '#ca5010', desc: 'Sensitive business data. Exports are protected (encrypted) for employees only.', protect: true },
  { name: 'Highly Confidential', color: '#a4262c', desc: 'Very sensitive data. Exports are protected and only named people can open them.', protect: true },
];
export const labelRank = (n?: string) => LABELS.findIndex(l => l.name === n);
