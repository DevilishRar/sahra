import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WEB = path.resolve(__dirname, '..');
const ROOT = path.resolve(WEB, '..');
const VENDOR = path.join(WEB, 'public', 'vendor', 'mp');
const VITE = path.join(WEB, 'node_modules', 'vite', 'bin', 'vite.js');
const OUT_INDEX = path.join(ROOT, 'sahra-offline.html');
const OUT_CORE = path.join(ROOT, 'sahra-core-offline.html');

const read = (p) => fs.readFileSync(p, 'utf8');
const b64 = (p) => fs.readFileSync(p).toString('base64');
const safeScript = (s) => s.replace(/<\/script/gi, '<\\/script');

const vendorFiles = {
  'face_mesh.binarypb': path.join(VENDOR, 'face_mesh.binarypb'),
  'face_mesh_solution_packed_assets.data': path.join(VENDOR, 'face_mesh_solution_packed_assets.data'),
  'face_mesh_solution_packed_assets_loader.js': path.join(VENDOR, 'face_mesh_solution_packed_assets_loader.js'),
  'face_mesh_solution_simd_wasm_bin.js': path.join(VENDOR, 'face_mesh_solution_simd_wasm_bin.js'),
  'face_mesh_solution_simd_wasm_bin.wasm': path.join(VENDOR, 'face_mesh_solution_simd_wasm_bin.wasm'),
  'motorsirene-feuerwehralarm.ogg': path.join(WEB, 'public', 'audio', 'motorsirene-feuerwehralarm.ogg'),
  'nfpa-fire-alarm.ogg': path.join(WEB, 'public', 'audio', 'nfpa-fire-alarm.ogg'),
  'addiction.mp3': path.join(WEB, 'public', 'audio-artists', 'addiction.mp3'),
  'addiction-bass-boosted.mp3': path.join(WEB, 'public', 'audio-artists', 'addiction-bass-boosted.mp3'),
};

const embedded = `(() => {\nconst embedded = {\n${Object.entries(vendorFiles).map(([name, file]) => `  "${name}": "${b64(file)}",`).join('\n')}\n};\nconst urls = {};\nfunction decode(s) {\n  const bin = atob(s);\n  const bytes = new Uint8Array(bin.length);\n  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);\n  return bytes;\n}\nfor (const [name, data] of Object.entries(embedded)) {\n  const bytes = decode(data);\n  const type = name.endsWith('.wasm') ? 'application/wasm' : name.endsWith('.js') ? 'application/javascript' : name.endsWith('.ogg') ? 'audio/ogg' : name.endsWith('.mp3') ? 'audio/mpeg' : 'application/octet-stream';\n  urls[name] = URL.createObjectURL(new Blob([bytes], { type }));\n}\nwindow.__SAHRA_STANDALONE__ = true;\nwindow.__SAHRA_URLS__ = urls;\n})();`;

function buildEntry(name, outDir) {
  const abs = path.join(WEB, outDir);
  fs.rmSync(abs, { recursive: true, force: true });
  execFileSync(process.execPath, [VITE, 'build', '--outDir', outDir, '--emptyOutDir'], {
    cwd: WEB,
    env: { ...process.env, SAHRA_ENTRY: name },
    stdio: 'inherit',
  });
  return path.join(abs, name === 'index' ? 'index.html' : 'core.html');
}

function inlineVendor(html, target = 'index') {
  let out = html
    .replace(/<link rel="modulepreload"[^>]*>\s*/g, '')
    .replace(/<link rel="icon"[^>]*>\s*/g, '')
    .replace(/<link rel="apple-touch-icon"[^>]*>\s*/g, '')
    .replace(/<link rel="manifest"[^>]*>\s*/g, '')
    .replace(/<script src="\.\/vendor\/mp\/face_mesh\.js" defer><\/script>/g, () => `<script>${embedded}</script>\n<script>${safeScript(read(path.join(VENDOR, 'face_mesh.js')))}</script>`);
  
  if (target === 'index') {
    out = out.split('core.html').join('sahra-core-offline.html');
  } else {
    out = out.split('index.html').join('sahra-offline.html');
  }
  return out;
}

const indexHtml = inlineVendor(read(buildEntry('index', '../.standalone-index')), 'index');
const coreHtml = inlineVendor(read(buildEntry('core', '../.standalone-core')), 'core');
fs.writeFileSync(OUT_INDEX, indexHtml);
fs.writeFileSync(OUT_CORE, coreHtml);
fs.rmSync(path.join(WEB, '../.standalone-index'), { recursive: true, force: true });
fs.rmSync(path.join(WEB, '../.standalone-core'), { recursive: true, force: true });
console.log(`wrote ${OUT_INDEX} ${(indexHtml.length / 1024 / 1024).toFixed(1)} MB`);
console.log(`wrote ${OUT_CORE} ${(coreHtml.length / 1024 / 1024).toFixed(1)} MB`);
