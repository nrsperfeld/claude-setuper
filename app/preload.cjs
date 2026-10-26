// Ponte entre a tela e o processo principal: só o que a tela precisa, nada mais.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('setuper', {
  aoEvento: (fn) => ipcRenderer.on('ui', (_e, ev) => fn(ev)),
  pronto: () => ipcRenderer.send('pronto'),
  iniciar: (modo) => ipcRenderer.send('iniciar', modo),
  responder: (id, valor) => ipcRenderer.send('resposta', { id, valor }),
  abrirLink: (url, app) => ipcRenderer.send('abrir-link', url, app),
  pular: () => ipcRenderer.send('pular'),
  copiar: (texto) => ipcRenderer.send('copiar', texto),
  abrirClaude: () => ipcRenderer.send('abrir-claude'),
  atualizar: () => ipcRenderer.send('atualizar'),
  mostrarRegistro: () => ipcRenderer.send('mostrar-registro'),
  pedirAjuda: () => ipcRenderer.invoke('pedir-ajuda'),
  print: (nome) => ipcRenderer.invoke('print', nome),
});
