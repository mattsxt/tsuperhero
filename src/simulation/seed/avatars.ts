const PALETTE = [
  ["#0f766e", "#99f6e4"],
  ["#b45309", "#fde68a"],
  ["#6d28d9", "#ddd6fe"],
  ["#be123c", "#fecdd3"],
  ["#1d4ed8", "#bfdbfe"],
  ["#4d7c0f", "#d9f99d"],
];

export const avatar = (initials: string, index: number): string => {
  const [bg, fg] = PALETTE[index % PALETTE.length];
  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 128 128'>` +
    `<circle cx='64' cy='64' r='64' fill='${bg}'/>` +
    `<circle cx='64' cy='50' r='22' fill='${fg}' opacity='0.35'/>` +
    `<path d='M20 128c0-30 20-46 44-46s44 16 44 46z' fill='${fg}' opacity='0.35'/>` +
    `<text x='64' y='76' font-family='Arial,Helvetica,sans-serif' font-size='44' font-weight='700' text-anchor='middle' fill='${fg}'>${initials}</text>` +
    `</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
};

export const avatars = {
  juan: avatar("JD", 0),
  ana: avatar("AR", 1),
  mario: avatar("MS", 2),
  pedro: avatar("PC", 3),
  operator: avatar("BD", 4),
  carla: avatar("CL", 5),
  luis: avatar("LM", 0),
  rosa: avatar("RB", 1),
  tomas: avatar("TV", 2),
  nena: avatar("NG", 3),
  bong: avatar("BP", 4),
};
