// Generate build/icon.{png,ico,icns} from build/icon.svg.
// Run once after editing the SVG; the outputs are committed and used by
// electron-builder (the resvg/png2icons deps are only needed to regenerate).
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Resvg } from '@resvg/resvg-js';
import png2icons from 'png2icons';

const dir = join(process.cwd(), 'build');
const svg = readFileSync(join(dir, 'icon.svg'));
const png = new Resvg(svg, { fitTo: { mode: 'width', value: 1024 } }).render().asPng();
writeFileSync(join(dir, 'icon.png'), png);
writeFileSync(join(dir, 'icon.ico'), png2icons.createICO(png, png2icons.BICUBIC, 0, false));
writeFileSync(join(dir, 'icon.icns'), png2icons.createICNS(png, png2icons.BICUBIC, 0));
console.log('wrote build/icon.png, icon.ico, icon.icns');
