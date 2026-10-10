'use client';

/**
 * Demo prescription image (EF-17). Drawn on a canvas at runtime — no binary
 * asset needed and the watermark "EXEMPLE FICTIF" is guaranteed (CA-17.4).
 * Large clear text so the real model can read it; the offline fallback uses
 * the pre-calculated analyses instead.
 */

const MED_LINES = [
  '1. WARFARINE 5 mg',
  '    1 comprimé le soir',
  '2. IBUPROFÈNE 400 mg',
  '    1 comprimé matin et soir, pendant les repas, pendant 5 jours',
  '3. LISINOPRIL 10 mg',
  '    1 comprimé le matin',
  '4. PARACÉTAMOL 1 000 mg',
  '    1 comprimé 3 fois par jour si douleur',
];

const WIDTH = 1200;
const HEIGHT = 1600;

export async function createDemoImageBlob(): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable');

  // Paper background.
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Header.
  ctx.fillStyle = '#111827';
  ctx.font = 'bold 56px Arial, sans-serif';
  ctx.fillText('ORDONNANCE', 80, 140);
  ctx.font = '36px Arial, sans-serif';
  ctx.fillText('Cabinet médical EXEMPLE — 12 rue de la Démo, 00000 Exemple-ville', 80, 210);
  ctx.fillText('Date : 01/10/2026', 80, 270);

  // Separator.
  ctx.strokeStyle = '#111827';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(80, 320);
  ctx.lineTo(WIDTH - 80, 320);
  ctx.stroke();

  // Medication lines.
  ctx.font = 'bold 44px Arial, sans-serif';
  let y = 420;
  for (const line of MED_LINES) {
    ctx.fillStyle = line.startsWith(' ') ? '#111827' : '#000000';
    ctx.font = line.startsWith(' ') ? '38px Arial, sans-serif' : 'bold 46px Arial, sans-serif';
    ctx.fillText(line, 100, y);
    y += 76;
  }

  // Footer.
  ctx.font = '34px Arial, sans-serif';
  ctx.fillStyle = '#111827';
  ctx.fillText('Signature : Dr EXEMPLE', 80, HEIGHT - 200);

  // Diagonal watermark.
  ctx.save();
  ctx.translate(WIDTH / 2, HEIGHT / 2);
  ctx.rotate(-Math.PI / 6);
  ctx.font = 'bold 110px Arial, sans-serif';
  ctx.fillStyle = 'rgba(100, 116, 139, 0.30)';
  ctx.textAlign = 'center';
  ctx.fillText('EXEMPLE FICTIF', 0, 0);
  ctx.fillText('EXEMPLE FICTIF', 0, 260);
  ctx.fillText('EXEMPLE FICTIF', 0, -260);
  ctx.restore();

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Demo image encoding failed'))),
      'image/jpeg',
      0.9,
    );
  });
}
