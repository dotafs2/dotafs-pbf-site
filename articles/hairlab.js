// Older article copies also load this script to open the former iframe.
(() => {
  const destination = new URL('/articles/hairlab.html?view=inline', location.href);
  let target = window;
  try {
    if (parent !== window && parent.location.origin === destination.origin &&
        parent.location.pathname === destination.pathname) {
      target = parent;
    }
  } catch {
    // An external embed has its own navigation context.
  }
  destination.hash = target.location.pathname === destination.pathname && target.location.hash
    ? target.location.hash : 'lab';
  target.location.replace(destination.href);
})();
