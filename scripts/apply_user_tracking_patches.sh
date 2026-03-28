#!/bin/bash
set -e

POD=$(kubectl get pod -n metabob -l app=metabob-rpc-api -o jsonpath='{.items[0].metadata.name}')
echo "Applying user tracking patches to pod: $POD"

# activity_execution.py patches
echo "Patching activity_execution.py..."
kubectl exec -n metabob $POD -- sed -i 's/duration::from::hours/duration::from_hours/g; s/duration::from::days/duration::from_days/g' /src/app/server/db/operations/activity_execution.py
kubectl exec -n metabob $POD -- sed -i '/cost_usd: float,$/a\    user_email: Optional[str] = None,' /src/app/server/db/operations/activity_execution.py
kubectl exec -n metabob $POD -- sed -i '/"project_id": project_id,  # Multi-tenant scoping (GAP-9)$/a\        "user_email": user_email,  # Actor tracking' /src/app/server/db/operations/activity_execution.py
kubectl exec -n metabob $POD -- sed -i '/error_type,$/a\            user_email,' /src/app/server/db/operations/activity_execution.py
kubectl exec -n metabob $POD -- sed -i 's/"email": "system@metabob.local"/"email": execution.get("user_email", "system@metabob.local")/' /src/app/server/db/operations/activity_execution.py

# learning_loop.py basic patches
echo "Patching learning_loop.py..."
kubectl exec -n metabob $POD -- sed -i '/org_id = None$/a\        user_email = None' /src/app/server/routes/learning_loop.py
kubectl exec -n metabob $POD -- sed -i '/org_id = user.org_id$/a\                    user_email = user.email' /src/app/server/routes/learning_loop.py
kubectl exec -n metabob $POD -- sed -i '/project_id=project_id,$/a\            user_email=user_email,' /src/app/server/routes/learning_loop.py
kubectl exec -n metabob $POD -- sed -i '/project_id: Optional\[str\] = None,$/{ N; s/project_id: Optional\[str\] = None,\n)/project_id: Optional[str] = None,\n    user_email: Optional[str] = None,\n)/; }' /src/app/server/routes/learning_loop.py

# API key user extraction
echo "Adding API key user extraction..."
kubectl cp scripts/inject_api_key_user.py metabob/$POD:/tmp/inject.py 2>/dev/null
kubectl exec -n metabob $POD -- python /tmp/inject.py

echo "✓ All patches applied. Restarting pod..."
kubectl delete pod -n metabob $POD
sleep 5
kubectl wait --for=condition=Ready pod -l app=metabob-rpc-api -n metabob --timeout=60s
echo "✓ Pod restarted and ready"
