# Fundo da janela do .dmg (720x480 e @2x): escuro, o signo discreto no alto, a seta em cobre entre o app e
# Aplicativos, etiquetas claras sob os ícones e embaixo a faixa com as duas etapas da primeira abertura
# (o aviso do Mac e o Abrir Mesmo Assim em Privacidade e Segurança, que é o caminho no macOS 15 e mais novos).
# Desenhado em HTML e fotografado pelo Chrome sem janela, com um perfil descartável (não mexe no Chrome aberto).
#   python fundo.py <signo.png> <rótulo> <pasta-de-saída>      -> fundo.png e fundo@2x.png
import base64, os, subprocess, sys, tempfile, html
from PIL import Image

CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
L, A = 720, 480
# Centros dos ícones na janela (os mesmos do dmg.py): o desenho da seta se alinha a eles.
APP_X, LINK_X, ICONE_Y = 190, 530, 180
# Onde o Finder escreve o nome (centro da linha, a partir do centro do ícone de 104) e em que tamanho.
ROTULO_DY, TEXTO_FINDER = 70, 12
FAIXA = 150


def pagina(signo_b64, rotulo):
    mascara = f"-webkit-mask: url(data:image/png;base64,{signo_b64}) center / contain no-repeat; background: linear-gradient(#e2a660, #b8742e);"
    return f'''<!doctype html><html><head><meta charset="utf-8"><style>
* {{ margin: 0; box-sizing: border-box; }}
html, body {{ width: {L}px; height: {A}px; overflow: hidden; }}
body {{ background: radial-gradient(560px 300px at 50% -40px, rgba(200,135,60,.20), transparent 70%), #090807;
  font-family: -apple-system, BlinkMacSystemFont, sans-serif; color: #efe8dc; position: relative; }}
.signo {{ position: absolute; left: 50%; top: 26px; width: 22px; height: 30px; transform: translateX(-50%); {mascara} }}
.rotulo {{ position: absolute; top: 66px; width: 100%; text-align: center; font-size: 10.5px; font-weight: 600;
  letter-spacing: .3em; text-transform: uppercase; color: #c8873c; }}
/* Etiqueta clara onde o Finder escreve o nome do ícone (em preto): o texto dele fica legível e com cara de
   proposital. O texto daqui é transparente, só serve pra etiqueta ter a largura exata do nome. */
.etiqueta {{ position: absolute; top: {ICONE_Y + ROTULO_DY}px; transform: translate(-50%, -50%); white-space: nowrap;
  font-size: {TEXTO_FINDER}px; line-height: 1; padding: 4px 9px; border-radius: 99px; color: transparent;
  background: #d9c5a0; box-shadow: 0 1px 0 rgba(255,255,255,.25) inset, 0 2px 8px rgba(0,0,0,.35); }}
.seta {{ position: absolute; left: {APP_X + 78}px; top: {ICONE_Y - 12}px; }}
.faixa {{ position: absolute; left: 0; right: 0; bottom: 0; height: {FAIXA}px; background: #141210;
  border-top: 1px solid rgba(200,135,60,.22); display: grid; grid-template-columns: 286px 1fr; gap: 22px; padding: 0 26px 6px; align-items: center; }}
.passo {{ display: flex; gap: 13px; align-items: center; }}
.passo p {{ font: 400 13px/1.42 "Iowan Old Style", Palatino, Georgia, serif; color: #e6dfd3; }}
.passo p b {{ color: #d89a52; font-weight: 600; }}
.num {{ font: 600 14px/1 "Iowan Old Style", Palatino, Georgia, serif; color: #c8873c; margin-right: 3px; }}
/* Figura 1: o aviso do Mac na primeira abertura, com o OK marcado. */
.aviso {{ flex: none; width: 96px; padding: 9px 8px 8px; border-radius: 11px; background: #2a2622; text-align: center;
  box-shadow: 0 0 0 1px rgba(255,255,255,.08), 0 6px 16px rgba(0,0,0,.5); }}
.aviso .ic {{ width: 22px; height: 22px; margin: 0 auto 6px; border-radius: 6px; background: linear-gradient(#2f2924, #14110f); position: relative;
  box-shadow: 0 0 0 1px rgba(255,255,255,.08); }}
.aviso .ic i {{ position: absolute; left: 6px; top: 4px; width: 10px; height: 14px; {mascara} }}
.barra {{ height: 4px; border-radius: 2px; background: #4a443d; margin: 0 auto 4px; }}
.bt {{ font-size: 8.5px; line-height: 1; padding: 4px 0; border-radius: 5px; margin-top: 4px; color: #b7afa3; background: #3a352f; }}
.bt.cobre {{ background: #c8873c; color: #140f0a; font-weight: 700; margin-top: 7px; outline: 1.5px solid rgba(216,154,82,.55); outline-offset: 2px; }}
/* Figura 2: a linha do painel Privacidade e Segurança, com o Abrir Mesmo Assim em cobre. */
.painel {{ flex: none; width: 146px; padding: 8px 9px 9px; border-radius: 10px; background: #221f1b;
  box-shadow: 0 0 0 1px rgba(255,255,255,.08), 0 6px 16px rgba(0,0,0,.5); }}
.painel .tit {{ font-size: 8.5px; font-weight: 700; color: #cfc6b8; margin-bottom: 7px; white-space: nowrap; }}
.painel .linha {{ display: flex; align-items: center; gap: 6px; padding: 7px 6px 7px 8px; border-radius: 7px; background: #2d2924; }}
.painel .linha div:first-child {{ flex: 1; }}
.painel .linha .barra {{ margin: 0 0 4px; }}
.painel .abrir {{ flex: none; font-size: 8px; font-weight: 700; line-height: 1; padding: 4.5px 6px; border-radius: 99px; white-space: nowrap;
  background: #c8873c; color: #140f0a; outline: 1.5px solid rgba(216,154,82,.55); outline-offset: 2px; }}
</style></head><body>
<div class="signo"></div>
<div class="rotulo">{html.escape(rotulo)}</div>
<div class="etiqueta" style="left: {APP_X}px">Segundo Cérebro</div>
<div class="etiqueta" style="left: {LINK_X}px">Aplicativos</div>
<svg class="seta" width="{LINK_X - APP_X - 156}" height="24" viewBox="0 0 {LINK_X - APP_X - 156} 24" fill="none">
  <line x1="2" y1="12" x2="{LINK_X - APP_X - 166}" y2="12" stroke="#c8873c" stroke-width="2" stroke-linecap="round" stroke-dasharray="1 7"/>
  <path d="M{LINK_X - APP_X - 170} 4 L{LINK_X - APP_X - 159} 12 L{LINK_X - APP_X - 170} 20" stroke="#c8873c" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
</svg>
<div class="faixa">
  <div class="passo">
    <div class="aviso"><div class="ic"><i></i></div><div class="barra" style="width: 78%"></div><div class="barra" style="width: 56%"></div>
      <div class="bt cobre">OK</div><div class="bt">Mover para o Lixo</div></div>
    <p><span class="num">1.</span>Arraste para Aplicativos e abra o app. Se aparecer um aviso, clique em <b>OK</b>.</p>
  </div>
  <div class="passo">
    <div class="painel"><div class="tit">Privacidade e Segurança</div>
      <div class="linha"><div><div class="barra" style="width: 100%"></div><div class="barra" style="width: 70%"></div></div>
        <div class="abrir">Abrir Mesmo Assim</div></div></div>
    <p><span class="num">2.</span>Abra Ajustes do Sistema, Privacidade e Segurança, e clique em <b>Abrir Mesmo Assim</b>. Depois ele abre direto.</p>
  </div>
</div>
</body></html>'''


