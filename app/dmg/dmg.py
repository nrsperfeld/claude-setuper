# Configuração do dmgbuild pro .dmg do Claude Setuper. Recebe por -D: app, fundo, icone, aplicativos e ajustes
# (o nome do atalho pros Ajustes do Sistema, o passo 3). As posições são as do dmg/fundo.py.
# O atalho é pro app inteiro: o macOS não deixa um arquivo do .dmg abrir direto em Privacidade e Segurança.
import os

app = defines['app']  # noqa: F821
nome_app = os.path.basename(app)
aplicativos = defines['aplicativos']  # noqa: F821
nome_ajustes = defines['ajustes']  # noqa: F821

format = 'UDZO'
filesystem = 'HFS+'
files = [app]
symlinks = {aplicativos: '/Applications', nome_ajustes: '/System/Applications/System Settings.app'}
hide_extensions = [nome_app]
icon = defines['icone']  # noqa: F821
background = defines['fundo']  # noqa: F821

window_rect = ((240, 120), (720, 540 + 32))
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
text_size = 12
label_pos = 'bottom'
show_icon_preview = False
icon_locations = {nome_app: (190, 158), aplicativos: (530, 158), nome_ajustes: (628, 418), '.background.tiff': (1100, 120), '.VolumeIcon.icns': (1100, 300)}
