#!/bin/bash

if [ "$EUID" -eq 0 ]; then
  echo "⚠️ Do NOT run installer as root."
  echo "Use a normal user with sudo access."
  exit 1
fi
