param([string]$SdkPath, [string]$AvdHome)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $projectRoot
. "$PSScriptRoot\Use-D-Drive.ps1"
# Reuse an installed SDK when this project's SDK folder is empty.
if (!$SdkPath) {
  $SdkPath = $env:ANDROID_HOME
  if (!(Test-Path "$SdkPath\emulator\emulator.exe")) { $SdkPath = "$env:LOCALAPPDATA\Android\Sdk" }
}
if (!(Test-Path "$SdkPath\emulator\emulator.exe")) { throw 'Install Android Emulator through Android Studio SDK Manager first.' }
$env:ANDROID_HOME = $SdkPath
$env:ANDROID_SDK_ROOT = $SdkPath
$env:Path = "$SdkPath\platform-tools;$SdkPath\emulator;$env:Path"
if (!$AvdHome) {
  $AvdHome = $env:ANDROID_AVD_HOME
  if (!(Get-ChildItem -LiteralPath $AvdHome -Filter '*.ini')) { $AvdHome = "$env:USERPROFILE\.android\avd" }
}
$env:ANDROID_AVD_HOME = $AvdHome
$devices = @(& "$SdkPath\emulator\emulator.exe" -list-avds)
if (!$devices.Count) { throw 'Create a virtual phone in Android Studio > Device Manager, then run this script again.' }
$mobileEnv = Join-Path $projectRoot 'apps\mobile\.env'
$content = Get-Content -LiteralPath $mobileEnv -Raw
$setting = 'EXPO_PUBLIC_API_URL=http://10.0.2.2:4000/api/v1'
if ($content -match '(?m)^EXPO_PUBLIC_API_URL=') { $content = $content -replace '(?m)^EXPO_PUBLIC_API_URL=.*', $setting }
else { $content += "`r`n$setting`r`n" }
[IO.File]::WriteAllText($mobileEnv, $content)
try { $health = Invoke-RestMethod 'http://127.0.0.1:4000/health' -TimeoutSec 3 } catch { $health = $null }
if (!$health) {
  $api = Start-Process -FilePath (Get-Command node.exe).Source -ArgumentList '--env-file=.env','src/server.js' -WorkingDirectory "$projectRoot\apps\api" -WindowStyle Hidden -PassThru -RedirectStandardOutput "$projectRoot\.cache\api-android.log" -RedirectStandardError "$projectRoot\.cache\api-android-error.log"
  for ($i = 0; $i -lt 30; $i++) {
    Start-Sleep -Seconds 1
    try { $health = Invoke-RestMethod 'http://127.0.0.1:4000/health' -TimeoutSec 2; break } catch {}
    if ($api.HasExited) { break }
  }
  if (!$health) { throw 'Backend did not start. Check .cache\api-android-error.log and the Atlas connection in apps\api\.env.' }
  Write-Host "Backend started (process $($api.Id))."
}
Write-Host 'Opening HR Transport on an Android virtual phone. Keep this terminal open while using the app.'
& npm.cmd run android
if ($LASTEXITCODE -ne 0) { throw 'Android launch failed. Check the Expo output above.' }
