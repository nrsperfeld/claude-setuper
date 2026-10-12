#!/usr/bin/env node
import { main } from '../src/cli.js';

main(process.argv.slice(2)).catch((e) => {
  console.error('\nDeu um problema que eu não esperava:', e?.message || e);
  console.error('O registro completo está em ~/Claude Setuper/registro.log');
  process.exit(1);
});
