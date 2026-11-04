# Configuração do dmgbuild pro .dmg do presente. O .DS_Store (posição dos ícones, fundo, janela sem barra)
# é escrito direto no arquivo, sem abrir o Finder. Recebe por -D: app, fundo, icone.
import os
import unicodedata

app = defines['app']  # noqa: F821 (o dmgbuild injeta "defines")
# No HFS+ o nome fica decomposto (é = e + acento): a posição no .DS_Store só pega com o nome nessa forma.
nome_app = unicodedata.normalize('NFD', os.path.basename(app))

format = 'UDZO'
filesystem = 'HFS+'
files = [app]
symlinks = {'Aplicativos': '/Applications'}
hide_extensions = [nome_app]
icon = defines['icone']  # noqa: F821 (vira o .VolumeIcon.icns)
background = defines['fundo']  # noqa: F821 (fundo.png; o fundo@2x.png ao lado entra junto, pra retina)

# Área de 720x480 (a janela conta a barra de título, 32 pontos), sem barra de ferramentas, lateral, de caminho
# nem de estado.
window_rect = ((240, 140), (720, 480 + 32))
default_view = 'icon-view'
show_status_bar = False
show_tab_view = False
show_toolbar = False
show_pathbar = False
show_sidebar = False
sidebar_width = 0
include_icon_view_settings = True
arrange_by = None
icon_size = 104
# O Finder escreve o nome dos ícones em preto, mesmo no modo escuro: em cima do fundo quase preto ele some, e o
# fundo.py escreve o nome certo, claro, logo abaixo.
text_size = 10
label_pos = 'bottom'
show_icon_preview = False
# Os mesmos centros que o fundo.py usa pra desenhar a seta.
# Os arquivos ocultos ficam fora da janela pra quem deixa o Finder mostrar tudo.
icon_locations = {nome_app: (190, 196), 'Aplicativos': (530, 196), '.background.tiff': (1100, 120), '.VolumeIcon.icns': (1100, 300)}
