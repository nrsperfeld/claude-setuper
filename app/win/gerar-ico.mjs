// Junta PNGs quadrados num .ico (o Windows aceita PNG dentro do .ico desde o Vista).
//   node win/gerar-ico.mjs <saída.ico> <16.png> <24.png> ...
import fs from 'node:fs';

const [saida, ...pngs] = process.argv.slice(2);
const imagens = pngs.map((p) => {
  const dados = fs.readFileSync(p);
  if (dados.readUInt32BE(0) !== 0x89504e47) throw new Error(`não é PNG: ${p}`);
  return { lado: dados.readUInt32BE(16), dados };
}).sort((a, b) => a.lado - b.lado);

const cabecalho = Buffer.alloc(6 + 16 * imagens.length);
cabecalho.writeUInt16LE(1, 2);
cabecalho.writeUInt16LE(imagens.length, 4);
let posicao = cabecalho.length;
imagens.forEach(({ lado, dados }, i) => {
  const e = 6 + 16 * i;
  cabecalho[e] = lado >= 256 ? 0 : lado; // 0 quer dizer 256
  cabecalho[e + 1] = lado >= 256 ? 0 : lado;
  cabecalho.writeUInt16LE(1, e + 4);
  cabecalho.writeUInt16LE(32, e + 6);
  cabecalho.writeUInt32LE(dados.length, e + 8);
  cabecalho.writeUInt32LE(posicao, e + 12);
  posicao += dados.length;
});
fs.writeFileSync(saida, Buffer.concat([cabecalho, ...imagens.map((i) => i.dados)]));
