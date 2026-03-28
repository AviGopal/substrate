#!/bin/bash
# Shared utility for selecting ready DevBob pods
# Usage: source scripts/lib/get-ready-pod.sh && get_ready_devbob_pod <namespace>

get_ready_devbob_pod() {
    local namespace="${1:-metabob}"
    local pod=$(kubectl get pods -n "$namespace" -l app.kubernetes.io/name=devbob \
        -o jsonpath='{.items[?(@.status.containerStatuses[0].ready==true)].metadata.name}' | awk '{print $1}')
    
    if [ -z "$pod" ]; then
        echo "ERROR: No ready DevBob pods found in namespace $namespace" >&2
        kubectl get pods -n "$namespace" -l app.kubernetes.io/name=devbob >&2
        return 1
    fi
    
    echo "$pod"
}

get_ready_pod_by_label() {
    local namespace="$1"
    local label="$2"
    local pod=$(kubectl get pods -n "$namespace" -l "$label" \
        -o jsonpath='{.items[?(@.status.containerStatuses[0].ready==true)].metadata.name}' | awk '{print $1}')
    
    if [ -z "$pod" ]; then
        echo "ERROR: No ready pods found in namespace $namespace with label $label" >&2
        kubectl get pods -n "$namespace" -l "$label" >&2
        return 1
    fi
    
    echo "$pod"
}
