import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import bundled from '../catalog/bundled.json';
import { iconPath } from '../src/domain';

const asset = (path: string) => readFileSync(new URL(`../public${path}`, import.meta.url));
const sha256 = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');

function webpSize(bytes: Buffer) {
  expect(bytes.toString('ascii', 0, 4)).toBe('RIFF');
  expect(bytes.toString('ascii', 8, 12)).toBe('WEBP');
  const chunk = bytes.toString('ascii', 12, 16);
  if (chunk === 'VP8 ') {
    expect(bytes.subarray(23, 26)).toEqual(Buffer.from([0x9d, 0x01, 0x2a]));
    return { width: bytes.readUInt16LE(26) & 0x3fff, height: bytes.readUInt16LE(28) & 0x3fff };
  }
  if (chunk === 'VP8L') {
    const bits = bytes.readUInt32LE(21);
    return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
  }
  expect(chunk).toBe('VP8X');
  return { width: bytes.readUIntLE(24, 3) + 1, height: bytes.readUIntLE(27, 3) + 1 };
}

function pngSize(bytes: Buffer) {
  expect(bytes.subarray(0, 8)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47, 13, 10, 26, 10]));
  expect(bytes.toString('ascii', 12, 16)).toBe('IHDR');
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

describe('arte local dos produtos', () => {
  it('cada produto do catálogo resolve para uma imagem local e válida, sem rede', () => {
    for (const app of bundled.apps) {
      const path = iconPath(app);
      expect(path, app.id).toMatch(/^\/assets\/[a-z0-9-]+\.(webp|svg)$/);
      const bytes = asset(path);
      if (path.endsWith('.webp')) {
        const { width, height } = webpSize(bytes);
        expect(width, app.id).toBe(height);
        expect(width, app.id).toBeGreaterThanOrEqual(256);
      } else {
        expect(bytes.toString('utf8'), app.id).toContain('<svg');
      }
    }
  });

  // A arte aprovada vem da identidade visual do GeoSPT (docs/LINUX.md). Uma revisão nova
  // deve trocar estes valores junto com a origem documentada, nunca por acidente.
  it('GeoSPT mantém a arte aprovada de Atena na biblioteca e no atalho Linux', () => {
    const app = bundled.apps.find((item) => item.id === 'geosptstruct')!;
    expect(app.icon).toBe('openstruct-mark');
    const library = asset(iconPath(app));
    expect(webpSize(library)).toEqual({ width: 768, height: 768 });
    expect(sha256(library)).toBe(
      'd7a1f12f700d984617bc45f8506b3f2f7eb502ad4168caa2e7b9374bbaa26436',
    );
    const shortcut = asset('/assets/desktop/geosptstruct.png');
    expect(pngSize(shortcut)).toEqual({ width: 256, height: 256 });
    expect(sha256(shortcut)).toBe(
      '1d7293f41e00e1761342cd8817100f878730dbb0059ccda59ba7ba408131df43',
    );
    expect(shortcut).not.toEqual(asset('/assets/desktop/launcher.png'));
  });
});
