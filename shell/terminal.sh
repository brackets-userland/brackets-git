#!/bin/sh
if command -v gnome-terminal >/dev/null 2>&1
then
    gnome-terminal --window --working-directory="$1"
elif command -v konsole >/dev/null 2>&1
then
    konsole --workdir "$1"
elif command -v xfce4-terminal >/dev/null 2>&1
then
    xfce4-terminal --working-directory="$1"
elif command -v xterm >/dev/null 2>&1
then
    xterm -e 'cd $1 && bash'
fi
