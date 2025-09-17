#!/bin/bash
# CConfig Shell Integration
# This file provides shell integration functions for CConfig
# It should be sourced from the user's shell configuration file

# Detect if we're in development mode
__cconfig_detect_cmd() {
    # Check if we have a development installation marker
    if [[ -f "$HOME/.claude/cconfig/.dev_install" ]]; then
        local dev_path
        dev_path=$(cat "$HOME/.claude/cconfig/.dev_install")
        if [[ -f "$dev_path/bin/cconfig.js" ]]; then
            echo "node \"$dev_path/bin/cconfig.js\""
            return
        fi
    fi

    # Fall back to global installation
    echo "cconfig"
}

# CConfig command wrapper (for development mode)
cconfig() {
    local cmd
    cmd=$(__cconfig_detect_cmd)
    eval "$cmd \"\$@\""
}

# Enhanced Claude command with provider switching
claude() {
    local provider=""
    local args=()
    local cmd

    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            -P|--provider)
                provider="$2"
                shift 2
                ;;
            --pp)
                args+=("--dangerously-skip-permissions")
                shift
                ;;
            *)
                args+=("$1")
                shift
                ;;
        esac
    done

    # Get the cconfig command
    cmd=$(__cconfig_detect_cmd)

    # Load environment variables
    if [[ -n "$provider" ]]; then
        eval "$($cmd env --provider "$provider" 2>/dev/null)" || {
            echo "❌ 加载 Provider '$provider' 失败"
            echo "💡 运行：cconfig list"
            return 1
        }
    else
        eval "$($cmd env 2>/dev/null)" || {
            echo "❌ 尚未配置默认 Provider"
            echo "💡 运行：cconfig add"
            return 1
        }
    fi

    # Execute claude with arguments
    command claude "${args[@]}"
}