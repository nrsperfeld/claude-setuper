#!/bin/bash
# Revisão semanal do segundo cérebro. Criado pelo Claude Setuper.
export PATH="$HOME/.local/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"
VAULT="{{vault}}"
cd "$VAULT" || exit 0
command -v claude >/dev/null || exit 0

claude -p --permission-mode acceptEdits --allowedTools "Read,Write,Glob,Grep" "Faça a revisão semanal do segundo cérebro em $VAULT/CLAUDE. Leia tudo que foi criado ou alterado nos últimos 7 dias nas pastas feedback, decisões, padrões, descobertas e projetos. Escreva UMA nota nova em $VAULT/CLAUDE/descobertas/ chamada 'Revisão da semana $(date +%Y-%m-%d).md' com: o que se repetiu (padrões que estão virando regra), decisões que podem estar se contradizendo, projetos parados há mais de uma semana, e uma sugestão de foco pra semana que vem. Linguagem simples, sem título, sem frontmatter, terminando com #claude #descoberta. Não altere nenhuma outra nota." >> "{{logs}}/revisao-semanal.log" 2>&1
