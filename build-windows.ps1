param(
    [string]$Python = 'python',
    [string]$Npm = 'npm.cmd'
)
$ErrorActionPreference = 'Stop'
Push-Location $PSScriptRoot
try {
    & $Python packaging/windows/build.py --npm $Npm
    if ($LASTEXITCODE -ne 0) { throw "Windows build failed (exit $LASTEXITCODE)." }
} finally { Pop-Location }
