param([switch]$SkipInstall)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $projectRoot
. "$PSScriptRoot\Use-D-Drive.ps1"
if (!(Get-Command node -ErrorAction SilentlyContinue)) { throw 'Install Node.js 22.14+ first (choose a D: installation folder).' }
if (!$SkipInstall) {
  npm install
  if ($LASTEXITCODE -ne 0) { throw 'Dependency installation failed.' }
}
if (!(Test-Path 'apps\api\.env')) {
  $bytes = New-Object byte[] 48
  [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
  $secret = [Convert]::ToBase64String($bytes)
  (Get-Content 'apps\api\.env.example' -Raw).Replace('replace-with-a-random-secret-at-least-32-characters', $secret) | Set-Content 'apps\api\.env' -Encoding utf8
}
if (!(Test-Path 'apps\mobile\.env')) { Copy-Item 'apps\mobile\.env.example' 'apps\mobile\.env' }
Write-Host 'Setup complete. Edit apps\api\.env to choose your HR email/password and phone numbers. Then start the database, seed HR, and start the API and mobile app as explained in README.md.'
