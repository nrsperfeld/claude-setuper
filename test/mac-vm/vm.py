#!/usr/bin/env python3
"""Testa o Claude Setuper num macOS zerado, numa VM do tart, do jeito que a cliente roda.

  python3 test/mac-vm/vm.py rodar [--perfil X]   # VM nova a partir da limpa, instala tudo, confere e grava o log
  python3 test/mac-vm/vm.py rodar-app [--perfil X]   # o mesmo, pelo app (app/dist/Claude-Setuper-mac-arm64.zip)
  python3 test/mac-vm/vm.py shell     # abre um terminal na VM de teste que ainda estiver ligada
  python3 test/mac-vm/vm.py desligar

O que é simulado (precisa de pessoa ou de conta real):
  - o clique em "Instalar" das ferramentas da Apple: instalamos pelo softwareupdate enquanto o Setuper espera
  - a senha do Mac: digitada quando aparece "Password:"
  - as perguntas do assistente: Enter no padrão, "Teste" no nome
  - os logins (Claude, GitHub, Vercel): conferimos que abrem sem erro e encerramos depois de alguns segundos
"""
import fcntl, json, os, pty, re, struct, termios, select, subprocess, sys, tempfile, threading, time

TART = os.path.expanduser('~/Projects/.tools/tart/tart.app/Contents/MacOS/tart')
BASE = 'tahoe-limpo'
VM = 'setuper-teste'
SENHA = 'admin'
RAIZ = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
LOGS = os.path.join(RAIZ, 'test', 'mac-vm', 'logs')
IDADE = os.environ.get('SETUPER_IDADE', '52').encode()  # SETUPER_IDADE=15 testa o caminho de menor de idade
ESPERA_LOGIN = int(os.environ.get('ESPERA_LOGIN', '20'))  # no app, 45: dá tempo do código aparecer na tela
LOGINS = ['claude auth login', 'gh auth login', 'vercel login']

ASKPASS = os.path.join(tempfile.gettempdir(), 'setuper-vm-askpass.sh')
with open(ASKPASS, 'w') as f:
    f.write(f'#!/bin/sh\necho {SENHA}\n')
os.chmod(ASKPASS, 0o700)
SSH_ENV = {**os.environ, 'TERM': 'xterm-256color', 'SSH_ASKPASS': ASKPASS, 'SSH_ASKPASS_REQUIRE': 'force', 'DISPLAY': ':0'}
SSH_OPTS = ['-o', 'StrictHostKeyChecking=no', '-o', 'UserKnownHostsFile=/dev/null', '-o', 'LogLevel=ERROR',
            '-o', 'PreferredAuthentications=password,keyboard-interactive', '-o', 'ServerAliveInterval=30', '-o', 'ConnectTimeout=15']


def tart(*args, **kw):
    return subprocess.run([TART, *args], capture_output=True, text=True, **kw)


def ip():
    r = tart('ip', VM, '--wait', '180')
    if r.returncode:
        sys.exit(f'VM sem IP: {r.stderr}')
    return r.stdout.strip()


def ssh(endereco, cmd, timeout=600, entrada=None):
    r = subprocess.run(['ssh', *SSH_OPTS, f'admin@{endereco}', cmd], capture_output=True, text=True,
                       env=SSH_ENV, timeout=timeout, input=entrada, stdin=None if entrada is not None else subprocess.DEVNULL)
    return r.returncode, (r.stdout + r.stderr).strip()


