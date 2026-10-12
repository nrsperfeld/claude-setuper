// exportar: gera um perfil (pasta) com o que o Setuper configurou nesta máquina, sem segredos.
import path from 'node:path';
import fs from 'node:fs';
import { ui } from './ui.js';

export async function exportar(ctx) {
  ui.abertura('Claude Setuper · exportar', 'Gerando um perfil a partir do seu setup atual');
  const dest = path.join(ctx.pastaSetuper, 'perfil-exportado');
  fs.rmSync(dest, { recursive: true, force: true });
  fs.mkdirSync(dest, { recursive: true });

  const copiar = (origem, nome) => {
    if (!fs.existsSync(origem)) return;
    fs.cpSync(origem, path.join(dest, nome), { recursive: true });
  };
  copiar(path.join(ctx.claudeDir, 'CLAUDE.md'), 'CLAUDE.md');
  copiar(path.join(ctx.claudeDir, 'skills'), 'skills');
  copiar(path.join(ctx.claudeDir, 'hooks'), 'hooks');

  // settings sem a parte "env" (é onde moram chaves).
  const s = ctx.lerJson(path.join(ctx.claudeDir, 'settings.json'), null);
  if (s) {
    const { env, ...resto } = s;
    fs.writeFileSync(path.join(dest, 'settings.json'), JSON.stringify(resto, null, 2));
  }
  fs.writeFileSync(path.join(dest, 'respostas.json'), JSON.stringify(ctx.estado.respostas || {}, null, 2));
  const mcps = await ctx.run('claude', ['mcp', 'list'], { ignorarErro: true, sempre: true, timeout: 60000 });
  fs.writeFileSync(path.join(dest, 'mcps.txt'), mcps + '\n');

  ui.ok(`Perfil exportado em ${dest}`);
  ui.encerramento('Sem senhas nem chaves. Pode compartilhar essa pasta.');
}
