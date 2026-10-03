#!/usr/bin/env node
// web/dist(vite build 결과)를 Android 앱 자산 폴더(android/app/src/main/assets/www)로 옮기거나,
// 두 폴더가 같은지 검사한다. OS에 상관없이 Node만 있으면 돈다.
//
//   node scripts/sync-android-assets.mjs           dist → www 동기화 (www를 비우고 다시 채움)
//   node scripts/sync-android-assets.mjs --check   dist와 www가 다르면 목록을 출력하고 exit 1
//
// 앱에 들어가는 것은 www에 커밋된 파일이다. web/을 고치고 www를 다시 만들지 않으면 옛 번들이 그대로
// 출시되므로, `npm run check:android`(빌드 후 --check)로 둘이 같은지 확인한다.
//
// 줄바꿈: Windows 체크아웃(core.autocrlf=true)에서는 소스가 CRLF라 vite가 index.html에 CRLF와
// 짝 없는 CR을 섞어 내놓는다(Linux 빌드는 LF뿐). 그래서 텍스트 파일은 CR을 모두 지워 LF로 맞춰
// 쓰고, 비교할 때도 같은 기준을 쓴다. 이렇게 하면 어느 OS에서 빌드해도 커밋되는 내용이 같다.

import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const webDir = fileURLToPath(new URL('..', import.meta.url));
const distDir = join(webDir, 'dist');
const wwwDir = join(webDir, '..', 'android', 'app', 'src', 'main', 'assets', 'www');
const checkOnly = process.argv.includes('--check');

function listFiles(root) {
  const out = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile()) out.push(relative(root, full).split(sep).join('/'));
    }
  };
  if (existsSync(root)) walk(root);
  return out.sort();
}

// git과 같은 기준으로 NUL 바이트가 있으면 바이너리로 보고 그대로 둔다. 텍스트는 CR을 모두 지운다.
function normalized(file) {
  const buf = readFileSync(file);
  if (buf.includes(0)) return buf;
  return Buffer.from(buf.toString('latin1').replace(/\r/g, ''), 'latin1');
}

if (!existsSync(join(distDir, 'index.html'))) {
  console.error('[sync-android-assets] web/dist/index.html이 없습니다. 먼저 vite build를 실행하세요.');
  process.exit(1);
}

const distFiles = listFiles(distDir);

if (checkOnly) {
  const wwwFiles = listFiles(wwwDir);
  const inWww = new Set(wwwFiles);
  const inDist = new Set(distFiles);
  const problems = [];
  for (const f of distFiles) {
    if (!inWww.has(f)) problems.push(`  www에 없음  : ${f}`);
    else if (!normalized(join(distDir, f)).equals(normalized(join(wwwDir, f)))) problems.push(`  내용 다름   : ${f}`);
  }
  for (const f of wwwFiles) {
    if (!inDist.has(f)) problems.push(`  www에만 있음: ${f}`);
  }
  if (problems.length) {
    console.error('[sync-android-assets] android/app/src/main/assets/www가 지금 web/ 소스의 빌드 결과와 다릅니다:');
    console.error(problems.join('\n'));
    console.error('→ web/에서 `npm run build:android`를 실행하고 assets/www 변경을 함께 커밋하세요.');
    process.exit(1);
  }
  console.log(`[sync-android-assets] OK — assets/www가 빌드 결과와 같습니다 (${distFiles.length}개 파일).`);
} else {
  rmSync(wwwDir, { recursive: true, force: true });
  for (const f of distFiles) {
    const dest = join(wwwDir, f);
    mkdirSync(dirname(dest), { recursive: true });
    writeFileSync(dest, normalized(join(distDir, f)));
  }
  console.log(`[sync-android-assets] dist → android/app/src/main/assets/www (${distFiles.length}개 파일)`);
}
