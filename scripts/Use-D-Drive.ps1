# Dot-source this script in EACH terminal: . .\scripts\Use-D-Drive.ps1
# All settings affect the current terminal and its children only.
$projectRoot = Split-Path -Parent $PSScriptRoot
if ([System.IO.Path]::GetPathRoot($projectRoot) -ne 'D:\') { throw 'Keep this project on D: before using this script.' }
$cacheRoot = Join-Path $projectRoot '.cache'
$env:npm_config_cache = Join-Path $cacheRoot 'npm'
$env:npm_config_offline = 'false'
$env:GRADLE_USER_HOME = Join-Path $cacheRoot 'gradle'
$env:ANDROID_HOME = Join-Path $projectRoot '.tools\android-sdk'
$env:ANDROID_SDK_ROOT = $env:ANDROID_HOME
$env:ANDROID_USER_HOME = Join-Path $cacheRoot 'android'
$env:ANDROID_AVD_HOME = Join-Path $cacheRoot 'android-avd'
$env:EXPO_HOME = Join-Path $cacheRoot 'expo'
$env:REACT_NATIVE_PACKAGER_CACHE_DIR = Join-Path $cacheRoot 'metro'
$env:MONGOMS_DOWNLOAD_DIR = Join-Path $cacheRoot 'mongodb-binaries'
$env:TEMP = Join-Path $cacheRoot 'temp'
$env:TMP = $env:TEMP
@($env:npm_config_cache, $env:GRADLE_USER_HOME, $env:ANDROID_HOME, $env:ANDROID_USER_HOME, $env:ANDROID_AVD_HOME, $env:EXPO_HOME, $env:REACT_NATIVE_PACKAGER_CACHE_DIR, $env:MONGOMS_DOWNLOAD_DIR, $env:TEMP) | ForEach-Object { New-Item -ItemType Directory -Force -Path $_ | Out-Null }
$env:Path = "$env:ANDROID_HOME\platform-tools;$env:ANDROID_HOME\emulator;$env:Path"
Write-Host "HR Transport development caches now use $cacheRoot in this terminal."