def ligar_vm_nova():
    tart('stop', VM)
    tart('delete', VM)
    r = tart('clone', BASE, VM)
    if r.returncode:
        sys.exit(f'clone falhou: {r.stderr}')
    # Com a VM do Windows ligada ao mesmo tempo, a de 8 GB faz o Mac de 16 GB entrar em swap.
    if os.environ.get('VM_MEMORIA'):
        tart('set', VM, '--memory', os.environ['VM_MEMORIA'])
    subprocess.Popen([TART, 'run', VM, '--no-graphics'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, start_new_session=True)
    endereco = ip()
    for _ in range(60):
        try:
            if ssh(endereco, 'true', timeout=20)[0] == 0:
                return endereco
        except subprocess.TimeoutExpired:
            pass  # a VM ainda está ligando o SSH
        time.sleep(3)
    sys.exit('SSH não respondeu')


def copiar_setuper(endereco):
    tar = subprocess.run(['tar', '-cz', '--exclude', 'node_modules', '--exclude', '.git', '--exclude', 'test/mac-vm/logs',
                          '--exclude', 'app/dist', '--exclude', 'app/.cache', '-C', RAIZ, '.'],
                         capture_output=True)
    # Com a máquina carregada, o SSH da VM às vezes demora a responder: tenta de novo antes de desistir.
    for _ in range(5):
        r = subprocess.run(['ssh', *SSH_OPTS, f'admin@{endereco}', 'rm -rf /tmp/setuper && mkdir -p /tmp/setuper && tar -xz -C /tmp/setuper'],
                           input=tar.stdout, env=SSH_ENV, capture_output=True)
        if not r.returncode:
            break
        time.sleep(20)
    if r.returncode:
        sys.exit(f'cópia falhou: {r.stderr.decode()}')


def instalar_clt_como_se_clicasse(endereco, registro):
    """Faz o que o clique em "Instalar" faria, pelo softwareupdate."""
    registro('[teste] simulando o clique em Instalar das ferramentas da Apple')
    script = (
        'touch /tmp/.com.apple.dt.CommandLineTools.installondemand.in-progress; '
        # A lista da Apple às vezes vem vazia na primeira consulta: tenta algumas vezes.
        "for i in 1 2 3 4 5; do P=$(softwareupdate -l 2>/dev/null | grep -E '\\* Label: Command Line Tools' | sed 's/^.*Label: //' | sort -V | tail -n1); "
        '[ -n "$P" ] && break; sleep 20; done; '
        f'echo "produto: $P"; echo {SENHA} | sudo -S softwareupdate -i "$P" --verbose 2>&1 | tail -3; '
        'rm -f /tmp/.com.apple.dt.CommandLineTools.installondemand.in-progress; xcode-select -p'
    )
    codigo, saida = ssh(endereco, script, timeout=3600)
    registro(f'[teste] ferramentas da Apple: código {codigo}\n{saida}')


def segundos(etime):
    # O ps do Mac não tem etimes; o etime vem como [[dd-]hh:]mm:ss.
    dias, _, resto = etime.rpartition('-')
    partes = [int(x) for x in resto.split(':')]
    while len(partes) < 3:
        partes.insert(0, 0)
    return int(dias or 0) * 86400 + partes[0] * 3600 + partes[1] * 60 + partes[2]


def vigiar_logins(endereco, registro, parar):
    """Os logins precisam de conta real: confere que abriram e encerra depois de 20 s."""
    vistos = set()
    while not parar.is_set():
        try:
            codigo, saida = ssh(endereco, 'ps -axo etime=,pid=,command=', timeout=30)
        except subprocess.TimeoutExpired:
            continue
        for linha in saida.splitlines():
            partes = linha.split(None, 2)
            if len(partes) < 3 or not partes[1].isdigit():
                continue
            tempo, pid, cmd = segundos(partes[0]), partes[1], partes[2]
            alvo = next((l for l in LOGINS if l in cmd), None)
            if alvo and tempo >= ESPERA_LOGIN and pid not in vistos:
                vistos.add(pid)
                registro(f'[teste] {alvo} abriu e ficou esperando a pessoa ({tempo}s). Encerrando, porque aqui não tem conta.')
                ssh(endereco, f'kill {pid}', timeout=30)
        parar.wait(5)


def rodar():
    os.makedirs(LOGS, exist_ok=True)
    nome_log = os.path.join(LOGS, time.strftime('%Y-%m-%d_%H%M%S') + '.log')
    log = open(nome_log, 'w')

    def registro(msg):
        log.write(f'\n{msg}\n')
        log.flush()
        print(msg, flush=True)

    endereco = ligar_vm_nova()
    registro(f'[teste] VM {VM} ligada em {endereco}')
    codigo, saida = ssh(endereco, 'sw_vers -productVersion; xcode-select -p 2>&1; command -v brew node claude || true')
    registro(f'[teste] estado inicial:\n{saida}')
    copiar_setuper(endereco)

    parar = threading.Event()
    threading.Thread(target=vigiar_logins, args=(endereco, registro, parar), daemon=True).start()

    extras = ' '.join(sys.argv[2:])  # ex.: --perfil empresario
    comando = ('export CLAUDE_SETUPER_LOCAL=/tmp/setuper CLAUDE_SETUPER_ESPERA_MAX=20 CLAUDE_SETUPER_TERMINAL=1; '
               f'cat /tmp/setuper/install.sh | bash -s -- {extras}')
    pid, fd = pty.fork()
    if pid == 0:
        # Sem tamanho, o terminal fica com 0 colunas e o assistente desenha uma letra por linha.
        fcntl.ioctl(0, termios.TIOCSWINSZ, struct.pack('HHHH', 40, 120, 0, 0))
        os.execvpe('ssh', ['ssh', '-tt', *SSH_OPTS, f'admin@{endereco}', comando], SSH_ENV)

    tela = ''
    historico = ''  # tudo que apareceu, limpo; varrido a partir de 'lido'
    lido = 0
    ultima_resposta = {}
    respondidas = set()
    senhas = 0
    clt_iniciado = False
    inicio = time.time()
    while time.time() - inicio < 90 * 60:
        r, _, _ = select.select([fd], [], [], 1)
        if not r:
            continue
        try:
            dado = os.read(fd, 65536)
        except OSError:
            break
        if not dado:
            break
        texto = dado.decode(errors='ignore')
        log.write(texto)
        log.flush()
        limpo = re.sub(r'\x1b\[[0-9;?]*[A-Za-z]', '', texto)
        tela += limpo
        tela = tela[-6000:]
        historico += limpo

        if tela.count('Password:') > senhas:
            senhas = tela.count('Password:')
            time.sleep(0.5)
            os.write(fd, (SENHA + '\n').encode())
        if 'Press RETURN' in tela[-400:] and 'RETURN' not in respondidas:
            respondidas.add('RETURN')
            os.write(fd, b'\r')
        if 'ferramentas de linha de comando' in tela and not clt_iniciado:
            clt_iniciado = True
            threading.Thread(target=instalar_clt_como_se_clicasse, args=(endereco, registro), daemon=True).start()
        # Pergunta ativa do assistente: "◆  texto". A mesma pergunta pode voltar mais tarde (GitHub e Vercel),
        # então responde cada aparição nova; o redesenho logo depois da resposta (até 10 s) é ignorado.
        # Só pergunta aberta: o bloco termina em "└". As mensagens de "já instalado" também usam ◆, mas não têm o └.
        for achado in re.finditer(r'[◆▲]\s+([^\n]{8,120})\n(?:│[^\n]*\n){1,20}└', historico[lido:]):
            chave = achado.group(1).strip()[:60]
            if time.time() - ultima_resposta.get(chave, 0) > 10:
                ultima_resposta[chave] = time.time()
                time.sleep(0.8)
                os.write(fd, b'Teste\r' if 'chame' in chave else IDADE + b'\r' if 'anos' in chave else b'\r')
        lido = max(lido, len(historico) - 200)
        if 'Press Enter to open' in tela[-300:] and 'gh-enter' not in respondidas:
            respondidas.add('gh-enter')
            os.write(fd, b'\r')

    parar.set()
    try:
        _, status = os.waitpid(pid, 0)
    except ChildProcessError:
        status = -1
    registro(f'[teste] instalador terminou com status {status} em {int(time.time() - inicio)}s')

    # Terminal novo, como a pessoa abriria depois.
    codigo, saida = ssh(endereco, "zsh -lic 'command -v brew node claude claude-setuper; claude-setuper doctor' 2>&1", timeout=600)
    registro(f'[teste] Terminal novo + doctor:\n{saida}')

    limpo = re.sub(r'\x1b\[[0-9;?]*[A-Za-z]', '', open(nome_log).read())
    problemas = [l.strip() for l in limpo.splitlines()
                 if re.search(r'EINVAL|command not found|Não consegui|não deu certo|Error:|ERRO|✗|Traceback|panic', l)]
    registro('[teste] PROBLEMAS:\n' + ('\n'.join(dict.fromkeys(problemas)) or 'nenhum'))
    registro(f'[teste] log completo: {nome_log}')


def rodar_app():
    """A linha do Terminal baixa o app (aqui, o zip local) e abre; o app responde as telas sozinho (modo roteiro)."""
    zip_app = os.path.join(RAIZ, 'app', 'dist', 'Claude-Setuper-mac-arm64.zip')
    if not os.path.exists(zip_app):
        sys.exit('gere o app antes: bash app/build.sh arm64')
    os.makedirs(LOGS, exist_ok=True)
    nome_log = os.path.join(LOGS, time.strftime('%Y-%m-%d_%H%M%S') + '-app.log')
    log = open(nome_log, 'w')

    def registro(msg):
        log.write(f'\n{msg}\n')
        log.flush()
        print(msg, flush=True)

    endereco = ligar_vm_nova()
    # O app precisa da sessão gráfica: a imagem da VM entra sozinha no usuário admin.
    for _ in range(60):
        if ssh(endereco, 'pgrep -x Finder >/dev/null && echo sim')[1] == 'sim':
            break
        time.sleep(3)
    codigo, saida = ssh(endereco, 'sw_vers -productVersion; xcode-select -p 2>&1; pgrep -x Finder >/dev/null && echo "sessão gráfica: sim"')
    registro(f'[teste] VM {VM} ligada em {endereco}\n{saida}')
    copiar_setuper(endereco)
    r = subprocess.run(['ssh', *SSH_OPTS, f'admin@{endereco}', 'cat > /tmp/app.zip'], stdin=open(zip_app, 'rb'), env=SSH_ENV, capture_output=True)
    if r.returncode:
        sys.exit(f'cópia do app falhou: {r.stderr.decode()}')
    teste = json.dumps({'nome': 'Teste', 'idade': IDADE.decode(), 'senha': SENHA, 'esperaMax': 20})
    ssh(endereco, f"mkdir -p ~/'Claude Setuper' && cat > ~/'Claude Setuper/.teste-auto.json'", entrada=teste)

    parar = threading.Event()
    threading.Thread(target=vigiar_logins, args=(endereco, registro, parar), daemon=True).start()
    def clt_quando_o_app_pedir():
        # Clica em "Instalar" só depois que o app pediu as ferramentas, como a pessoa faria.
        for _ in range(240):
            if ssh(endereco, "grep -q 'xcode-select --install' ~/'Claude Setuper/registro.log' 2>/dev/null && echo sim", timeout=60)[1] == 'sim':
                return instalar_clt_como_se_clicasse(endereco, registro)
            time.sleep(5)
    threading.Thread(target=clt_quando_o_app_pedir, daemon=True).start()

    extras = ' '.join(sys.argv[2:])
    codigo, saida = ssh(endereco, f'export CLAUDE_SETUPER_APP_URL=file:///tmp/app.zip; cat /tmp/setuper/install.sh | bash -s -- {extras}', timeout=600)
    registro(f'[teste] linha do Terminal (código {codigo}):\n{saida[-1500:]}')
    inicio = time.time()
    fim = ''
    while time.time() - inicio < 60 * 60:
        _, telas = ssh(endereco, "ls ~/'Claude Setuper/telas' 2>/dev/null", timeout=60)
        fim = next((t for t in telas.split() if 'fim' in t or 'falha' in t), '')
        if fim:
            break
        time.sleep(15)
    parar.set()
    registro(f'[teste] app chegou em {fim or "NADA (tempo esgotado)"} em {int(time.time() - inicio)}s')

    pasta_telas = nome_log.replace('.log', '-telas')
    os.makedirs(pasta_telas, exist_ok=True)
    tar = subprocess.run(['ssh', *SSH_OPTS, f'admin@{endereco}', "cd ~/'Claude Setuper' && tar -c telas registro.log estado.json 2>/dev/null"], env=SSH_ENV, capture_output=True)
    subprocess.run(['tar', '-x', '-C', pasta_telas], input=tar.stdout)
    registro(f'[teste] telas e registro copiados pra {pasta_telas}')

    codigo, saida = ssh(endereco, "zsh -lic 'command -v brew node claude claude-setuper; claude-setuper doctor' 2>&1", timeout=600)
    registro(f'[teste] Terminal novo + doctor:\n{saida}')
    reg = open(os.path.join(pasta_telas, 'registro.log'), errors='ignore').read() if os.path.exists(os.path.join(pasta_telas, 'registro.log')) else ''
    problemas = [l.strip()[:200] for l in (reg + saida).splitlines()
                 if re.search(r'EINVAL|command not found|Não consegui|não deu certo|ERRO|✗|Traceback|\[tela\]|\[app\]|"falha"', l)]
    registro('[teste] PROBLEMAS:\n' + ('\n'.join(dict.fromkeys(problemas)) or 'nenhum'))
    registro(f'[teste] log completo: {nome_log}')


if __name__ == '__main__':
    acao = sys.argv[1] if len(sys.argv) > 1 else 'rodar'
    if acao == 'rodar':
        rodar()
    elif acao == 'rodar-app':
        rodar_app()
    elif acao == 'shell':
        os.execvpe('ssh', ['ssh', '-tt', *SSH_OPTS, f'admin@{ip()}'], SSH_ENV)
    elif acao == 'desligar':
        tart('stop', VM)
