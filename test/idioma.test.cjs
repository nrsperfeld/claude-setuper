// Versão em inglês: toda frase do app tem tradução, templates/en espelha templates/ e nada ficou em português.
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const RAIZ = path.join(__dirname, '..');
const TEMPLATES = path.join(RAIZ, 'templates');
const EN = path.join(TEMPLATES, 'en');
const CATALOGO = JSON.parse(fs.readFileSync(path.join(RAIZ, 'src', 'idiomas', 'en.json'), 'utf8'));
const ARQUIVOS_COM_T = ['app/tela/app.js', 'app/tela/guia.js', 'app/aula.js', 'app/main.js', 'app/setas.js'];
// Em templates/en, mas não são template: são recados para quem desenvolve, em português.
const SO_PRA_QUEM_DESENVOLVE = new Set(['NOMES.md', 'FRASES-INTERPOLADAS.md']);
const PORTUGUES = /[ãõçáéíóúâê]/i;
const { spawnSync } = require('node:child_process');
const os = require('node:os');

function listar(dir, base = dir) {
  const achados = [];
  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, item.name);
    if (item.isDirectory()) achados.push(...listar(p, base));
    else achados.push(path.relative(base, p).split(path.sep).join('/'));
  }
  return achados;
}

const caminhosPt = () => listar(TEMPLATES).filter((f) => !f.startsWith('en/'));
const caminhosEn = () => listar(EN).filter((f) => !SO_PRA_QUEM_DESENVOLVE.has(f));

const semEscape = (s) => s.replace(/\\(.)/g, (_, c) => (c === 'n' ? '\n' : c));

