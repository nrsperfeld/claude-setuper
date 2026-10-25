#!/usr/bin/env python3
"""Testa o Claude Setuper (caminho em Node, install.ps1) num Windows 11 ARM zerado, na VM do QEMU.

  python3 test/win-vm/vm_win.py rodar [--perfil X]   # volta a VM pro estado limpo, instala tudo, confere e grava o log
  python3 test/win-vm/vm_win.py limpo                # grava o estado atual (VM desligada) como o "limpo"

A VM fica em ~/Projects/.vm (vm.py start/shot/key/stop). O estado limpo é um snapshot "limpo" do win11.qcow2,
gravado logo depois do primeiro login (Windows instalado, OpenSSH e winget prontos, nada do Setuper).

O que é simulado (precisa de pessoa ou de conta real):
  - as perguntas do assistente: Enter no padrão, "Teste" no nome, 52 na idade
  - os logins (Claude, GitHub, Vercel): conferimos que abrem sem erro e encerramos depois de 20 s
Não coberto: pelo SSH o usuário entra como administrador, então as janelas do UAC que a pessoa veria não aparecem.
"""
import fcntl, os, pty, re, select, struct, subprocess, sys, termios, threading, time

VMDIR = os.path.expanduser('~/Projects/.vm')
DISCO = os.path.join(VMDIR, 'win11.qcow2')
RAIZ = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
LOGS = os.path.join(RAIZ, 'test', 'win-vm', 'logs')
SSH = ['sshpass', '-p', 'Setuper2026!', 'ssh', '-p', '2222', '-o', 'StrictHostKeyChecking=no', '-o', 'UserKnownHostsFile=/dev/null',
       '-o', 'ConnectTimeout=15', '-o', 'LogLevel=ERROR', '-o', 'ServerAliveInterval=30', 'teste@127.0.0.1']
IDADE = os.environ.get('SETUPER_IDADE', '52').encode()  # SETUPER_IDADE=15 testa o caminho de menor de idade
LOGINS = ['auth login', 'vercel login', 'vercel.js login']


def vm(*a):
    return subprocess.run(['python3', os.path.join(VMDIR, 'vm.py'), *a], capture_output=True, text=True).stdout.strip()


def ssh(cmd, timeout=600, entrada=None):
    r = subprocess.run([*SSH, cmd], capture_output=True, timeout=timeout, input=entrada,
                       stdin=None if entrada is not None else subprocess.DEVNULL)
    return r.returncode, (r.stdout + r.stderr).decode(errors='ignore').strip()


def esperar_ssh(limite=900):
    fim = time.time() + limite
    while time.time() < fim:
        try:
            if 'ok' in ssh('echo ok', timeout=30)[1]:
                return True
        except subprocess.TimeoutExpired:
            pass
        time.sleep(10)
    return False


def desligar():
    if 'rodando' in vm('status'):
        vm('stop')
        for _ in range(60):
            if 'parada' in vm('status'):
                return
            time.sleep(5)
        vm('kill')
        time.sleep(3)


def ligar_limpa():
    desligar()
    r = subprocess.run(['qemu-img', 'snapshot', '-a', 'limpo', DISCO], capture_output=True, text=True)
    if r.returncode:
        sys.exit(f'sem snapshot "limpo": {r.stderr}')
    vm('start')
    if not esperar_ssh():
        sys.exit('SSH não respondeu')


def copiar_setuper():
    tar = subprocess.run(['tar', '-cz', '--exclude', 'node_modules', '--exclude', '.git', '--exclude', 'test/*/logs', '-C', RAIZ, '.'],
                         capture_output=True, env={**os.environ, 'COPYFILE_DISABLE': '1'}).stdout  # sem os ._ do Mac
    local = os.path.join(LOGS, 'setuper.tgz')
    open(local, 'wb').write(tar)
    # scp em vez de mandar pela entrada: o PowerShell do Windows mexe nos bytes que passam por ela.
    # Logo depois de ligar, o SSH às vezes recusa a senha por alguns segundos: tenta de novo antes de desistir.
    for _ in range(5):
        r = subprocess.run(['sshpass', '-p', 'Setuper2026!', 'scp', '-P', '2222', '-o', 'StrictHostKeyChecking=no', '-o', 'UserKnownHostsFile=/dev/null',
                            '-o', 'LogLevel=ERROR', local, 'teste@127.0.0.1:C:/setuper.tgz'], capture_output=True)
        if not r.returncode:
            break
        time.sleep(20)
    if r.returncode:
        sys.exit(f'cópia falhou: {r.stderr.decode(errors="ignore")}')
    codigo, saida = ssh('Remove-Item -Recurse -Force C:\\setuper -ErrorAction SilentlyContinue; New-Item -ItemType Directory C:\\setuper | Out-Null; '
                        'tar -xzf C:\\setuper.tgz -C C:\\setuper; if (Test-Path C:\\setuper\\install.ps1) { "copiado" }')
    if 'copiado' not in saida:
        sys.exit(f'cópia falhou: {saida}')


def vigiar_logins(registro, parar):
    vistos = set()
    script = ("Get-CimInstance Win32_Process | Where-Object { $_.CommandLine } | ForEach-Object { "
              "'{0}|{1}|{2}' -f $_.ProcessId, [int]((Get-Date) - $_.CreationDate).TotalSeconds, $_.CommandLine }")
    while not parar.is_set():
        try:
            _, saida = ssh(script, timeout=60)
        except subprocess.TimeoutExpired:
            continue
        for linha in saida.splitlines():
            partes = linha.split('|', 2)
            if len(partes) < 3 or not partes[0].isdigit():
                continue
            pid, tempo, cmd = partes[0], int(partes[1] or 0), partes[2]
            alvo = next((l for l in LOGINS if l in cmd), None)
            if alvo and tempo >= 20 and pid not in vistos:
                vistos.add(pid)
                registro(f'[teste] {alvo} abriu e ficou esperando a pessoa ({tempo}s). Encerrando, porque aqui não tem conta.')
                ssh(f'taskkill /PID {pid} /T /F', timeout=60)
        parar.wait(5)


