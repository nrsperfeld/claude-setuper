// Os .ps1 que a pessoa baixa e roda direto precisam funcionar dos dois jeitos:
//   irm URL | iex                      -> o texto chega decodificado como UTF-8; a marca BOM no
//                                         começo vira caractere e quebra o primeiro comentário
//   irm URL -OutFile x.ps1; -File x.ps1 -> o PowerShell 5.1 lê arquivo sem BOM como ANSI e
//                                         estraga os acentos
// O único formato que serve aos dois é ASCII puro, com acento escrito como $([char]0x00E9).
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

for (const nome of ['install.ps1', 'fallback-windows.ps1']) {
  test(`${nome} é ASCII puro, sem BOM`, () => {
    const b = fs.readFileSync(path.join(__dirname, '..', nome));
    assert.ok(!(b[0] === 0xef && b[1] === 0xbb && b[2] === 0xbf), `${nome} começa com BOM`);
    const linhas = b.toString('latin1').split('\n');
    const ruins = linhas.map((l, i) => [i + 1, l]).filter(([, l]) => /[^\x00-\x7f]/.test(l));
    assert.deepStrictEqual(ruins.map(([n]) => n), [], `${nome} tem caractere fora do ASCII nas linhas acima`);
  });
}
