/**
 * TinyMCE 정적 파일을 public/tinymce 에 복사합니다.
 * node scripts/copy-tinymce.js
 */
const fs = require('fs')
const path = require('path')

const src = path.join(__dirname, '..', 'node_modules', 'tinymce')
const dest = path.join(__dirname, '..', 'public', 'tinymce')

function copyDir(from, to) {
  if (!fs.existsSync(to)) fs.mkdirSync(to, { recursive: true })
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const srcPath = path.join(from, entry.name)
    const destPath = path.join(to, entry.name)
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath)
    } else {
      fs.copyFileSync(srcPath, destPath)
    }
  }
}

copyDir(src, dest)
console.log('TinyMCE 파일이 public/tinymce 에 복사되었습니다.')
