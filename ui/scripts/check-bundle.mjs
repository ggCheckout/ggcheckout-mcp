// Fails the build when app.html would need the network (the host sandbox has none) or grows past
// what a host should be asked to load as one resource.
import { readFileSync } from 'node:fs';

const file = new URL('../../dist/views/app.html', import.meta.url);
const html = readFileSync(file, 'utf8');
const LIMIT_BYTES = 1_500_000;

const external = [
  /<script[^>]+\bsrc=/i,
  /<link[^>]+rel=["']?stylesheet[^>]+href=/i,
  /\b(?:src|href)=["']?(?:https?:)?\/\//i,
  /url\(\s*["']?(?:https?:)?\/\//i,
].filter((pattern) => pattern.test(html));

if (external.length) {
  console.error(`app.html loads something from outside: ${external.join(', ')}`);
  process.exit(1);
}
if (html.length > LIMIT_BYTES) {
  console.error(`app.html has ${html.length} bytes, over the ${LIMIT_BYTES} limit`);
  process.exit(1);
}
console.log(`app.html: ${(html.length / 1024).toFixed(0)} KB, self-contained`);
