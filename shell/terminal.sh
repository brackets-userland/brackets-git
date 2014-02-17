#!/bin/sh
if command -v gnome-terminal >/dev/null 2>&1
then
    gnome-terminal --window --working-directory="$1"
    echo ok
elif command -v konsole >/dev/null 2>&1
then
    konsole --workdir "$1"
    echo ok
elif command -v xterm >/dev/null 2>&1
then
    xterm -e 'cd $1 && bash'
    echo ok
fi
