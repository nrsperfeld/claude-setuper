// Ponte entre a tela e o processo principal: só o que a tela precisa, nada mais.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('setuper', {
  aoEvento: (fn) => ipcRenderer.on('ui', (_e, ev) => fn(ev)),
  aoMenu: (fn) => ipcRenderer.on('menu', (_e, acao) => fn(acao)),
  pronto: () => ipcRenderer.send('pronto'),
  iniciar: (modo) => ipcRenderer.send('iniciar', modo),
  responder: (id, valor) => ipcRenderer.send('resposta', { id, valor }),
  abrirLink: (url, app) => ipcRenderer.send('abrir-link', url, app),
  pular: () => ipcRenderer.send('pular'),
  // o código do login do Claude: o texto digitado, ou sem texto pra usar o que estiver copiado
  colarCodigo: (texto) => ipcRenderer.send('codigo-login', texto),
  copiar: (texto) => ipcRenderer.send('copiar', texto),
  abrirClaude: () => ipcRenderer.send('abrir-claude'),
  atualizar: () => ipcRenderer.send('atualizar'),
  mostrarRegistro: () => ipcRenderer.send('mostrar-registro'),
  pedirAjuda: () => ipcRenderer.invoke('pedir-ajuda'),
  print: (nome) => ipcRenderer.invoke('print', nome),
  trocarIdioma: (id) => ipcRenderer.send('trocar-idioma', id),
  portal: () => ipcRenderer.send('portal'),
  concluir: () => ipcRenderer.send('concluir'),
  fechar: () => ipcRenderer.send('fechar'),
  // as setas por cima da tela
  aoSetas: (fn) => ipcRenderer.on('setas', (_e, ev) => fn(ev)),
  // o guia flutuante
  passoGuia: (i) => ipcRenderer.send('guia-passo', i),
  aoGuia: (fn) => ipcRenderer.on('guia', (_e, ev) => fn(ev)),
  guiaPronto: () => ipcRenderer.send('guia-pronto'),
  ajustarGuia: (altura) => ipcRenderer.send('guia-altura', altura),
  acaoGuia: (acao) => ipcRenderer.send('guia-acao', acao),
  aula: (acao) => ipcRenderer.send('aula', acao),
  ligarOpcional: (id) => ipcRenderer.send('ligar-opcional', id),
});
