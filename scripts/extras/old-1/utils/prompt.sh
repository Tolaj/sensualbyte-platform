#!/bin/bash

prompt() {
  local message="$1"
  local default="$2"
  local var

  if [ -n "$default" ]; then
    read -p "$message [$default]: " var
    echo "${var:-$default}"
  else
    read -p "$message: " var
    echo "$var"
  fi
}

confirm() {
  local message="$1"
  read -p "$message (y/n): " yn
  [[ "$yn" == "y" || "$yn" == "Y" ]]
}
