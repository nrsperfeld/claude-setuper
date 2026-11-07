# Configuração do dmgbuild pro .dmg do Claude Setuper. Recebe por -D: app, fundo, icone, aplicativos.
import os

app = defines['app']  # noqa: F821
nome_app = os.path.basename(app)
aplicativos = defines['aplicativos']  # noqa: F821

format = 'UDZO'
filesystem = 'HFS+'
files = [app]
symlinks = {aplicativos: '/Applications'}
hide_extensions = [nome_app]
icon = defines['icone']  # noqa: F821
background = defines['fundo']  # noqa: F821

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
text_size = 12
label_pos = 'bottom'
show_icon_preview = False
icon_locations = {nome_app: (190, 170), aplicativos: (530, 170), '.background.tiff': (1100, 120), '.VolumeIcon.icns': (1100, 300)}
