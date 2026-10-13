# EconoFlow — run the data migration by hand.
#
# The tool ships inside the EconoFlow image at /app/migrator, and this is the
# same Job the cutover uses. For the cutover itself this becomes an initContainer
# with --auto; see docs/postgres-migration/MIGRATION_TEMPLATE.md section 7.
#
# Usage:
#   pwsh -File run-migration.ps1 -Mode verify    # dry run: compare, copy nothing
#   pwsh -File run-migration.ps1 -Mode migrate   # FIRST run: create schema, copy
#   pwsh -File run-migration.ps1 -Mode schema    # schema only, before any data
#   pwsh -File run-migration.ps1 -Mode copy      # re-copy only (rollback/rehearsal)
#
# Prerequisites, once each:
#   * the PostgreSQL role + database      -> sql/postgres-provision.sql
#   * the read-only SQL Server login      -> sql/sqlserver-readonly-login.sql
#   * the two connection strings sealed into the EconoFlow secret as
#     MIGRATION_SOURCE (SQL Server, econoflow_migrator) and
#     MIGRATION_TARGET (PostgreSQL, econoflow)
#
# IMPORTANT — image digest:
#   This pins the image by digest, because a tag alone does NOT decide what runs.
#   CI publishing :latest does not move a digest-pinned reference, and the pilot
#   lost its site twice to exactly that. Update $ImageDigest deliberately.

param(
    [Parameter(Mandatory = $true)]
    [ValidateSet('verify', 'migrate', 'schema', 'copy')]
    [string]$Mode,

    # The EconoFlow image built from the migration branch. Resolve the digest with:
    #   docker buildx imagetools inspect gitea.fpssoftware.uk/fps-software/econoflow:latest
    [string]$ImageDigest = 'sha256:REPLACE-WITH-THE-BUILT-DIGEST',

    [string]$Namespace = 'econoflow',
    [string]$JobName = 'econoflow-migrate'
)

$ErrorActionPreference = 'Stop'

# Args are the operator's choice, exactly as in the Move cutover.
$toolArgs = switch ($Mode) {
    'verify'  { '["--verify-only"]' }
    'migrate' { '["--migrate", "--truncate"]' }
    'schema'  { '["--migrate-only"]' }
    'copy'    { '["--truncate"]' }
}

$image = "gitea.fpssoftware.uk/fps-software/econoflow@$ImageDigest"

Write-Host "Mode     : $Mode"
Write-Host "Args     : $toolArgs"
Write-Host "Image    : $image"
Write-Host "Namespace: $Namespace"
Write-Host ""

# Delete any previous run first: Jobs are immutable, and a leftover completed Job
# would make `wait` return immediately with the PREVIOUS run's result.
kubectl -n $Namespace delete job $JobName --ignore-not-found

$job = @"
apiVersion: batch/v1
kind: Job
metadata:
  name: $JobName
  namespace: $Namespace
spec:
  backoffLimit: 0
  ttlSecondsAfterFinished: 3600
  template:
    spec:
      restartPolicy: Never
      imagePullSecrets:
        - name: gitea-registry
      containers:
        - name: migrate
          image: $image
          command: ["dotnet", "/app/migrator/EconoFlow.DataMigration.dll"]
          args: $toolArgs
          env:
            - name: MIGRATION_SOURCE
              valueFrom:
                secretKeyRef:
                  name: econoflow-credentials
                  key: MIGRATION_SOURCE
            - name: MIGRATION_TARGET
              valueFrom:
                secretKeyRef:
                  name: econoflow-credentials
                  key: MIGRATION_TARGET
"@

$job | kubectl apply -f -

Write-Host ""
Write-Host "Waiting for the job (up to 30 minutes)..."
kubectl -n $Namespace wait --for=condition=complete "job/$JobName" --timeout=1800s
$completed = $LASTEXITCODE -eq 0

Write-Host ""
Write-Host "=== output ==="
kubectl -n $Namespace logs "job/$JobName" --tail=200

if (-not $completed) {
    Write-Host ""
    Write-Host "Job did NOT complete. Check the log above, then:"
    Write-Host "  kubectl -n $Namespace describe job $JobName"
    exit 1
}

Write-Host ""
Write-Host "Job completed. The copy is verified only if the log ends with:"
Write-Host "  MIGRATION VERIFIED: every table matches the SQL Server source row for row."
