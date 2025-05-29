#!/bin/bash
echo "[lucibox] Attente de JACK..."

while ! jack_lsp >/dev/null 2>&1; do
    sleep 0.5
done

echo "[lucibox] JACK détecté, start  PureData..."

pd -nogui -jack -rt _main.pd

