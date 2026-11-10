// Troca o ícone e o nome do electron.exe sem precisar de Windows nem de Wine, e confere que nada além dos recursos mudou.
//   node win/marcar-exe.mjs <pasta com node_modules/resedit> <exe> <ico> <versão>
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const [ferramentas, exe, ico, versao] = process.argv.slice(2);
const { NtExecutable, NtExecutableResource, Data, Resource } = createRequire(path.join(path.resolve(ferramentas), 'x.js'))('resedit');

// Seção por seção: endereço e conteúdo. O executável só continua válido se o resto ficou onde estava.
function secoes(buffer) {
  const pe = buffer.readUInt32LE(0x3c);
  if (buffer.toString('latin1', pe, pe + 4) !== 'PE\0\0') throw new Error('não é um PE');
  const n = buffer.readUInt16LE(pe + 6);
  const inicio = pe + 24 + buffer.readUInt16LE(pe + 20);
  const lista = [];
  for (let i = 0; i < n; i++) {
    const s = inicio + i * 40;
    const [virt, tamanho, ponteiro] = [buffer.readUInt32LE(s + 12), buffer.readUInt32LE(s + 16), buffer.readUInt32LE(s + 20)];
    lista.push({ nome: buffer.toString('latin1', s, s + 8).replace(/\0+$/, ''), virt, dados: buffer.subarray(ponteiro, ponteiro + tamanho) });
  }
  return lista;
}

const antes = fs.readFileSync(exe);
const programa = NtExecutable.from(antes, { ignoreCert: true });
const recursos = NtExecutableResource.from(programa);
const icone = Data.IconFile.from(fs.readFileSync(ico));

// Fica no mesmo grupo do ícone do Electron: é o primeiro grupo que o Windows mostra pro executável.
const [grupo] = Resource.IconGroupEntry.fromEntries(recursos.entries);
if (!grupo) throw new Error('o electron.exe veio sem ícone');
Resource.IconGroupEntry.replaceIconsForResource(recursos.entries, grupo.id, grupo.lang, icone.icons.map((i) => i.data));

const [info] = Resource.VersionInfo.fromEntries(recursos.entries);
if (!info) throw new Error('o electron.exe veio sem versão');
const lang = info.getAllLanguagesForStringValues()[0];
info.setFileVersion(...versao.split('.').map(Number), 0);
info.setProductVersion(...versao.split('.').map(Number), 0);
info.setStringValues(lang, {
  ProductName: 'Claude Setuper', FileDescription: 'Claude Setuper', OriginalFilename: 'Claude Setuper.exe', InternalName: 'Claude Setuper',
  CompanyName: 'Instituto ELOS', LegalCopyright: 'Instituto ELOS', FileVersion: versao, ProductVersion: versao,
});
info.outputToResourceEntries(recursos.entries);
recursos.outputResource(programa);
const depois = Buffer.from(programa.generate());

const [a, d] = [secoes(antes), secoes(depois)];
if (a.length !== d.length) throw new Error(`o número de seções mudou: ${a.length} para ${d.length}`);
a.forEach((s, i) => {
  if (s.nome !== d[i].nome) throw new Error(`a ordem das seções mudou em ${s.nome}`);
  // O .rsrc muda de propósito. Se ele cresceu, o .reloc anda pra frente: o Windows acha o .reloc pelo diretório do cabeçalho
  // e nada aponta pra dentro dele, então só o conteúdo precisa continuar igual. O resto não pode mudar de endereço nem de conteúdo.
  if (s.nome === '.rsrc') { if (s.virt !== d[i].virt) throw new Error('o .rsrc mudou de lugar'); return; }
  if (s.nome === '.reloc') {
    const dir = (buffer) => { const pe = buffer.readUInt32LE(0x3c); return [buffer.readUInt32LE(pe + 24 + 112 + 5 * 8), buffer.readUInt32LE(pe + 24 + 112 + 5 * 8 + 4)]; };
    const [va, tam] = dir(depois);
    if (va !== d[i].virt || tam !== dir(antes)[1]) throw new Error('o diretório do .reloc não acompanhou');
    if (!s.dados.subarray(0, tam).equals(d[i].dados.subarray(0, tam))) throw new Error('o conteúdo do .reloc mudou');
    return;
  }
  if (s.virt !== d[i].virt) throw new Error(`a seção ${s.nome} mudou de lugar`);
  if (!s.dados.equals(d[i].dados)) throw new Error(`o conteúdo da seção ${s.nome} mudou`);
});
fs.writeFileSync(exe, depois);

// Lê de volta do arquivo gravado, pra não confiar no que estava em memória.
const relido = NtExecutableResource.from(NtExecutable.from(fs.readFileSync(exe), { ignoreCert: true }));
const [v] = Resource.VersionInfo.fromEntries(relido.entries);
const nome = v.getStringValues(lang).ProductName;
if (nome !== 'Claude Setuper') throw new Error(`o nome não gravou: ${nome}`);
console.log(`exe marcado: ${nome} ${versao}, ${icone.icons.length} tamanhos de ícone, ${a.length} seções conferidas`);
