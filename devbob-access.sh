#!/bin/bash
# Quick access to DevBob local deployment

NAMESPACE="metabob"

case "$1" in
  pods)
    echo "=== DevBob Pods ==="
    kubectl get pods -n $NAMESPACE
    ;;
  
  services)
    echo "=== DevBob Services ==="
    kubectl get svc -n $NAMESPACE
    ;;
  
  logs)
    if [ -z "$2" ]; then
      echo "Following DevBob logs (Ctrl+C to exit)..."
      kubectl logs -n $NAMESPACE -l app.kubernetes.io/name=devbob --tail=50 -f
    else
      echo "Following logs for $2..."
      kubectl logs -n $NAMESPACE "$2" --tail=50 -f
    fi
    ;;
  
  shell)
    POD="${2:-devbob-0}"
    echo "Opening shell in $POD..."
    kubectl exec -it -n $NAMESPACE "$POD" -- /bin/bash
    ;;
  
  redis)
    echo "Connecting to Redis CLI..."
    kubectl exec -it -n $NAMESPACE redis-master-0 -- redis-cli
    ;;
  
  restart)
    SERVICE="${2:-devbob}"
    echo "Restarting $SERVICE..."
    kubectl rollout restart -n $NAMESPACE statefulset/$SERVICE 2>/dev/null || \
    kubectl rollout restart -n $NAMESPACE deployment/$SERVICE
    ;;
  
  status)
    echo "=== Helm Releases ==="
    helm list -n $NAMESPACE
    echo ""
    echo "=== Pod Status ==="
    kubectl get pods -n $NAMESPACE -o wide
    echo ""
    echo "=== Service Endpoints ==="
    kubectl get endpoints -n $NAMESPACE 2>/dev/null | grep -v "Warning:"
    ;;
  
  forward)
    echo "Setting up port forwards..."
    echo "  - Redis: localhost:6379"
    echo "  - SurrealDB: localhost:8000"
    echo "  - DevBob: localhost:3000"
    echo ""
    kubectl port-forward -n $NAMESPACE svc/redis-master 6379:6379 &
    kubectl port-forward -n $NAMESPACE svc/surrealdb 8000:8000 &
    kubectl port-forward -n $NAMESPACE svc/devbob 3000:3000 &
    echo ""
    echo "Port forwards running in background. Use 'jobs' to see them."
    echo "Use 'kill %1 %2 %3' to stop all port forwards."
    ;;
  
  stop-forward)
    echo "Stopping all port forwards..."
    pkill -f "kubectl port-forward.*metabob"
    echo "Port forwards stopped."
    ;;
  
  secrets)
    echo "=== DevBob Secrets ==="
    kubectl get secrets -n $NAMESPACE | grep -E "(devbob|surrealdb|minio|postgres)"
    ;;
  
  describe)
    if [ -z "$2" ]; then
      echo "Usage: $0 describe <resource-name>"
      exit 1
    fi
    kubectl describe -n $NAMESPACE "$2"
    ;;
  
  cleanup)
    echo "WARNING: This will delete all DevBob resources!"
    read -p "Are you sure? (yes/no): " confirm
    if [ "$confirm" = "yes" ]; then
      echo "Uninstalling Helm releases..."
      helm uninstall devbob -n $NAMESPACE
      helm uninstall metabob-rpc-api -n $NAMESPACE
      helm uninstall surrealdb -n $NAMESPACE
      helm uninstall redis -n $NAMESPACE
      echo "Cleanup complete."
    else
      echo "Cleanup cancelled."
    fi
    ;;
  
  help|*)
    echo "DevBob Access Script - Quick access to local DevBob deployment"
    echo ""
    echo "Usage: $0 <command> [options]"
    echo ""
    echo "Commands:"
    echo "  pods              - List all pods"
    echo "  services          - List all services"
    echo "  logs [pod]        - Follow logs (DevBob by default, or specific pod)"
    echo "  shell [pod]       - Open shell in pod (devbob-0 by default)"
    echo "  redis             - Connect to Redis CLI"
    echo "  restart [service] - Restart service (devbob by default)"
    echo "  status            - Show complete deployment status"
    echo "  forward           - Set up port forwards (Redis, SurrealDB, DevBob)"
    echo "  stop-forward      - Stop all port forwards"
    echo "  secrets           - List DevBob secrets"
    echo "  describe <name>   - Describe a resource"
    echo "  cleanup           - Uninstall all Helm releases"
    echo "  help              - Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 pods"
    echo "  $0 logs devbob-0"
    echo "  $0 shell devbob-1"
    echo "  $0 restart"
    echo "  $0 forward"
    ;;
esac
