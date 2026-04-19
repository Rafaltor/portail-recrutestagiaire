# Hook Cursor `stop` : commit + push après chaque fin de tour d'agent (status completed).
# Ne fait rien si le tour s'est terminé en erreur / abort, ou s'il n'y a aucun changement.
$ErrorActionPreference = "SilentlyContinue"

try {
  $raw = [Console]::In.ReadToEnd()
  if ([string]::IsNullOrWhiteSpace($raw)) {
    Write-Output "{}"
    exit 0
  }
  $j = $raw | ConvertFrom-Json
  if ($null -ne $j.status -and $j.status -ne "completed") {
    Write-Output "{}"
    exit 0
  }
}
catch {
  Write-Output "{}"
  exit 0
}

# Le répertoire courant est la racine du projet (hooks projet Cursor).
$porcelain = git status --porcelain 2>$null
if (-not $porcelain) {
  Write-Output "{}"
  exit 0
}

$msg = "chore: auto $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
git add -A 2>$null
git commit -m $msg 2>$null
if ($LASTEXITCODE -ne 0) {
  Write-Output "{}"
  exit 0
}

git push 2>$null

Write-Output "{}"
exit 0
