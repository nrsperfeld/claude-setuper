# Fundo da janela do .dmg (720x540 e @2x), na identidade do app, com o caminho da primeira abertura desenhado:
# sem conta paga da Apple, o Mac mostra um aviso e o app abre por Ajustes do Sistema, Privacidade e Segurança.
#   python fundo.py pt|en <pasta-de-saída>
import os, subprocess, sys, tempfile
from PIL import Image

CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
L, A = 720, 540
# Onde o Finder põe cada ícone (centro, em pontos). O dmg.py usa os mesmos números.
APP_X, LINK_X, ICONE_Y = 190, 530, 158
AJUSTES_X, AJUSTES_Y = 628, 418
TEXTOS = {
    'pt': dict(titulo='Arrasta o Claude Setuper pra pasta Aplicativos', app='Claude Setuper', link='Aplicativos', ajustes='Ajustes do Sistema',
               p2='<b>Abre o Claude Setuper</b> na pasta Aplicativos. Na primeira vez o Mac mostra um aviso, porque o app é novo. Clica em <b>Concluído</b>.', fechar='Concluído', lixo='Mover para o Lixo',
               p3='<b>Abre os Ajustes</b> aqui do lado e clica em <b>Privacidade e Segurança</b>, na lista da esquerda. Desce até o fim e clica em <b>Abrir Mesmo Assim</b>.'),
    'en': dict(titulo='Drag Claude Setuper to the Applications folder', app='Claude Setuper', link='Applications', ajustes='System Settings',
               p2='<b>Open Claude Setuper</b> from the Applications folder. The first time, your Mac shows a warning because the app is new. Click <b>Done</b>.', fechar='Done', lixo='Move to Trash',
               p3='<b>Open Settings</b> right here and click <b>Privacy &amp; Security</b> in the list on the left. Scroll to the bottom and click <b>Open Anyway</b>.'),
}


def pagina(t):
    return f'''<!doctype html><html><head><meta charset="utf-8"><style>
*{{margin:0;box-sizing:border-box}}
html,body{{width:{L}px;height:{A}px;overflow:hidden}}
body{{background:radial-gradient(560px 300px at 50% -60px,rgba(242,166,90,.17),rgba(74,58,140,.08) 60%,transparent 76%),#08080D;font-family:-apple-system,BlinkMacSystemFont,sans-serif;color:#F5F2EC;position:relative}}
.num{{flex:none;width:24px;height:24px;border-radius:50%;background:#F2A65A;color:#160E04;font-size:13px;font-weight:700;display:flex;align-items:center;justify-content:center}}
h1{{position:absolute;top:24px;width:100%;display:flex;gap:10px;align-items:center;justify-content:center;font-size:20px;font-weight:600;letter-spacing:-.015em}}
.etiqueta{{position:absolute;transform:translate(-50%,-50%);font-size:12px;line-height:1;padding:4px 9px;border-radius:99px;color:transparent;background:#E9E6DF;white-space:nowrap}}
.seta{{position:absolute;left:{APP_X + 82}px;top:{ICONE_Y - 2}px;width:{LINK_X - APP_X - 164}px;height:4px;border-radius:2px;background:linear-gradient(90deg,transparent,#B8642E,#F2A65A,#FFF1D6)}}
.seta::after{{content:"";position:absolute;right:-1px;top:-6px;border-left:12px solid #FFF1D6;border-top:8px solid transparent;border-bottom:8px solid transparent}}
.faixa{{position:absolute;left:0;right:0;bottom:0;height:262px;background:#14141C;border-top:1px solid rgba(255,255,255,.1)}}
.passo{{position:absolute;top:24px;display:flex;gap:12px;align-items:flex-start}}
.passo p{{font-size:13px;line-height:1.45;color:#B4B2BC}}
.passo p b{{color:#F5F2EC;font-weight:600}}
.aviso{{width:124px;margin-top:14px;padding:12px 10px;border-radius:12px;background:#2A2A33;text-align:center;box-shadow:0 0 0 1px rgba(255,255,255,.09)}}
.barra{{height:4px;border-radius:2px;background:#4A4A55;margin:0 auto 5px}}
.bt{{font-size:10px;line-height:1;padding:5px 0;border-radius:6px;margin-top:5px;color:#8A8892;background:#3A3A44}}
.bt.m{{background:#F2A65A;color:#160E04;font-weight:700;margin-top:9px;outline:1.5px solid rgba(242,166,90,.6);outline-offset:2px}}
.alvo{{position:absolute;left:{AJUSTES_X - 58}px;top:{AJUSTES_Y - 60 - (A - 262)}px;width:116px;height:116px;border-radius:24px;border:1.5px dashed rgba(242,166,90,.55)}}
</style></head><body>
<h1><span class="num">1</span>{t['titulo']}</h1>
<div class="etiqueta" style="left:{APP_X}px;top:{ICONE_Y + 70}px">{t['app']}</div>
<div class="etiqueta" style="left:{LINK_X}px;top:{ICONE_Y + 70}px">{t['link']}</div>
<div class="seta"></div>
<div class="faixa">
<div class="passo" style="left:28px;width:300px"><span class="num">2</span><div><p>{t['p2']}</p><div class="aviso"><div class="barra" style="width:80%"></div><div class="barra" style="width:60%"></div><div class="bt m">{t['fechar']}</div><div class="bt">{t['lixo']}</div></div></div></div>
<div class="passo" style="left:362px;width:186px"><span class="num">3</span><p>{t['p3']}</p></div>
<div class="alvo"></div>
</div>
<div class="etiqueta" style="left:{AJUSTES_X}px;top:{AJUSTES_Y + 70}px">{t['ajustes']}</div>
</body></html>'''


def main():
    idioma, saida = sys.argv[1], sys.argv[2]
    os.makedirs(saida, exist_ok=True)
    with tempfile.TemporaryDirectory() as t:
        arq = os.path.join(t, 'fundo.html')
        open(arq, 'w', encoding='utf-8').write(pagina(TEXTOS[idioma]))
        for escala, nome in ((1, 'fundo.png'), (2, 'fundo@2x.png')):
            destino = os.path.join(saida, nome)
            subprocess.run([CHROME, '--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run', '--no-default-browser-check', f'--user-data-dir={os.path.join(t, "perfil")}', f'--force-device-scale-factor={escala}', f'--window-size={L},{A}', f'--screenshot={destino}', 'file://' + arq], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=120)
            img = Image.open(destino)
            if img.size != (L * escala, A * escala):
                img = img.convert('RGB').crop((0, 0, L * escala, A * escala))
            img.convert('RGB').save(destino, dpi=(72 * escala, 72 * escala))


if __name__ == '__main__':
    main()