// Lê os textos fixos do primeiro argumento de cada t(...): cobre t('a') e também t(cond ? 'a' : 'b').
function chavesDe(codigo) {
  const chaves = [];
  const inicio = /(?:^|[^\w$.])(?:i18n\.)?t\(/g;
  let m;
  while ((m = inicio.exec(codigo))) {
    let i = inicio.lastIndex;
    let fundura = 0;
    while (i < codigo.length) {
      const c = codigo[i];
      if (c === "'" || c === '"') {
        let fim = i + 1;
        while (fim < codigo.length && codigo[fim] !== c) fim += codigo[fim] === '\\' ? 2 : 1;
        // Só o primeiro argumento: o texto de dentro de t(x, { a: 'b' }) é variável, não chave.
        if (fundura === 0) chaves.push(semEscape(codigo.slice(i + 1, fim)));
        i = fim + 1;
        continue;
      }
      if (c === '`') {
        i = codigo.indexOf('`', i + 1) + 1;
        if (i === 0) break;
        continue;
      }
      if (c === '(' || c === '[' || c === '{') fundura++;
      else if (c === ')' || c === ']' || c === '}') {
        if (fundura === 0) break;
        fundura--;
      } else if (c === ',' && fundura === 0) break;
      i++;
    }
  }
  return chaves;
}

test('toda frase de t() no app tem tradução em en.json', () => {
  const faltando = [];
  let vistas = 0;
  for (const rel of ARQUIVOS_COM_T) {
    for (const chave of chavesDe(fs.readFileSync(path.join(RAIZ, rel), 'utf8'))) {
      vistas++;
      if (!Object.hasOwn(CATALOGO, chave)) faltando.push(`${rel}: ${chave}`);
    }
  }
  assert.ok(vistas > 50, `só achei ${vistas} frases: a leitura de t() quebrou`);
  assert.deepStrictEqual(faltando, []);
});

test('as variáveis {assim} são as mesmas na chave e na tradução', () => {
  const vars = (s) => (s.match(/\{\w+\}/g) || []).sort().join(' ');
  const diferentes = Object.entries(CATALOGO).filter(([k, v]) => vars(k) !== vars(v)).map(([k]) => k);
  assert.deepStrictEqual(diferentes, []);
});

test('todo arquivo de templates/ existe em templates/en, com o mesmo caminho', () => {
  const en = new Set(caminhosEn());
  assert.deepStrictEqual(caminhosPt().filter((f) => !en.has(f)), []);
});

test('templates/en não tem arquivo que não existe em templates/', () => {
  const pt = new Set(caminhosPt());
  assert.deepStrictEqual(caminhosEn().filter((f) => !pt.has(f)), []);
});

test('os templates em inglês usam as mesmas variáveis {{assim}}', () => {
  const vars = (rel, raiz) => [...new Set(fs.readFileSync(path.join(raiz, rel), 'utf8').match(/\{\{\w+\}\}/g) || [])].sort();
  for (const rel of caminhosPt()) assert.deepStrictEqual(vars(rel, EN), vars(rel, TEMPLATES), rel);
});

test('os JSON de templates/en são válidos e têm os mesmos ids, chaves e campos de código', () => {
  const jsons = caminhosPt().filter((f) => f.endsWith('.json'));
  assert.ok(jsons.length >= 7);
  for (const rel of jsons) {
    const pt = JSON.parse(fs.readFileSync(path.join(TEMPLATES, rel), 'utf8'));
    const en = JSON.parse(fs.readFileSync(path.join(EN, rel), 'utf8'));
    if (Array.isArray(pt)) {
      assert.deepStrictEqual(en.map((m) => m.id), pt.map((m) => m.id), rel);
      pt.forEach((m, i) => assert.deepStrictEqual(Object.keys(en[i]), Object.keys(m), `${rel} ${m.id}`));
      continue;
    }
    assert.strictEqual(en.id, pt.id, rel);
    assert.deepStrictEqual(Object.keys(en), Object.keys(pt), rel);
    for (const campo of ['ordem', 'pacotes', 'semModulos']) assert.deepStrictEqual(en[campo], pt[campo], `${rel} ${campo}`);
    assert.strictEqual(en.semana.length, pt.semana.length, `${rel} semana`);
    assert.strictEqual(en.wiki.length, pt.wiki.length, `${rel} wiki`);
  }
});

test('os hooks e scripts em inglês usam as pastas e tags em inglês', () => {
  const portugues = /decisões|padrões|descobertas|projetos|fontes|#decisão|#padrão|#descoberta|#projeto|#fonte|processando|processados|Como trabalhar comigo|Comece aqui|Painel do Claude|Nota do Claude|Cardápio/;
  const sobra = caminhosEn().filter((f) => portugues.test(fs.readFileSync(path.join(EN, f), 'utf8')));
  assert.deepStrictEqual(sobra, []);
});

test('nada em português nos valores de en.json', () => {
  const sobra = Object.entries(CATALOGO).filter(([, v]) => PORTUGUES.test(v)).map(([k, v]) => `${k} -> ${v}`);
  assert.deepStrictEqual(sobra, []);
});

test('nada em português nos arquivos de templates/en', () => {
  const sobra = [];
  for (const rel of caminhosEn()) {
    fs.readFileSync(path.join(EN, rel), 'utf8').split('\n').forEach((linha, i) => {
      if (PORTUGUES.test(linha)) sobra.push(`${rel}:${i + 1}: ${linha.trim().slice(0, 120)}`);
    });
  }
  assert.deepStrictEqual(sobra, []);
});

test('instalação em inglês: nenhuma frase em português na tela', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'setuper-en-'));
  const r = spawnSync(process.execPath, [path.join(RAIZ, 'bin', 'claude-setuper.js'), '--sim', '--sem-apps', '--home', home, '--idioma', 'en', '--perfil', 'dia-a-dia'], { encoding: 'utf8' });
  assert.strictEqual(r.status, 0, r.stderr);
  const sobras = r.stdout.split('\n').filter((l) => PORTUGUES.test(l));
  assert.deepStrictEqual(sobras, []);
});

test('texto do app sem os tiques de escrita de IA', () => {
  const TIQUES = /—|não à toa|no fim do dia|trata-se|em suma|vale ressaltar|aterriss|transforma[çr]|jornada|poderos|incrível|mágic|revolucion|superpoder|próximo nível|sem limites/i;
  assert.deepStrictEqual(Object.keys(CATALOGO).filter((k) => TIQUES.test(k)), []);
});
