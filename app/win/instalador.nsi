; Instalador do Claude Setuper pro Windows: por usuário, sem pedir administrador, sem nenhuma escolha no caminho.
; Gerado pelo app/build-win.sh, que passa ORIGEM, VERSAO, ICONE e SAIDA. Fala português ou inglês conforme o Windows da pessoa.
; Rodando com /S (a atualização de dentro do app), não mostra nada, espera o app fechar e abre o novo no fim.
Unicode true
SetCompressor /SOLID lzma
SetCompressorDictSize 32

!define NOME "Claude Setuper"
!define EXE "Claude Setuper.exe"
!define CHAVE "Software\Microsoft\Windows\CurrentVersion\Uninstall\ClaudeSetuper"

!include "MUI2.nsh"
!include "FileFunc.nsh"

Name "${NOME}"
OutFile "${SAIDA}"
InstallDir "$LOCALAPPDATA\Programs\${NOME}"
RequestExecutionLevel user
ManifestDPIAware true
ManifestSupportedOS Win10
ShowInstDetails nevershow
ShowUninstDetails nevershow
BrandingText "${NOME} ${VERSAO}"

VIProductVersion "${VERSAO}.0"
VIAddVersionKey /LANG=1033 "ProductName" "${NOME}"
VIAddVersionKey /LANG=1033 "FileDescription" "${NOME}"
VIAddVersionKey /LANG=1033 "FileVersion" "${VERSAO}"
VIAddVersionKey /LANG=1033 "ProductVersion" "${VERSAO}"
VIAddVersionKey /LANG=1033 "CompanyName" "Instituto ELOS"
VIAddVersionKey /LANG=1033 "LegalCopyright" "Instituto ELOS"

!define MUI_ICON "${ICONE}"
!define MUI_UNICON "${ICONE}"
!define MUI_ABORTWARNING
!define MUI_FINISHPAGE_RUN "$INSTDIR\${EXE}"
!define MUI_FINISHPAGE_NOREBOOTSUPPORT

!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_UNPAGE_INSTFILES

; Sem seletor de idioma: o instalador usa o idioma do Windows, e cai em inglês se não for português.
!insertmacro MUI_LANGUAGE "English"
!insertmacro MUI_LANGUAGE "PortugueseBR"

LangString FECHE_O_APP ${LANG_ENGLISH} "${NOME} is open. Close it and click OK to continue."
LangString FECHE_O_APP ${LANG_PORTUGUESEBR} "O ${NOME} está aberto. Feche ele e clique em OK pra continuar."

; Espera o app fechar. Se ele não fechar: com janela pergunta à pessoa; em silêncio fecha à força depois de meio minuto,
; e a instalação de dentro do app continua de onde parou na próxima abertura.
!macro ESPERAR_FECHAR
  StrCpy $0 0
  espera_laco:
    nsExec::ExecToStack `cmd /c tasklist /FI "IMAGENAME eq ${EXE}" /NH | find /I "${EXE}"`
    Pop $1
    Pop $2
    StrCmp $1 "0" 0 espera_fim
    IfSilent espera_silencio
    MessageBox MB_OKCANCEL|MB_ICONINFORMATION "$(FECHE_O_APP)" IDOK espera_laco
    Abort
  espera_silencio:
    IntOp $0 $0 + 1
    IntCmp $0 30 0 0 espera_forca
    Sleep 1000
    Goto espera_laco
  espera_forca:
    nsExec::Exec `taskkill /F /IM "${EXE}"`
    Pop $1
    Sleep 1000
  espera_fim:
!macroend

Section
  SetShellVarContext current
  !insertmacro ESPERAR_FECHAR
  ; Versão anterior sai inteira: sobra de arquivo velho quebra o app novo. Os dados da pessoa ficam em outra pasta.
  ; Só apaga se for mesmo a nossa pasta, mesmo que alguém passe outra com /D.
  IfFileExists "$INSTDIR\Desinstalar.exe" 0 +2
    RMDir /r "$INSTDIR"
  SetOutPath "$INSTDIR"
  File /r "${ORIGEM}\*"
  WriteUninstaller "$INSTDIR\Desinstalar.exe"

  CreateShortcut "$SMPROGRAMS\${NOME}.lnk" "$INSTDIR\${EXE}"
  CreateShortcut "$DESKTOP\${NOME}.lnk" "$INSTDIR\${EXE}"

  ${GetSize} "$INSTDIR" "/S=0K" $0 $1 $2
  WriteRegStr HKCU "${CHAVE}" "DisplayName" "${NOME}"
  WriteRegStr HKCU "${CHAVE}" "DisplayVersion" "${VERSAO}"
  WriteRegStr HKCU "${CHAVE}" "Publisher" "Instituto ELOS"
  WriteRegStr HKCU "${CHAVE}" "DisplayIcon" "$INSTDIR\${EXE}"
  WriteRegStr HKCU "${CHAVE}" "InstallLocation" "$INSTDIR"
  WriteRegStr HKCU "${CHAVE}" "UninstallString" '"$INSTDIR\Desinstalar.exe"'
  WriteRegStr HKCU "${CHAVE}" "QuietUninstallString" '"$INSTDIR\Desinstalar.exe" /S'
  WriteRegDWORD HKCU "${CHAVE}" "NoModify" 1
  WriteRegDWORD HKCU "${CHAVE}" "NoRepair" 1
  WriteRegDWORD HKCU "${CHAVE}" "EstimatedSize" "$0"

  IfSilent 0 +2
    Exec '"$INSTDIR\${EXE}"'
SectionEnd

Section "Uninstall"
  SetShellVarContext current
  !insertmacro ESPERAR_FECHAR
  Delete "$SMPROGRAMS\${NOME}.lnk"
  Delete "$DESKTOP\${NOME}.lnk"
  DeleteRegKey HKCU "${CHAVE}"
  ; Só o programa: a pasta "Claude Setuper" da pessoa, as notas e a IA continuam onde estão.
  RMDir /r "$INSTDIR"
SectionEnd