def rodar():
    os.makedirs(LOGS, exist_ok=True)
    nome_log = os.path.join(LOGS, time.strftime('%Y-%m-%d_%H%M%S') + '.log')
    log = open(nome_log, 'w')

    def registro(msg):
        log.write(f'\n{msg}\n')
        log.flush()
        print(msg, flush=True)

    ligar_limpa()
    _, saida = ssh('[Environment]::OSVersion.Version.ToString(); (Get-Command node,git,claude -ErrorAction SilentlyContinue).Name')
    registro(f'[teste] VM limpa ligada. Estado inicial:\n{saida}')
    copiar_setuper()

    parar = threading.Event()
    threading.Thread(target=vigiar_logins, args=(registro, parar), daemon=True).start()

    extras = ' '.join(sys.argv[2:])
    comando = ("$env:CLAUDE_SETUPER_LOCAL='C:\\setuper'; $env:CLAUDE_SETUPER_ESPERA_MAX='20'; $env:WT_SESSION='teste'; "
               f"& powershell -NoProfile -ExecutionPolicy Bypass -File C:\\setuper\\install.ps1 {extras}")
    pid, fd = pty.fork()
    if pid == 0:
        fcntl.ioctl(0, termios.TIOCSWINSZ, struct.pack('HHHH', 40, 120, 0, 0))
        os.execvp(SSH[0], [*SSH[:-1], '-tt', SSH[-1], comando])

    historico, lido, ultima = '', 0, {}
    inicio = time.time()
    silencio = time.time()
    while time.time() - inicio < 90 * 60:
        r, _, _ = select.select([fd], [], [], 1)
        if not r:
            # No fim o instalador abre o Claude numa janela nova, que segura a sessão do SSH aberta.
            # Depois de 2 min sem nada na tela, confere se o Setuper ainda está rodando na VM.
            if time.time() - silencio > 120:
                silencio = time.time()
                try:
                    _, n = ssh("@(Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -match 'claude-setuper.js' }).Count", timeout=60)
                except subprocess.TimeoutExpired:
                    n = '1'
                if n.strip() == '0':
                    registro('[teste] o Setuper terminou na VM (a sessão ficou aberta por causa da janela do Claude)')
                    break
            continue
        silencio = time.time()
        try:
            dado = os.read(fd, 65536)
        except OSError:
            break
        if not dado:
            break
        texto = dado.decode(errors='ignore')
        log.write(texto)
        log.flush()
        historico += re.sub(r'\x1b\[[0-9;?]*[A-Za-z]|\x1b\][^\x07]*\x07', '', texto)
        for achado in re.finditer(r'[◆▲]\s+([^\n]{8,120})\n(?:│[^\n]*\n){1,20}└', historico[lido:]):
            chave = achado.group(1).strip()[:60]
            if time.time() - ultima.get(chave, 0) > 10:
                ultima[chave] = time.time()
                time.sleep(0.8)
                os.write(fd, b'Teste\r' if 'chame' in chave else IDADE + b'\r' if 'anos' in chave else b'\r')
        lido = max(lido, len(historico) - 200)
        if re.search(r'Press Enter to open|\(Y/n\)|Aperta Enter pra seguir', historico[-300:]) and time.time() - ultima.get('ingles', 0) > 10:
            ultima['ingles'] = time.time()
            os.write(fd, b'\r')

    parar.set()
    try:
        os.kill(pid, 15)  # encerra o ssh se ele ainda estiver preso
    except ProcessLookupError:
        pass
    try:
        _, status = os.waitpid(pid, 0)
    except ChildProcessError:
        status = -1
    registro(f'[teste] instalador terminou com status {status} em {int(time.time() - inicio)}s')

    # PowerShell novo, como a pessoa abriria depois (PATH lido do registro do Windows).
    _, saida = ssh("$env:Path = [Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [Environment]::GetEnvironmentVariable('Path','User'); "
                   "(Get-Command node,git,claude,claude-setuper -ErrorAction SilentlyContinue).Source; claude-setuper doctor", timeout=600)
    registro(f'[teste] PowerShell novo + doctor:\n{saida}')

    limpo = re.sub(r'\x1b\[[0-9;?]*[A-Za-z]|\x1b\][^\x07]*\x07', '', open(nome_log, errors='ignore').read())
    problemas = [l.strip() for l in limpo.splitlines()
                 if re.search(r'EINVAL|not recognized|Não consegui|não deu certo|Error:|ERRO|✗|Traceback|Exception', l)]
    registro('[teste] PROBLEMAS:\n' + ('\n'.join(dict.fromkeys(problemas)) or 'nenhum'))
    registro(f'[teste] log completo: {nome_log}')


if __name__ == '__main__':
    acao = sys.argv[1] if len(sys.argv) > 1 else 'rodar'
    if acao == 'rodar':
        rodar()
    elif acao == 'limpo':
        desligar()
        subprocess.run(['qemu-img', 'snapshot', '-d', 'limpo', DISCO], capture_output=True)
        print(subprocess.run(['qemu-img', 'snapshot', '-c', 'limpo', DISCO], capture_output=True, text=True))
