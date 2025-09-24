#!/usr/bin/env bash
# Remove the server directory from the repo and working tree
if [ -d "server" ]; then
  git rm -r server || { echo "git rm failed; try manually removing server/ and committing"; exit 1; }
  echo "server/ removed. Commit the change: git commit -m 'chore: remove internal server'"
else
  echo "server/ not found"
fi
