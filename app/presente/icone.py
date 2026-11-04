# Ícone do app do presente: o signo em cobre sobre um quadrado escuro arredondado, na grade dos ícones do macOS
# (corpo de 824 em 1024, com margem pra sombra), em todos os tamanhos do .icns.
#   python icone.py <signo.png> <saida.icns> [<saida-1024.png>]
import subprocess, sys, tempfile, os
from PIL import Image, ImageDraw, ImageFilter, ImageChops

S = 2048  # desenha em dobro e reduz no fim, pra borda ficar lisa
COBRE_ALTO, COBRE_BAIXO = (226, 166, 96), (184, 116, 46)  # em volta do #c8873c


def gradiente(w, h, cima, baixo):
    g = Image.new('RGB', (1, h))
    for y in range(h):
        t = y / max(1, h - 1)
        g.putpixel((0, y), tuple(round(cima[i] + (baixo[i] - cima[i]) * t) for i in range(3)))
    return g.resize((w, h))


def mestre(signo_png):
    k = S / 1024
    tela = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    x0, y0, lado, raio = round(100 * k), round(100 * k), round(824 * k), round(186 * k)
    mascara = Image.new('L', (S, S), 0)
    ImageDraw.Draw(mascara).rounded_rectangle([x0, y0, x0 + lado, y0 + lado], radius=raio, fill=255)

    # Sombra suave embaixo, como a dos ícones do sistema.
    sombra = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    sombra.putalpha(mascara.point(lambda v: v * 0.45))
    sombra = sombra.transform((S, S), Image.AFFINE, (1, 0, 0, 0, 1, -round(12 * k))).filter(ImageFilter.GaussianBlur(22 * k))
    tela = Image.alpha_composite(tela, sombra)

    # Corpo: escuro quente, mais claro em cima, com um brilho de cobre bem leve no alto.
    corpo = gradiente(S, S, (38, 33, 29), (13, 12, 11)).convert('RGBA')
    brilho = Image.new('L', (S, S), 0)
    ImageDraw.Draw(brilho).ellipse([S * 0.12, -S * 0.42, S * 0.88, S * 0.42], fill=44)
    brilho = brilho.filter(ImageFilter.GaussianBlur(160 * k))
    corpo = Image.composite(Image.new('RGBA', (S, S), (200, 135, 60, 255)), corpo, brilho)
    corpo.putalpha(mascara)
    tela = Image.alpha_composite(tela, corpo)

    # Fio de luz na borda de cima (vidro), bem discreto.
    borda = Image.new('L', (S, S), 0)
    d = ImageDraw.Draw(borda)
    d.rounded_rectangle([x0, y0, x0 + lado, y0 + lado], radius=raio, outline=40, width=round(3 * k))
    borda = ImageChops.multiply(borda, gradiente(S, S, (255,) * 3, (0,) * 3).convert('L'))
    tela = Image.alpha_composite(tela, Image.merge('RGBA', (*[Image.new('L', (S, S), 255)] * 3, borda)))

    # Signo: só o desenho (alfa) da imagem, pintado de cobre, centrado no corpo com um respiro ótico.
    sig = Image.open(signo_png).convert('RGBA')
    alfa = sig.getchannel('A')
    bbox = alfa.getbbox()
    alfa = alfa.crop(bbox)
    alto = round(492 * k)
    largo = round(alfa.width * alto / alfa.height)
    alfa = alfa.resize((largo, alto), Image.LANCZOS)
    tinta = gradiente(largo, alto, COBRE_ALTO, COBRE_BAIXO).convert('RGBA')
    tinta.putalpha(alfa)
    cx, cy = x0 + lado / 2, y0 + lado / 2 + 6 * k  # o peso do signo fica embaixo: desce um nada
    tela.alpha_composite(tinta, (round(cx - largo / 2), round(cy - alto / 2)))
    return tela.resize((1024, 1024), Image.LANCZOS)


def main():
    signo, saida = sys.argv[1], sys.argv[2]
    m = mestre(signo)
    if len(sys.argv) > 3:
        m.save(sys.argv[3])
    with tempfile.TemporaryDirectory() as t:
        iconset = os.path.join(t, 'icone.iconset')
        os.mkdir(iconset)
        for base in (16, 32, 128, 256, 512):
            for escala in (1, 2):
                px = base * escala
                nome = f'icon_{base}x{base}{"@2x" if escala == 2 else ""}.png'
                m.resize((px, px), Image.LANCZOS).save(os.path.join(iconset, nome))
        subprocess.run(['iconutil', '-c', 'icns', iconset, '-o', saida], check=True)


if __name__ == '__main__':
    main()
