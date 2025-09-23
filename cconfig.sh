#!/bin/bash
# CConfig Shell Integration
# This file provides shell integration functions for CConfig
# It should be sourced from the user's shell configuration file

# Detect if we're in development mode and return repo path when available
__cconfig_dev_path() {
    local marker="$HOME/.cconfig/.dev_install"
    if [[ -f "$marker" ]]; then
        local dev_path
        dev_path=$(<"$marker")
        if [[ -n "$dev_path" && -f "$dev_path/bin/cconfig.js" ]]; then
            printf '%s' "$dev_path"
            return 0
        fi
    fi
    return 1
}

# Execute the appropriate CConfig CLI (development repo or global install)
__cconfig_exec() {
    local dev_path
    if dev_path=$(__cconfig_dev_path); then
        node "$dev_path/bin/cconfig.js" "$@"
        return $?
    fi

    local cli_path
    cli_path=$(type -P cconfig 2>/dev/null)
    if [[ -n "$cli_path" ]]; then
        "$cli_path" "$@"
        return $?
    fi

    echo "cconfig CLI 未找到，请确认已经安装" >&2
    return 1
}

# CConfig command wrapper
cconfig() {
    __cconfig_exec "$@"
}

# Enhanced Claude command with provider switching
claude() {
    local provider=""
    local args=()
    local env_output

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

    # Load environment variables
    if [[ -n "$provider" ]]; then
        if ! env_output=$(__cconfig_exec env --provider "$provider" 2>/dev/null); then
            echo "❌ 加载 Provider '$provider' 失败"
            echo "💡 运行：cconfig list"
            return 1
        fi
    else
        if ! env_output=$(__cconfig_exec env 2>/dev/null); then
            echo "❌ 尚未配置默认 Provider"
            echo "💡 运行：cconfig add"
            return 1
        fi
    fi

    eval "$env_output"

    # Execute claude with arguments
    command claude "${args[@]}"
}
