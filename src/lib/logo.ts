/** The centre line of the S in the logo: a sweep down the left, a bar to the right, a sharp turn, and a long stroke that curves back like a smile. */
export const S_PATH = 'M46 8 C32 9 20 16 16.5 29 A6 6 0 0 0 22.5 35 L47.5 31.5 C41 44 24 52 10 56.5';

/** The S fits this box (stroke included); the logo and the shareable clip both draw it from here. */
export const S_BOX = { x: 1.5, y: 1.5, w: 54, h: 63 } as const;
export const S_STROKE = 13;
