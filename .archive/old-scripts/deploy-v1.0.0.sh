#!/bin/bash
# Deploy devbob v1.0.0 once image is pushed

VERSION="v1.0.0"
IMAGE="metabobapp/devbob:${VERSION}"

echo "Deploying ${IMAGE} to opencode-server..."

# Update the deployment
kubectl set image deployment/opencode-server -n metabob opencode-server=${IMAGE}

# Force restart by scaling down and up
kubectl scale deployment -n metabob opencode-server --replicas=0
sleep 10
kubectl scale deployment -n metabob opencode-server --replicas=1

# Wait for pod to be ready
echo "Waiting for pod to start..."
kubectl wait --for=condition=ready pod -l app.kubernetes.io/name=opencode-server -n metabob --timeout=120s

# Check logs
echo "Pod logs:"
kubectl logs -n metabob -l app.kubernetes.io/name=opencode-server --tail=30

echo "Deployment complete!"
