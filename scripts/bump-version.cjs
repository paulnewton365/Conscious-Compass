const fs = require('fs');
const path = require('path');

const pkgPath = path.join(__dirname, '..', 'package.json');
const appPath = path.join(__dirname, '..', 'src', 'App.jsx');

const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
const parts = pkg.version.split('.');
parts[2] = String(Number(parts[2]) + 1);
pkg.version = parts.join('.');
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');

// Also write version directly into App.jsx so it survives any build cache
let app = fs.readFileSync(appPath, 'utf-8');
app = app.replace(
  /const APP_VERSION = [^;]+;/,
  `const APP_VERSION = '${pkg.version}';`
);
fs.writeFileSync(appPath, app);

console.log('Version bumped to ' + pkg.version);