def main():
    signo, rotulo, saida = sys.argv[1], sys.argv[2], sys.argv[3]
    os.makedirs(saida, exist_ok=True)
    b64 = base64.b64encode(open(signo, 'rb').read()).decode()
    with tempfile.TemporaryDirectory() as t:
        arq = os.path.join(t, 'fundo.html')
        open(arq, 'w', encoding='utf-8').write(pagina(b64, rotulo))
        for escala, nome in ((1, 'fundo.png'), (2, 'fundo@2x.png')):
            destino = os.path.join(saida, nome)
            subprocess.run([CHROME, '--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run',
                            '--no-default-browser-check', f'--user-data-dir={os.path.join(t, "perfil")}',
                            f'--force-device-scale-factor={escala}', f'--window-size={L},{A}',
                            f'--screenshot={destino}', 'file://' + arq],
                           check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=90)
            img = Image.open(destino)
            if img.size != (L * escala, A * escala):
                img.convert('RGB').crop((0, 0, L * escala, A * escala)).save(destino)
            # Sem o perfil de cor do Chrome, e com 72/144 dpi: o Finder usa o dpi pra saber qual é a de retina.
            Image.open(destino).convert('RGB').save(destino, dpi=(72 * escala, 72 * escala))


if __name__ == '__main__':
    main()
