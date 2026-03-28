#!/bin/bash
# Update learning_loop.py in pod for user_email tracking
POD=$(kubectl get pod -n metabob -l app=metabob-rpc-api -o jsonpath='{.items[0].metadata.name}')

echo "Updating learning_loop.py in pod $POD..."

# Add user_email variable
kubectl exec -n metabob $POD -- sed -i '/org_id = None$/a\        user_email = None' /src/app/server/routes/learning_loop.py

# Extract user_email from JWT
kubectl exec -n metabob $POD -- sed -i '/org_id = user.org_id$/a\                    user_email = user.email' /src/app/server/routes/learning_loop.py

# Extract user_email from API key
kubectl exec -n metabob $POD -- bash -c 'sed -i "/org_id = api_key_record\[\"org_id\"\]$/a\\                        user_id = api_key_record.get(\"user_id\")\n                        if user_id:\n                            from server.db.operations.user_ops import get_user\n                            user_record = await get_user(user_id)\n                            if user_record:\n                                user_email = user_record.get(\"email\")" /src/app/server/routes/learning_loop.py'

# Pass user_email to background task
kubectl exec -n metabob $POD -- sed -i '/project_id=project_id,$/a\            user_email=user_email,' /src/app/server/routes/learning_loop.py

# Add parameter to background function
kubectl exec -n metabob $POD -- sed -i '/project_id: Optional\[str\] = None,$/{ n; /^):$/! s/^/    user_email: Optional[str] = None,\n/; }' /src/app/server/routes/learning_loop.py

echo "Done. Restarting pod..."
kubectl delete pod -n metabob $POD
sleep 5
kubectl wait --for=condition=Ready pod -l app=metabob-rpc-api -n metabob --timeout=60s
echo "Pod restarted successfully"
