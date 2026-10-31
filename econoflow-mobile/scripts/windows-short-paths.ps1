# Creates the Windows junction that keeps the Android native build inside the 260-character
# path limit. NOT YET VERIFIED for the Gradle build (2026-10): the junction alone did not
# move CMake's sources out of the deep path, see setup.md.
#
# Detox's Android setup documents this for Windows checkouts: CMake/ninja derive object-file
# names from the full path of the codegen JNI sources under `node_modules`, and for a checkout
# as deep as `D:\Sources\EconoFlow\econoflow-mobile` they overflow `MAX_PATH`:
#
#   ninja: error: Stat(...ComponentDescriptors.cpp.o): Filename longer than 260 characters
#
# `android/` is already reached through the short root `C:\n\econoflow-mobile\android`;
# `node_modules/` - where those sources live - is not. This script points it at the same
# short root and gives the short root a copy of `package.json`, which Expo's autolinking reads
# from there. It is idempotent: a junction that already points at this project is left alone.
#
#   npm run android:short-paths

$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$shortRoot = 'C:\n\econoflow-mobile'
$nodeModules = Join-Path $projectRoot 'node_modules'
$link = Join-Path $shortRoot 'node_modules'

if (-not (Test-Path $nodeModules)) {
    throw "node_modules not found at $nodeModules - run 'npm install' first."
}

if (-not [System.IO.Directory]::Exists($shortRoot)) {
    [System.IO.Directory]::CreateDirectory($shortRoot) | Out-Null
    Write-Host "Created $shortRoot"
}

if (Test-Path $link) {
    # Two shapes are both fine: a junction to the project's own folder (the native build
    # needs nothing else), or a real folder (a full copy of `node_modules`, which is what a
    # sandboxed tool may have left behind). A real folder is kept: the build only needs the
    # files to be there, and replacing it would mean moving gigabytes.
    Write-Host "$link already exists - keeping it"
} else {
    New-Item -ItemType Junction -Path $link -Target $nodeModules | Out-Null
    Write-Host "Linked $link -> $nodeModules"
}

# The Android project is built from inside the short root, and Expo's autolinking looks for
# `package.json` upwards from there; without this copy settings.gradle fails before any task
# runs ("Couldn't find package.json up from path C:\n\econoflow-mobile\android").
$packageJson = Join-Path $shortRoot 'package.json'
Copy-Item (Join-Path $projectRoot 'package.json') $packageJson -Force
Write-Host "Copied package.json to $packageJson (re-run after npm install)"
