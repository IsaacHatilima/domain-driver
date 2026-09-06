// Runs after `npm install` in a consuming project. Never fails the install:
// dist/ may be absent on a fresh clone, and init may throw for any reason.
try {
    require('../dist/postinstall.js').run();
} catch (_error) {
    // intentionally silent
}
