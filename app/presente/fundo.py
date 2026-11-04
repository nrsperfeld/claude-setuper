# Fundo da janela do .dmg (720x480 e @2x): escuro, o signo discreto no alto, a seta em cobre entre o app e
# Aplicativos, e embaixo a faixa com o desenho do clique com o botão direito e o recado de como abrir.
# Desenhado em HTML e fotografado pelo Chrome sem janela, com um perfil descartável (não mexe no Chrome aberto).
#   python fundo.py <signo.png> <rótulo> <pasta-de-saída>      -> fundo.png e fundo@2x.png
import base64, os, subprocess, sys, tempfile, html
from PIL import Image

CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
L, A = 720, 480
# Centros dos ícones na janela (os mesmos do dmg.py): o desenho da seta se alinha a eles.
APP_X, LINK_X, ICONE_Y = 190, 530, 196


def pagina(signo_b64, rotulo):
    return f'''<!doctype html><html><head><meta charset="utf-8"><style>
* {{ margin: 0; box-sizing: border-box; }}
html, body {{ width: {L}px; height: {A}px; overflow: hidden; }}
body {{ background: radial-gradient(560px 300px at 50% -40px, rgba(200,135,60,.20), transparent 70%), #090807;
  font-family: -apple-system, BlinkMacSystemFont, sans-serif; color: #efe8dc; position: relative; }}
.signo {{ position: absolute; left: 50%; top: 30px; width: 22px; height: 30px; transform: translateX(-50%);
  -webkit-mask: url(data:image/png;base64,{signo_b64}) center / contain no-repeat;
  background: linear-gradient(#e2a660, #b8742e); }}
.rotulo {{ position: absolute; top: 72px; width: 100%; text-align: center; font-size: 10.5px; font-weight: 600;
  letter-spacing: .3em; text-transform: uppercase; color: #c8873c; }}
.nome {{ position: absolute; top: {ICONE_Y + 76}px; width: 200px; margin-left: -100px; text-align: center;
  font-size: 13px; font-weight: 500; color: #ece5d9; letter-spacing: .01em; }}
.seta {{ position: absolute; left: {APP_X + 78}px; top: {ICONE_Y - 12}px; }}
.faixa {{ position: absolute; left: 0; right: 0; bottom: 0; height: 132px; background: #141210;
  border-top: 1px solid rgba(200,135,60,.22); display: flex; align-items: center; gap: 30px; padding: 0 48px 14px; }}
.figura {{ position: relative; width: 258px; height: 84px; flex: none; }}
.app-mini {{ position: absolute; left: 0; top: 18px; width: 52px; height: 52px; border-radius: 12px;
  background: linear-gradient(#2a241f, #110f0d); box-shadow: 0 0 0 1px rgba(255,255,255,.07), 0 4px 10px rgba(0,0,0,.5); }}
.signo-mini {{ position: absolute; left: 15px; top: 10px; width: 22px; height: 32px;
  -webkit-mask: url(data:image/png;base64,{signo_b64}) center / contain no-repeat; background: linear-gradient(#e2a660, #b8742e); }}
.cursor {{ position: absolute; left: 38px; top: 46px; filter: drop-shadow(0 1px 2px rgba(0,0,0,.6)); }}
.menu {{ position: absolute; left: 64px; top: 2px; width: 194px; padding: 5px; border-radius: 9px; background: #27231f;
  box-shadow: 0 0 0 1px rgba(255,255,255,.08), 0 8px 22px rgba(0,0,0,.55); font-size: 11.5px; color: #a39b8f; }}
.menu .item {{ padding: 2.5px 9px; border-radius: 4px; line-height: 15px; white-space: nowrap; }}
.menu .item.ativo {{ background: #c8873c; color: #140f0a; font-weight: 600; }}
.menu .sep {{ height: 1px; margin: 4px 9px; background: rgba(255,255,255,.09); }}
.texto {{ font: 400 17px/1.45 "Iowan Old Style", Palatino, Georgia, serif; color: #e6dfd3; max-width: 330px; }}
.texto b {{ color: #d89a52; font-weight: 600; }}
</style></head><body>
<div class="signo"></div>
<div class="rotulo">{html.escape(rotulo)}</div>
<div class="nome" style="left: {APP_X}px">Segundo Cérebro</div>
<div class="nome" style="left: {LINK_X}px">Aplicativos</div>
<svg class="seta" width="{LINK_X - APP_X - 156}" height="24" viewBox="0 0 {LINK_X - APP_X - 156} 24" fill="none">
  <line x1="2" y1="12" x2="{LINK_X - APP_X - 166}" y2="12" stroke="#c8873c" stroke-width="2" stroke-linecap="round" stroke-dasharray="1 7"/>
  <path d="M{LINK_X - APP_X - 170} 4 L{LINK_X - APP_X - 159} 12 L{LINK_X - APP_X - 170} 20" stroke="#c8873c" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
</svg>
<div class="faixa">
  <div class="figura">
    <div class="app-mini"><div class="signo-mini"></div></div>
    <svg class="cursor" width="22" height="28" viewBox="0 0 22 28"><path d="M2 2 L2 22 L7 17.5 L10.5 25 L14 23.5 L10.6 16.2 L17 16 Z" fill="#f4efe6" stroke="#0d0c0b" stroke-width="1.4" stroke-linejoin="round"/></svg>
    <div class="menu">
      <div class="item ativo">Abrir</div>
      <div class="item">Mostrar Conteúdo do Pacote</div>
      <div class="sep"></div>
      <div class="item">Mover para o Lixo</div>
    </div>
  </div>
  <p class="texto">Na primeira vez, clique com o botão direito no app e escolha <b>Abrir</b>.</p>
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
