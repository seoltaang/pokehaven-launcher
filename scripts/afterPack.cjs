// electron-builder afterPack hook: ad-hoc sign the macOS app.
//
// We ship unsigned (no Apple Developer account), but Apple Silicon refuses to
// run an app with no signature at all ("the application is damaged"). An ad-hoc
// signature (codesign --sign -) makes it runnable; users still right-click → Open
// (or `xattr -cr` the .app) to clear the download quarantine the first time.
const { execFileSync } = require('node:child_process');
const path = require('node:path');

exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== 'darwin') return;
  const appName = context.packager.appInfo.productFilename;
  const appPath = path.join(context.appOutDir, `${appName}.app`);
  const bundledNode = path.join(appPath, 'Contents', 'Resources', 'node', 'node');

  // Sign the bundled Node binary first, then the whole bundle (outer last).
  execFileSync('codesign', ['--force', '--sign', '-', bundledNode], { stdio: 'inherit' });
  execFileSync('codesign', ['--force', '--deep', '--sign', '-', appPath], { stdio: 'inherit' });
  console.log('[afterPack] ad-hoc signed', appPath);
};
