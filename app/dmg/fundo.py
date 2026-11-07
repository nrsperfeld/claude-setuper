# Fundo da janela do .dmg (720x480 e @2x), na identidade do app, com o caminho da primeira abertura desenhado:
# sem conta paga da Apple, o Mac mostra um aviso e o app abre por Ajustes do Sistema, Privacidade e Segurança.
#   python fundo.py pt|en <pasta-de-saída>
import os, subprocess, sys, tempfile
from PIL import Image

CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
L, A = 720, 480
APP_X, LINK_X, ICONE_Y = 190, 530, 170
TEXTOS = {
    'pt': dict(titulo='Arrasta o Claude Setuper pra pasta Aplicativos', sub='Depois é só abrir a pasta Aplicativos e iniciar o programa!', app='Claude Setuper', link='Aplicativos',
               p1='<b>Abre o app.</b> Na primeira vez o Mac mostra um aviso, porque o app é novo. <b>Fecha o aviso.</b>', fechar='Concluído', lixo='Mover para o Lixo',
               p2='Abre <b>Ajustes do Sistema</b>, <b>Privacidade e Segurança</b>, desce até o fim e clica em <b>Abrir Mesmo Assim</b>.', painel='Privacidade e Segurança', abrir='Abrir Mesmo Assim'),
    'en': dict(titulo='Drag Claude Setuper to the Applications folder', sub='Then open the Applications folder and start the app.', app='Claude Setuper', link='Applications',
               p1='<b>Open the app.</b> The first time, your Mac shows a warning because the app is new. <b>Close the warning.</b>', fechar='Done', lixo='Move to Trash',
               p2='Open <b>System Settings</b>, <b>Privacy &amp; Security</b>, scroll to the bottom and click <b>Open Anyway</b>.', painel='Privacy &amp; Security', abrir='Open Anyway'),
}


def pagina(t):
    return f'''<!doctype html><html><head><meta charset="utf-8"><style>
*{{margin:0;box-sizing:border-box}}
html,body{{width:{L}px;height:{A}px;overflow:hidden}}
body{{background:radial-gradient(560px 300px at 50% -60px,rgba(242,166,90,.17),rgba(74,58,140,.08) 60%,transparent 76%),#08080D;font-family:-apple-system,BlinkMacSystemFont,sans-serif;color:#F5F2EC;position:relative}}
h1{{position:absolute;top:22px;width:100%;text-align:center;font-size:21px;font-weight:600;letter-spacing:-.015em}}
h2{{position:absolute;top:54px;width:100%;text-align:center;font-size:13px;font-weight:400;color:#B4B2BC}}
.etiqueta{{position:absolute;top:{ICONE_Y + 70}px;transform:translate(-50%,-50%);font-size:12px;line-height:1;padding:4px 9px;border-radius:99px;color:transparent;background:#E9E6DF;white-space:nowrap}}
.seta{{position:absolute;left:{APP_X + 82}px;top:{ICONE_Y - 2}px;width:{LINK_X - APP_X - 164}px;height:4px;border-radius:2px;background:linear-gradient(90deg,transparent,#B8642E,#F2A65A,#FFF1D6)}}
.seta::after{{content:"";position:absolute;right:-1px;top:-6px;border-left:12px solid #FFF1D6;border-top:8px solid transparent;border-bottom:8px solid transparent}}
.faixa{{position:absolute;left:0;right:0;bottom:0;height:162px;background:#14141C;border-top:1px solid rgba(255,255,255,.1);display:grid;grid-template-columns:1fr 1fr;gap:18px;padding:16px 24px}}
.passo{{display:flex;gap:12px;align-items:center}}
.passo p{{font-size:12.5px;line-height:1.42;color:#B4B2BC}}
.passo p b{{color:#F5F2EC;font-weight:600}}
.aviso{{flex:none;width:96px;padding:10px 8px;border-radius:11px;background:#2A2A33;text-align:center;box-shadow:0 0 0 1px rgba(255,255,255,.09)}}
.barra{{height:4px;border-radius:2px;background:#4A4A55;margin:0 auto 4px}}
.bt{{font-size:8.5px;line-height:1;padding:4px 0;border-radius:5px;margin-top:4px;color:#B4B2BC;background:#3A3A44}}
.bt.m{{background:#F2A65A;color:#160E04;font-weight:700;margin-top:8px;outline:1.5px solid rgba(242,166,90,.6);outline-offset:2px}}
.painel{{flex:none;width:128px;padding:9px;border-radius:10px;background:#2A2A33;box-shadow:0 0 0 1px rgba(255,255,255,.09)}}
.painel .tit{{font-size:8.5px;font-weight:700;color:#D8D6D0;margin-bottom:8px}}
.abrir{{font-size:8.5px;font-weight:700;line-height:1;padding:5px 6px;border-radius:5px;text-align:center;background:#F2A65A;color:#160E04;outline:1.5px solid rgba(242,166,90,.6);outline-offset:2px}}
</style></head><body>
<h1>{t['titulo']}</h1><h2>{t['sub']}</h2>
<div class="etiqueta" style="left:{APP_X}px">{t['app']}</div>
<div class="etiqueta" style="left:{LINK_X}px">{t['link']}</div>
<div class="seta"></div>
<div class="faixa">
<div class="passo"><div class="aviso"><div class="barra" style="width:80%"></div><div class="barra" style="width:60%"></div><div class="bt m">{t['fechar']}</div><div class="bt">{t['lixo']}</div></div><p>{t['p1']}</p></div>
<div class="passo"><div class="painel"><div class="tit">{t['painel']}</div><div class="barra" style="width:100%"></div><div class="barra" style="width:70%;margin-bottom:8px"></div><div class="abrir">{t['abrir']}</div></div><p>{t['p2']}</p></div>
</div></body></html>'''


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
