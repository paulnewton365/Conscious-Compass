// JSZip, loaded on demand and resolved whatever shape the bundler hands back.
//
// A production build can return the constructor as the module namespace, as
// `.default`, or as `.default.default` depending on interop. Calling `new` on
// the wrong one throws a minified "X is not a constructor", which tells the
// person nothing. One resolver, used by every caller.
export async function loadJSZip() {
  let mod;
  try {
    mod = await import('jszip');
  } catch {
    // The chunk's filename changes with every deploy, so a tab left open
    // across one asks the server for a file that no longer exists.
    throw new Error('This page is running an older version of the Compass, so part of it could no longer be loaded. Reload the page and try again.');
  }
  const candidates = [mod?.default?.default, mod?.default, mod?.JSZip, mod];
  const Ctor = candidates.find(c => typeof c === 'function');
  if (!Ctor) throw new Error('The zip library could not be loaded, so the file could not be built. Reload the page and try again.');
  return Ctor;
}
