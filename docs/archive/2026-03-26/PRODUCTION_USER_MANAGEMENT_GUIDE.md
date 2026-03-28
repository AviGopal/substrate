# Production User Management Guide

## Overview

This document describes the user accounts in the production deployment at **app.metabob.com** and how to manage passwords using the metabob-rpc-api admin CLI.

## Deployment Architecture

The production deployment is managed using Helmfile at `repos/platform/metabob-apps/`:

```yaml
Environment: production
Kubecontext: metabob-production  
Namespace: metabob
Components:
  - metabob-rpc-api (Backend API with admin access)
  - metabob-dashboard (Frontend)
  - surrealdb (Database)
  - redis (Cache)
```

## User Accounts

### Accessing User List

To list all user accounts in production:

```bash
# From kubectl
kubectl exec -n metabob <metabob-rpc-api-pod> -- python -m server.cli admin user list --limit 100

# Or query SurrealDB directly
kubectl exec -n metabob surrealdb-0 -- surreal sql \
  --endpoint http://localhost:8000 \
  --namespace metabob \
  --database learning_loop \
  --username root \
  --password root \
  --command "SELECT email, name, user_id, org_id, role FROM users;"
```

### User Schema

Each user account has:
- **email**: Unique email address (login credential)
- **user_id**: Unique identifier  
- **name**: Full name
- **org_id**: Primary organization ID
- **role**: User role (admin, member, etc.)
- **is_active**: Account status
- **email_verified**: Email verification status
- **password_hash**: bcrypt-hashed password

## Password Reset Functionality

### New CLI Command (Just Added)

I've added a new `reset-password` command to the metabob-rpc-api CLI:

**File**: `repos/metabob-rpc-api/server/cli.py`
**Function**: `repos/metabob-rpc-api/server/db/operations/user_ops.py::reset_password_by_email()`

### Usage

```bash
# Reset password for a specific email
kubectl exec -n metabob <metabob-rpc-api-pod> -- \
  python -m server.cli admin user reset-password --email user@example.com

# Interactive password prompt
Password: 
Repeat for confirmation:

# Output
✅ Password reset successfully
   User ID: user_abc123
   Email: user@example.com
   Name: User Name
```

### How It Works

1. **Find user by email**:
   ```sql
   SELECT * FROM users WHERE email = $email LIMIT 1
   ```

2. **Hash new password with bcrypt**:
   ```python
   password_hash = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt())
   ```

3. **Update user record**:
   ```sql
   UPDATE users
   SET password_hash = $password_hash,
       updated_at = $updated_at
   WHERE user_id = $user_id
   ```

## Available Admin CLI Commands

### User Management

```bash
# List all users
python -m server.cli admin user list [--org-id ORG_ID] [--limit 50]

# Create new user
python -m server.cli admin user create \
  --email EMAIL \
  --name "Full Name" \
  --org-id ORG_ID \
  --role member

# Update user information
python -m server.cli admin user update \
  --user-id USER_ID \
  [--name "New Name"] \
  [--role admin] \
  [--active|--inactive]

# Reset password
python -m server.cli admin user reset-password --email EMAIL

# Assign user to organization
python -m server.cli admin user assign \
  --user-id USER_ID \
  --org-id ORG_ID \
  --role member
```

### Organization Management

```bash
# List organizations
python -m server.cli admin org list [--limit 50]

# Create organization
python -m server.cli admin org create \
  --org-id ORG_ID \
  --name "Organization Name" \
  [--display-name "Display Name"]

# Show organization statistics
python -m server.cli admin org stats --org-id ORG_ID
```

## Production Access

### Via kubectl

All commands must be run via kubectl exec to access the production pod:

```bash
# Get current RPC API pod name
kubectl get pods -n metabob | grep metabob-rpc-api

# Example: metabob-rpc-api-7597f878df-czm7w

# Execute admin commands
kubectl exec -n metabob metabob-rpc-api-7597f878df-czm7w -- \
  python -m server.cli admin user list
```

### Database Credentials

The production deployment uses:

- **SurrealDB URL**: Internal service `http://surrealdb:8000`
- **Namespace**: `metabob`
- **Database**: `learning_loop`
- **Authentication**: Configured via Kubernetes secrets

## Security Notes

1. **Password Hashing**: All passwords are hashed using bcrypt with auto-generated salts
2. **Password Validation**: The reset command uses confirmation prompts to prevent typos
3. **Audit Trail**: All password resets are logged with correlation IDs
4. **Admin Access**: Only accessible via kubectl exec with cluster credentials
5. **JWT Secrets**: Ensure `JWT_SECRET_KEY` is properly configured in production

## Common Use Cases

### Reset Password for Specific User

```bash
# Identify the RPC API pod
POD=$(kubectl get pods -n metabob -l app=metabob-rpc-api -o jsonpath='{.items[0].metadata.name}')

# Reset password
kubectl exec -n metabob $POD -- \
  python -m server.cli admin user reset-password \
  --email user@example.com
```

### List All Users with Roles

```bash
kubectl exec -n metabob $POD -- \
  python -m server.cli admin user list --limit 100
```

### Create New Admin User

```bash
kubectl exec -n metabob $POD -- \
  python -m server.cli admin user create \
  --email admin@metabob.com \
  --name "Admin User" \
  --org-id metabob \
  --role admin
```

## Files Modified

1. **`repos/metabob-rpc-api/server/cli.py`**:
   - Added `user reset-password` command
   
2. **`repos/metabob-rpc-api/server/db/operations/user_ops.py`**:
   - Added `reset_password_by_email()` async function
   - Implements secure password hashing with bcrypt
   - Updates user record in SurrealDB

## Next Steps

To see the current users in your production deployment:

```bash
# Set pod name
export RPC_POD=$(kubectl get pods -n metabob -l app=metabob-rpc-api -o jsonpath='{.items[0].metadata.name}')

# List users
kubectl exec -n metabob $RPC_POD -- \
  python -m server.cli admin user list --limit 100

# Reset password for a specific user
kubectl exec -n metabob $RPC_POD -- \
  python -m server.cli admin user reset-password --email <user-email>
```

## Troubleshooting

### "User not found" error
- Verify the email address is correct (case-sensitive)
- List all users to find the exact email

### "Not enough permissions" error  
- Ensure you're using the correct database credentials
- Check that the pod has access to SurrealDB

### "JWT_SECRET_KEY is weak" warning
- This is a security warning - ensure production uses a strong JWT secret
- The warning doesn't prevent password reset functionality

## References

- **Helmfile**: `repos/platform/metabob-apps/helmfile.yaml.gotmpl`
- **Environment Config**: `repos/platform/metabob-apps/environments/production/`
- **User Operations**: `repos/metabob-rpc-api/server/db/operations/user_ops.py`
- **CLI Commands**: `repos/metabob-rpc-api/server/cli.py`
