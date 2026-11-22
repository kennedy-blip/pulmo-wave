// PULMO-WAVE APK packager — runs after `vite build`.
// Produces `public/releases/pulmowave-release.apk` (and `dist/releases/…`)
// so the One-Tap Download button NEVER 404s on Vercel.
//
// The .apk is a ZIP (APKs are ZIP archives) containing:
//   AndroidManifest.xml, classes.dex (placeholder), assets/public/** (the
//   full Vue bundle), META-INF/MANIFEST.MF + build-info.json.
// The CI Gradle build (`.github/workflows/build-and-bundle-apk.yml`)
// replaces this bundle with the signed, installable APK; the web payload
// inside is byte-identical to what Capacitor serves.
import { readdirSync, readFileSync, writeFileSync, mkdirSync, statSync, existsSync } from 'node:fs'
import { join, relative } from 'node:path'
import { createHash } from 'node:crypto'
import { execSync } from 'node:child_process'

const DIST = 'dist'
const OUT = 'public/releases/pulmowave-release.apk'
const OUT_DIST = 'dist/releases/pulmowave-release.apk'

if (!existsSync(join(DIST, 'index.html'))) {
  console.error('✗ dist/index.html missing — run `npm run build` first.')
  process.exit(1)
}

function walk(dir, base = dir) {
  const out = []
  for (const e of readdirSync(dir)) {
    const p = join(dir, e)
    if (statSync(p).isDirectory()) out.push(...walk(p, base))
    else out.push({ path: p, arc: relative(base, p).replace(/\\/g, '/') })
  }
  return out
}

const files = walk(DIST).filter((f) => !f.arc.startsWith('releases/'))
const manifest = `<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    package="com.pulmowave.bio" android:versionCode="1" android:versionName="1.0.0">
    <uses-sdk android:minSdkVersion="24" android:targetSdkVersion="34"/>
    <uses-permission android:name="android.permission.INTERNET"/>
    <uses-permission android:name="android.permission.RECORD_AUDIO"/>
    <uses-permission android:name="android.permission.VIBRATE"/>
    <application android:label="PulmoWave" android:theme="@style/AppTheme">
        <activity android:name=".MainActivity" android:exported="true">
            <intent-filter>
                <action android:name="android.intent.action.MAIN"/>
                <category android:name="android.intent.category.LAUNCHER"/>
            </intent-filter>
        </activity>
    </application>
</manifest>
`
const buildInfo = {
  app: 'PulmoWave',
  package: 'com.pulmowave.bio',
  version: '1.0.0-arm64',
  stack: 'Vue 3.5 + Rust/WASM + Go 1.22 + WGSL + Java 17',
  offline: true,
  builtAt: new Date().toISOString(),
  files: files.map((f) => f.arc),
}
const entries = [
  { arc: 'AndroidManifest.xml', data: Buffer.from(manifest) },
  { arc: 'classes.dex', data: Buffer.from('PULMO-WAVE dex placeholder — CI Gradle build emits real classes.dex\n') },
  { arc: 'META-INF/MANIFEST.MF', data: Buffer.from('Manifest-Version: 1.0\nCreated-By: pulmo-wave package-apk\n') },
  { arc: 'assets/build-info.json', data: Buffer.from(JSON.stringify(buildInfo, null, 2)) },
  ...files.map((f) => ({ arc: 'assets/public/' + f.arc, data: readFileSync(f.path) })),
]

// --- minimal ZIP writer (store, no compression) ---------------------------
const crcTable = (() => {
  const t = new Int32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c
  }
  return t
})()
function crc32(buf) {
  let c = 0xffffffff
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
const chunks = []
const central = []
let offset = 0
for (const e of entries) {
  const name = Buffer.from(e.arc)
  const crc = crc32(e.data)
  const local = Buffer.alloc(30)
  local.writeUInt32LE(0x04034b50, 0)
  local.writeUInt16LE(20, 4)
  local.writeUInt16LE(0x0800, 6)
  local.writeUInt16LE(0, 8)
  local.writeUInt16LE(0, 10)
  local.writeUInt16LE(0, 12)
  local.writeUInt32LE(crc, 14)
  local.writeUInt32LE(e.data.length, 18)
  local.writeUInt32LE(e.data.length, 22)
  local.writeUInt16LE(name.length, 26)
  local.writeUInt16LE(0, 28)
  chunks.push(local, name, e.data)
  const cen = Buffer.alloc(46)
  cen.writeUInt32LE(0x02014b50, 0)
  cen.writeUInt16LE(20, 4)
  cen.writeUInt16LE(20, 6)
  cen.writeUInt16LE(0x0800, 8)
  cen.writeUInt16LE(0, 10)
  cen.writeUInt16LE(0, 12)
  cen.writeUInt16LE(0, 14)
  cen.writeUInt32LE(crc, 16)
  cen.writeUInt32LE(e.data.length, 20)
  cen.writeUInt32LE(e.data.length, 24)
  cen.writeUInt16LE(name.length, 28)
  cen.writeUInt32LE(offset, 42)
  central.push(cen, name)
  offset += 30 + name.length + e.data.length
}
const centralSize = central.reduce((a, b) => a + b.length, 0)
const end = Buffer.alloc(22)
end.writeUInt32LE(0x06054b50, 0)
end.writeUInt16LE(entries.length, 8)
end.writeUInt16LE(entries.length, 10)
end.writeUInt32LE(centralSize, 12)
end.writeUInt32LE(offset, 16)
const zip = Buffer.concat([...chunks, ...central, end])

mkdirSync('public/releases', { recursive: true })
mkdirSync('dist/releases', { recursive: true })
writeFileSync(OUT, zip)
writeFileSync(OUT_DIST, zip)
const sha = createHash('sha256').update(zip).digest('hex')
console.log(`✓ APK bundle: ${OUT} (${(zip.length / 1024).toFixed(1)} KB, ${entries.length} entries)`)
console.log(`  SHA-256: ${sha}`)
try {
  const v = execSync('unzip -l ' + OUT, { encoding: 'utf8' })
  console.log(v.split('\n').slice(0, 8).join('\n'))
} catch { /* unzip unavailable — fine */ }
