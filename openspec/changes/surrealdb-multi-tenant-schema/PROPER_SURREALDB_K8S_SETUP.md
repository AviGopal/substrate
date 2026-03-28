# Proper SurrealDB 3.x Kubernetes Setup with Helm

**Based on:**
- [SurrealDB Kubernetes Deployment Docs](https://surrealdb.com/docs/surrealdb/deployment/kubernetes)
- [Kubernetes Secrets](https://kubernetes.io/docs/concepts/configuration/secret/)
- [Helm Best Practices](https://helm.sh/docs/howto/charts_tips_and_tricks/)

## The Problem We Had

We've been making incremental fixes without following the proper SurrealDB 3.x + Kubernetes pattern:
1. Auth errors due to wrong connection pattern
2. Persistent volume containing old credentials
3. Missing proper secret generation
4. Init container vs migration Job confusion

## The Proper Pattern

### 1. Secret Generation Strategy

**Problem:** SurrealDB needs credentials BEFORE it starts, not after.

**Solution:** Generate secrets in Helm, SurrealDB uses them on first boot.

```yaml
# helm/charts/surrealdb/templates/secret.yaml
{{- if not .Values.auth.existingSecret }}
apiVersion: v1
kind: Secret
metadata:
  name: {{ .Values.name }}-credentials
  namespace: {{ .Values.namespace }}
type: Opaque
data:
  {{- if .Values.auth.username }}
  username: {{ .Values.auth.username | b64enc | quote }}
  {{- else }}
  username: {{ "root" | b64enc | quote }}
  {{- end }}
  {{- if .Values.auth.password }}
  password: {{ .Values.auth.password | b64enc | quote }}
  {{- else }}
  # Generate random password on first install
  password: {{ randAlphaNum 32 | b64enc | quote }}
  {{- end }}
{{- end }}
```

**Key Point:** Use `randAlphaNum` for auto-generated passwords, but this changes on every `helm upgrade`! Better approach:

```yaml
# helm/charts/surrealdb/templates/secret.yaml
{{- if not .Values.auth.existingSecret }}
{{- $secret := lookup "v1" "Secret" .Release.Namespace (printf "%s-credentials" .Values.name) }}
apiVersion: v1
kind: Secret
metadata:
  name: {{ .Values.name }}-credentials
  namespace: {{ .Values.namespace }}
type: Opaque
data:
  username: {{ if $secret }}{{ index $secret.data "username" }}{{else}}{{ "root" | b64enc | quote }}{{ end }}
  password: {{ if $secret }}{{ index $secret.data "password" }}{{ else }}{{ randAlphaNum 32 | b64enc | quote }}{{ end }}
{{- end }}
```

This preserves the secret on upgrade using Helm's `lookup` function.

### 2. SurrealDB StatefulSet Configuration

```yaml
# helm/charts/surrealdb/templates/statefulset.yaml
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: {{ .Values.name }}
  namespace: {{ .Values.namespace }}
spec:
  serviceName: {{ .Values.name }}
  replicas: 1
  selector:
    matchLabels:
      app: {{ .Values.name }}
  template:
    metadata:
      labels:
        app: {{ .Values.name }}
    spec:
      securityContext:
        fsGroup: 65532  # SurrealDB nonroot user
      containers:
        - name: surrealdb
          image: {{ .Values.image.repository }}:{{ .Values.image.tag }}
          imagePullPolicy: {{ .Values.image.pullPolicy }}
          args:
            - start
            - --user
            - $(SURREAL_USER)
            - --pass
            - $(SURREAL_PASS)
            - --log
            - {{ .Values.logLevel | default "info" }}
            - rocksdb:/data/database.db
          env:
            - name: SURREAL_USER
              valueFrom:
                secretKeyRef:
                  name: {{ .Values.auth.existingSecret | default (printf "%s-credentials" .Values.name) }}
                  key: {{ .Values.auth.usernameKey | default "username" }}
            - name: SURREAL_PASS
              valueFrom:
                secretKeyRef:
                  name: {{ .Values.auth.existingSecret | default (printf "%s-credentials" .Values.name) }}
                  key: {{ .Values.auth.passwordKey | default "password" }}
          ports:
            - name: http
              containerPort: 8000
          volumeMounts:
            - name: data
              mountPath: /data
          livenessProbe:
            httpGet:
              path: /health
              port: 8000
            initialDelaySeconds: 30
          readinessProbe:
            httpGet:
              path: /health
              port: 8000
            initialDelaySeconds: 10
  volumeClaimTemplates:
    - metadata:
        name: data
      spec:
        accessModes: ["ReadWriteOnce"]
        {{- if .Values.persistence.storageClass }}
        storageClassName: {{ .Values.persistence.storageClass }}
        {{- end }}
        resources:
          requests:
            storage: {{ .Values.persistence.size }}
```

### 3. Migration Job Pattern

**Key Insight:** Migration Job MUST run AFTER SurrealDB is ready, not as `post-install` hook.

**Why?** Helm hooks run before waiting for readiness probes. Migration Job tries to connect before SurrealDB is ready.

**Solution 1: Use Job instead of Hook**

```yaml
# helm/charts/surrealdb/templates/migration-job.yaml
apiVersion: batch/v1
kind: Job
metadata:
  name: {{ .Values.name }}-migration-{{ .Release.Revision }}
  namespace: {{ .Values.namespace }}
  labels:
    app.kubernetes.io/component: migration
spec:
  backoffLimit: 10  # Allow retries
  template:
    spec:
      restartPolicy: OnFailure
      containers:
        - name: migrate
          image: {{ .Values.migration.image.repository }}:{{ .Values.migration.image.tag }}
          imagePullPolicy: {{ .Values.migration.image.pullPolicy }}
          command:
            - /bin/sh
            - -c
            - |
              # Wait for SurrealDB to be ready
              until curl -f http://{{ .Values.name }}:8000/health; do
                echo "Waiting for SurrealDB..."
                sleep 2
              done
              echo "SurrealDB is ready, starting migration..."
              bun run sql/migrate.ts
          env:
            - name: SURREALDB_URL
              value: "http://{{ .Values.name }}.{{ .Values.namespace }}.svc.cluster.local:8000"
            - name: SURREALDB_NAMESPACE
              value: {{ .Values.database.namespace }}
            - name: SURREALDB_DATABASE
              value: {{ .Values.database.name }}
            - name: SURREALDB_USERNAME
              valueFrom:
                secretKeyRef:
                  name: {{ .Values.auth.existingSecret | default (printf "%s-credentials" .Values.name) }}
                  key: {{ .Values.auth.usernameKey | default "username" }}
            - name: SURREALDB_PASSWORD
              valueFrom:
                secretKeyRef:
                  name: {{ .Values.auth.existingSecret | default (printf "%s-credentials" .Values.name) }}
                  key: {{ .Values.auth.passwordKey | default "password" }}
            - name: NODE_ENV
              value: "production"
```

**Solution 2: Use initContainer in Application Deployment**

```yaml
# helm/charts/metabob-activity-api/templates/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: metabob-activity-api
spec:
  template:
    spec:
      initContainers:
        - name: run-migrations
          image: metabob-activity-api:latest
          command: ["bun", "run", "sql/migrate.ts"]
          env:
            - name: SURREALDB_URL
              value: "http://surrealdb:8000"
            - name: SURREALDB_USERNAME
              valueFrom:
                secretKeyRef:
                  name: surrealdb-credentials
                  key: username
            - name: SURREALDB_PASSWORD
              valueFrom:
                secretKeyRef:
                  name: surrealdb-credentials
                  key: password
      containers:
        - name: api
          image: metabob-activity-api:latest
          # ... rest of container spec
```

### 4. SurrealDB 3.x Authentication Pattern

**The correct SDK pattern:**

```typescript
import { Surreal } from 'surrealdb';

const db = new Surreal();

// Step 1: Connect (no auth yet)
await db.connect('http://surrealdb:8000');

// Step 2: Use namespace/database
await db.use({
  namespace: 'activity-system',
  database: 'learning_loop'
});

// Step 3: Signin as root
await db.signin({
  username: process.env.SURREALDB_USERNAME,
  password: process.env.SURREALDB_PASSWORD,
});

// Step 4: Now you can query
await db.query('SELECT * FROM schema_version;');
```

**WRONG patterns that don't work:**

```typescript
// ❌ Auth in connect options (doesn't work in 3.x)
await db.connect(url, {
  auth: { username, password }
});

// ❌ Signin before use (fails)
await db.signin({ username, password });
await db.use({ namespace, database });

// ❌ Using user/pass fields instead of username/password
await db.signin({ user: 'root', pass: 'changeme' });
```

### 5. Persistent Volume Handling

**Problem:** Old credentials in PVC prevent new credentials from working.

**Solution:** Version your PVCs or use StatefulSet with ordinal naming.

```yaml
# Option 1: Clear data on credentials change
{{- if .Values.persistence.enabled }}
volumeClaimTemplates:
  - metadata:
      name: data
      annotations:
        # Force recreation if credentials change
        checksum/secret: {{ include (print $.Template.BasePath "/secret.yaml") . | sha256sum }}
    spec:
      # ... rest of spec
{{- end }}
```

**Option 2: Include version in PVC name**

```yaml
volumeClaimTemplates:
  - metadata:
      name: data-v{{ .Values.schemaVersion | default 1 }}
```

**Option 3: Document manual cleanup**

```bash
# When credentials change, delete PVC
kubectl delete pvc data-surrealdb-0 -n activity-system
kubectl delete pod surrealdb-0 -n activity-system
# StatefulSet will recreate with new credentials
```

### 6. Complete Deployment Order

```yaml
# helm/helmfile.yaml or activity-system-minimal.yaml.gotmpl
releases:
  # 1. SurrealDB with secrets
  - name: surrealdb
    chart: charts/surrealdb
    namespace: activity-system
    values:
      - persistence:
          enabled: true
          size: 10Gi
        auth:
          # Leave empty to auto-generate
          username: root
          password: ""  # Will be randomly generated
        database:
          namespace: activity-system
          name: learning_loop

  # 2. Migration Job (separate release, depends on surrealdb)
  - name: surrealdb-migrations
    chart: charts/surrealdb-migrations
    namespace: activity-system
    needs:
      - surrealdb
    values:
      - surrealdb:
          service: surrealdb
          port: 8000

  # 3. Application services
  - name: metabob-activity-api
    chart: charts/metabob-activity-api
    namespace: activity-system
    needs:
      - surrealdb
      - surrealdb-migrations  # Wait for migrations
```

### 7. Helm Values Structure

```yaml
# helm/charts/surrealdb/values.yaml
name: surrealdb
namespace: activity-system

image:
  repository: surrealdb/surrealdb
  tag: "v3.0.0"
  pullPolicy: IfNotPresent

# Authentication
auth:
  # Use existing secret or auto-create
  existingSecret: ""  # e.g., "my-surreal-secret"
  username: "root"
  password: ""  # Leave empty for auto-generation
  usernameKey: username
  passwordKey: password

# Database
database:
  namespace: activity-system
  name: learning_loop

# Persistence
persistence:
  enabled: true
  storageClass: ""  # Use default
  size: 10Gi
  accessMode: ReadWriteOnce

# Migration (optional separate chart)
migration:
  enabled: false  # Use separate Job or initContainer
  image:
    repository: metabob-activity-api
    tag: latest
    pullPolicy: IfNotPresent
```

## Implementation Steps

### Step 1: Clean Slate

```bash
# Delete everything
helm uninstall surrealdb -n activity-system
kubectl delete pvc data-surrealdb-0 -n activity-system
kubectl delete secret surrealdb-credentials -n activity-system
```

### Step 2: Update Helm Charts

1. ✅ Fix secret template with `lookup` function
2. ✅ Remove `--auth` flag (doesn't exist in 3.x)
3. ✅ Fix migrate.ts connection pattern
4. ✅ Change migration Job to regular Job (not hook)
5. ✅ Add health check wait in migration script

### Step 3: Deploy

```bash
# Build image with fixed migrate.ts
./scripts/build-vessels.sh metabob-activity-api

# Deploy SurrealDB
cd helm
helmfile -f activity-system-minimal.yaml.gotmpl apply --selector name=surrealdb

# Wait for ready
kubectl wait --for=condition=ready pod/surrealdb-0 -n activity-system --timeout=5m

# Deploy migration Job (separate)
helmfile -f activity-system-minimal.yaml.gotmpl apply --selector name=surrealdb-migrations

# Deploy application
helmfile -f activity-system-minimal.yaml.gotmpl apply
```

### Step 4: Verify

```bash
# Check secret was created
kubectl get secret surrealdb-credentials -n activity-system -o yaml

# Check SurrealDB logs
kubectl logs surrealdb-0 -n activity-system | grep -i "auth\|user"

# Test connection
kubectl run test -n activity-system --rm -i --image=metabob-activity-api:latest --restart=Never -- \
  bun -e "
  import { Surreal } from 'surrealdb';
  const db = new Surreal();
  await db.connect('http://surrealdb:8000');
  await db.use({ namespace: 'activity-system', database: 'learning_loop' });
  const username = await $SHELL('kubectl get secret surrealdb-credentials -o jsonpath={.data.username} | base64 -d');
  const password = await $SHELL('kubectl get secret surrealdb-credentials -o jsonpath={.data.password} | base64 -d');
  await db.signin({ username, password });
  console.log('✓ Authentication successful');
  "
```

## Key Takeaways

1. **Secrets First**: Generate secrets in Helm BEFORE SurrealDB starts
2. **No Helm Hooks for Migration**: Use regular Job or initContainer
3. **SDK Pattern**: connect → use → signin (in that order)
4. **PVC Cleanup**: Old data = old creds, must clean when changing auth
5. **Health Checks**: Always wait for `/health` before connecting
6. **No `--auth` flag**: Just `--user` and `--pass` enable auth in 3.x

## References

- [SurrealDB Kubernetes Deployment](https://surrealdb.com/docs/surrealdb/deployment/kubernetes)
- [SurrealDB Authentication](https://surrealdb.com/docs/surrealdb/security/authentication)
- [Kubernetes Secrets](https://kubernetes.io/docs/concepts/configuration/secret/)
- [Helm Chart Tips](https://helm.sh/docs/howto/charts_tips_and_tricks/)
- [sailrs-io/surrealdb-helm](https://github.com/sailrs-io/surrealdb-helm)
