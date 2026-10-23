<#
.SYNOPSIS
    Guards the NuGet package-source mapping in nuget.config.

.DESCRIPTION
    Without a <packageSourceMapping> section NuGet asks EVERY configured feed for EVERY
    package id. The private Gitea feed only holds packages whose id starts with
    `fpssoftware.`, so every public package (microsoft.data.sqlclient,
    swashbuckle.aspnetcore.swaggergen, ...) produced a 403 + retry storm against Gitea
    before it fell through to nuget.org.

    This test pins the invariant that fixes that:

      * fpssoftware.*  -> only the private 'fps-software' feed
      * everything else -> only 'nuget.org'

    It checks every <PackageReference> in the repository, and additionally every
    transitive dependency recorded in the obj/project.assets.json files a previous
    restore produced when those exist. obj/ is gitignored, so a fresh CI checkout (and
    a CI run before Restore) validates the direct references only; the transitive ids
    are covered whenever a restore has already happened.

    Structural validity is not re-implemented here: `dotnet nuget list source` is asked
    whether NuGet itself accepts the file.

    It also flags a nested nuget.config that governs a project, because that config's
    <clear /> replaces the root source list and mappings for that subtree.

    Exit code 0 = pass, 1 = fail. Run from the repository root:
        pwsh -File scripts/nuget-source-mapping.test.ps1
#>

[CmdletBinding()]
param(
    [string] $RepositoryRoot
)

if (-not $RepositoryRoot) {
    # Populated for both `pwsh -File` and `powershell -File`; the -Command fallback
    # only matters if this script is dot-sourced from a shell that lacks it.
    $scriptDirectory = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Path }
    $RepositoryRoot = Split-Path -Parent $scriptDirectory
}

$ErrorActionPreference = 'Stop'
$failures = [System.Collections.Generic.List[string]]::new()

function Fail([string] $message) {
    $failures.Add($message)
    Write-Host "  FAIL  $message" -ForegroundColor Red
}

function Pass([string] $message) {
    Write-Host "  ok    $message" -ForegroundColor Green
}

function Info([string] $message) {
    Write-Host "  info  $message"
}

# Private ids are the ones this repository expects from the Gitea feed. nuget.config
# says a package published under any other id needs its own pattern, so this is the
# prefix a package must carry to be treated as private here.
$privatePrefix = 'fpssoftware.'

function Test-IsPrivateId([string] $packageId) {
    return $packageId.StartsWith($privatePrefix, [StringComparison]::OrdinalIgnoreCase)
}

# Returns every <PackageReference Include="..."> in a project file, or $null when the
# file cannot be read or parsed (after reporting it as a failure). Never throws: an
# unparsable project must produce a named FAIL, not a raw PowerShell conversion error.
function Get-PackageReferences([string] $path) {
    try {
        [xml] $project = Get-Content -LiteralPath $path -Raw -ErrorAction Stop
        $references = @($project.SelectNodes('//PackageReference[@Include]') |
                ForEach-Object { $_.GetAttribute('Include') })
        return $references
    }
    catch {
        $relative = $path.Substring($RepositoryRoot.TrimEnd('\', '/').Length).TrimStart('\', '/')
        # PowerShell wraps the XML error in "Cannot convert value "<the whole file>" to
        # type ... Error: "<real error>"". Dig for the real error; fall back to the last
        # line of the outer message (a .sln gives no XML detail at all).
        $reason = $null
        foreach ($candidate in @($_.Exception, $_.Exception.InnerException, $_.Exception.InnerException.InnerException)) {
            if ($null -eq $candidate -or -not $candidate.Message) { continue }
            if ($candidate.Message -match 'Error: "(?<detail>[^"]+)"') { $reason = $Matches['detail'] }
            elseif ($candidate.Message -notmatch 'Cannot convert value') { $reason = $candidate.Message }
        }
        if (-not $reason) {
            $lines = @($_.Exception.Message.Split("`n") | Where-Object { $_.Trim() })
            $reason = if ($lines.Count -gt 0) { $lines[-1].Trim() } else { 'unknown XML error' }
        }
        if ($reason.Length -gt 200) { $reason = $reason.Substring(0, 200) + '...' }
        Fail "cannot parse '$relative' to read its package references: $reason"
        return $null
    }
}

Write-Host "NuGet package source mapping (root: $RepositoryRoot)"

$configPath = Join-Path $RepositoryRoot 'nuget.config'
if (-not (Test-Path -LiteralPath $configPath)) {
    Fail "nuget.config not found at $configPath"
    exit 1
}

# ── Nested configs ───────────────────────────────────────────────────────────
# NuGet merges a subdirectory nuget.config with the root one, and its <clear />
# restarts the source list (and the mapping) for everything below it. A per-directory
# config therefore silently un-maps a subtree.
#
# easyfinance.client/nuget.config is a pre-existing one: it resets <packageSources> to
# nuget.org only, and it does govern a real restore (EasyFinance.Server includes the
# SPA esproj when BuildingInsideVisualStudio or IncludeSpaProject=true). It is harmless
# only while everything restored under that subtree comes from a public feed, so the
# carve-out below is conditional, not a blanket exemption: it is allowed only while no
# project under it references a private package. Any other nested config fails outright.
$knownNestedConfigs = @('easyfinance.client')

$nestedConfigs = @(Get-ChildItem -LiteralPath $RepositoryRoot -Recurse -Filter 'nuget.config' -File -Force |
        Where-Object { $_.FullName -notmatch '[\\/]node_modules[\\/]' -and $_.FullName -ne $configPath })
foreach ($nestedConfig in $nestedConfigs) {
    # Windows PowerShell 5.1 has no [System.IO.Path]::GetRelativePath.
    $parent = Split-Path -Parent $nestedConfig.FullName
    $relativeParent = $parent.Substring($RepositoryRoot.TrimEnd('\', '/').Length).TrimStart('\', '/').Replace('\', '/')
    if (-not $relativeParent) { $relativeParent = '.' }
    $projectFiles = @(Get-ChildItem -LiteralPath $parent -Recurse -File -ErrorAction SilentlyContinue |
            Where-Object {
                $_.FullName -notmatch '[\\/]node_modules[\\/]' -and
                $_.FullName -notmatch '[\\/](bin|obj)[\\/]' -and
                $_.Extension -in @('.csproj', '.sln', '.esproj')
            })

    if ($projectFiles.Count -eq 0) {
        Info "'$relativeParent\nuget.config' exists but governs no project; it does not affect restore"
        continue
    }

    # The subtree loses the private feed entirely, so any private reference below it
    # can never restore. Check every <PackageReference> written anywhere in it.
    $privateReferences = @()
    foreach ($projectFile in $projectFiles) {
        $references = @(Get-PackageReferences -Path $projectFile.FullName)
        if ($null -eq $references) { continue }   # unparsable: already reported
        foreach ($include in $references) {
            if (Test-IsPrivateId $include) {
                $privateReferences += "$($projectFile.Name): $include"
            }
        }
    }

    if ($privateReferences.Count -gt 0) {
        Fail "'$relativeParent\nuget.config' removes the private feed from that subtree, but it references private package(s): $($privateReferences -join '; ')"
    }
    elseif ($knownNestedConfigs -contains $relativeParent) {
        Info "'$relativeParent\nuget.config' overrides the root sources for that subtree; no private package is referenced there (known)"
    }
    else {
        Fail "nested NuGet config '$relativeParent\nuget.config' overrides the root mapping for the projects below it; remove it or fold its settings into the root nuget.config"
    }
}

# ── NuGet's own reader ───────────────────────────────────────────────────────
# Structural validity (duplicate sections, duplicate keys, malformed patterns) is a
# NuGet rule, not one this script should paraphrase: ask NuGet. A config NuGet rejects
# is a broken build, so a non-zero exit here is a failure regardless of the checks below.
$nuget = Get-Command dotnet -ErrorAction SilentlyContinue
if ($null -eq $nuget) {
    Info 'dotnet not on PATH; skipped the NuGet parser check'
}
else {
    $nugetOutput = & dotnet nuget list source --configfile $configPath 2>&1
    if ($LASTEXITCODE -ne 0) {
        Fail "NuGet rejects nuget.config (dotnet nuget list source exited $LASTEXITCODE): $($nugetOutput -join ' ')"
    }
    else {
        Pass 'NuGet accepts nuget.config'
    }
}

# ── Sources and mapping ──────────────────────────────────────────────────────
[xml] $config = Get-Content -LiteralPath $configPath -Raw
$configuration = $config.configuration

$sourceNodes = @($configuration.packageSources.add)
$sources = @()
foreach ($source in $sourceNodes) { $sources += [string] $source.key }

if ($sources -notcontains 'fps-software') { Fail "packageSource 'fps-software' is missing from nuget.config" }
if ($sources -notcontains 'nuget.org') { Fail "packageSource 'nuget.org' is missing from nuget.config" }

$mappingNodes = @($configuration.packageSourceMapping)
if ($mappingNodes.Count -eq 0 -or $null -eq $mappingNodes[0]) {
    Fail 'nuget.config has no <packageSourceMapping> section: every feed is asked for every package'
    exit 1
}
if ($mappingNodes.Count -gt 1) {
    Fail "nuget.config has $($mappingNodes.Count) <packageSourceMapping> sections; NuGet expects exactly one"
}

$patternsBySource = @{}
$duplicateKeys = @()
foreach ($mappingNode in $mappingNodes) {
    foreach ($packageSource in @($mappingNode.packageSource)) {
        if ($null -eq $packageSource) { continue }
        $key = [string] $packageSource.key
        if ($patternsBySource.ContainsKey($key)) {
            # NuGet refuses this outright ("multiple package sources associated with
            # the same key(s)"), which the parser check above has already reported.
            $duplicateKeys += $key
        }
        $patternsBySource[$key] = @(@($packageSource.package) | ForEach-Object { [string] $_.pattern } |
                Where-Object { $_ })
    }
}
foreach ($key in @($duplicateKeys | Select-Object -Unique)) {
    Fail "<packageSourceMapping> declares '$key' more than once; NuGet refuses a duplicated source key"
}

foreach ($sourceKey in $sources) {
    if (-not $patternsBySource.ContainsKey($sourceKey)) {
        Fail "source '$sourceKey' has no <packageSource> entry in <packageSourceMapping> (NuGet will never use it)"
    }
}
foreach ($sourceKey in $patternsBySource.Keys) {
    if ($sources -notcontains $sourceKey) {
        Fail "<packageSource> maps patterns to '$sourceKey', which is not a configured packageSource"
    }
}

# Returns one entry per matching pattern: @{ Source = ...; Pattern = ... }.
# NuGet lets several patterns match one id (e.g. 'fpssoftware.*' and '*') and picks the
# most specific one, so the pattern is part of the result. Not $matches: that is an
# automatic variable PowerShell owns.
function Get-MappedSources([string] $packageId) {
    $mappedSources = [System.Collections.Generic.List[object]]::new()
    foreach ($sourceKey in $patternsBySource.Keys) {
        $best = $null
        foreach ($pattern in $patternsBySource[$sourceKey]) {
            # NuGet's '*' matches any sequence, including '.' (unlike PowerShell's [wildcard]).
            if ($packageId -like $pattern -and ($null -eq $best -or $pattern.Length -gt $best.Length)) {
                $best = $pattern
            }
        }
        if ($null -ne $best) {
            $mappedSources.Add([pscustomobject]@{ Source = $sourceKey; Pattern = $best })
        }
    }
    return $mappedSources.ToArray()
}

# NuGet's precedence: "Package ID patterns always have the highest precedence while the
# generic '*' always has the lowest precedence. For package prefix patterns, the
# longest has precedence." Equal patterns on two feeds have NO documented tie-break, so
# this only resolves cases NuGet itself makes deterministic; a tie is reported as such
# rather than guessed.
function Get-PatternRank($mappedSource) {
    if ($mappedSource.Pattern -eq '*') { return 0 }
    if ($mappedSource.Pattern.EndsWith('*')) { return 1 }
    return 2
}

function Get-MostSpecific($candidates) {
    return @($candidates | Sort-Object -Property @(
                @{ Expression = { Get-PatternRank $_ }; Descending = $true },
                @{ Expression = { $_.Pattern.Length }; Descending = $true }
            ) | Select-Object -First 1)
}

# Returns the winning entry plus every other entry that is equally specific (none when
# NuGet has a clear winner).
function Get-Winners($candidates) {
    $ranked = @($candidates | Sort-Object -Property @(
                @{ Expression = { Get-PatternRank $_ }; Descending = $true },
                @{ Expression = { $_.Pattern.Length }; Descending = $true }
            ))
    if ($ranked.Count -eq 0) { return @() }
    $first = $ranked[0]
    return @($ranked | Where-Object {
            (Get-PatternRank $_) -eq (Get-PatternRank $first) -and $_.Pattern.Length -eq $first.Pattern.Length
        })
}

function Get-ResolvedSource([string] $packageId) {
    $winners = @(Get-Winners @(Get-MappedSources $packageId))
    # $null means "NuGet does not order these"; callers report that instead of guessing.
    if ($winners.Count -eq 0 -or $winners.Count -gt 1) { return $null }
    return $winners[0].Source
}

# ── Behaviour: private ids go to the private feed only, public ids to nuget.org only ──
# NuGet's precedence is per pattern, and it explicitly allows "the same ID pattern on
# multiple sources, allowing matching package IDs to be restored from ANY of the feeds
# that define the pattern". So a private id must be eligible on Gitea and nowhere else
# below the generic '*' (nuget.org's wildcard always matches it; it just never wins),
# while a public id must match nothing on Gitea at all.
foreach ($probe in @('fpssoftware.chassis', 'fpssoftware.datamigration')) {
    $candidates = @(Get-MappedSources $probe)
    $resolved = Get-ResolvedSource $probe
    $otherFeeds = @($candidates | Where-Object { $_.Source -ne 'fps-software' -and $_.Pattern -ne '*' })
    if ($resolved -eq 'fps-software' -and $otherFeeds.Count -eq 0) {
        Pass "'$probe' -> fps-software only"
    }
    elseif ($otherFeeds.Count -gt 0) {
        Fail "'$probe' also matches [$($otherFeeds.Source -join ', ')]; a private id must map to 'fps-software' alone"
    }
    else {
        $description = if ($resolved) { $resolved } else { 'a feed NuGet does not order' }
        Fail "'$probe' resolves to '$description'; expected 'fps-software'"
    }

    $againstGitea = @($candidates | Where-Object { $_.Source -eq 'fps-software' })
    if ($againstGitea.Count -eq 1) {
        Pass "'$probe' is eligible on the Gitea feed only"
    }
    else {
        Fail "'$probe' matches the Gitea feed $($againstGitea.Count) time(s); expected exactly one pattern"
    }
}

foreach ($probe in @('microsoft.data.sqlclient', 'swashbuckle.aspnetcore.swaggergen', 'Swashbuckle.AspNetCore', 'serilog.sinks.http')) {
    $candidates = @(Get-MappedSources $probe)
    $resolved = Get-ResolvedSource $probe
    if ($candidates.Count -eq 1 -and $resolved -eq 'nuget.org') {
        Pass "'$probe' -> nuget.org only (never queried against Gitea)"
    }
    else {
        Fail "'$probe' is eligible on [$($candidates.Source -join ', ')]; expected only 'nuget.org' so Gitea is never asked for it"
    }
}

# ── Every package the build restores must be mapped ──────────────────────────
$packageReferences = [System.Collections.Generic.SortedSet[string]]::new([System.StringComparer]::OrdinalIgnoreCase)
foreach ($projectFile in Get-ChildItem -LiteralPath $RepositoryRoot -Recurse -Filter '*.csproj' -File) {
    $includes = @(Get-PackageReferences -Path $projectFile.FullName)
    if ($null -eq $includes) { continue }   # unparsable: already reported
    foreach ($include in $includes) { [void] $packageReferences.Add($include) }
}

$assetFiles = @(Get-ChildItem -LiteralPath $RepositoryRoot -Recurse -Filter 'project.assets.json' -File -ErrorAction SilentlyContinue |
        Where-Object { $_.FullName -match '[\\/]obj[\\/]' })

$restoredPackages = [System.Collections.Generic.SortedSet[string]]::new([System.StringComparer]::OrdinalIgnoreCase)
foreach ($assetFile in $assetFiles) {
    $assets = Get-Content -LiteralPath $assetFile.FullName -Raw | ConvertFrom-Json
    foreach ($target in $assets.targets.PSObject.Properties) {
        foreach ($package in $target.Value.PSObject.Properties) {
            $name = $package.Name
            $slash = $name.IndexOf('/')
            if ($slash -gt 0) { [void] $restoredPackages.Add($name.Substring(0, $slash)) }
        }
    }
}

$allPackages = [System.Collections.Generic.SortedSet[string]]::new([System.StringComparer]::OrdinalIgnoreCase)
foreach ($packageId in @($packageReferences) + @($restoredPackages)) { [void] $allPackages.Add($packageId) }

if ($assetFiles.Count -eq 0) {
    Info "no obj/project.assets.json found: $($packageReferences.Count) direct <PackageReference> id(s) checked, transitive ids only after a restore"
}
else {
    Info "$($packageReferences.Count) direct id(s) plus $($restoredPackages.Count) restored id(s) checked"
}

$unmapped = @()
foreach ($packageId in $allPackages) {
    if ((Get-MappedSources $packageId).Count -eq 0) { $unmapped += $packageId }
}

if ($unmapped.Count -eq 0) {
    Pass "$($allPackages.Count) package id(s) all map to a source"
}
else {
    foreach ($packageId in $unmapped) {
        Fail "package '$packageId' is restored by the build but matches no <package pattern> in <packageSourceMapping>"
    }
}

# ── Private ids must always resolve to the private feed ──────────────────────
foreach ($packageId in $allPackages) {
    if (-not (Test-IsPrivateId $packageId)) { continue }
    $resolved = Get-ResolvedSource $packageId
    if ($resolved -ne 'fps-software') {
        Fail "private package '$packageId' resolves to '$resolved'; expected 'fps-software'"
    }
}

# ── Public ids must never be routed to the private feed ──────────────────────
foreach ($packageId in $allPackages) {
    if (Test-IsPrivateId $packageId) { continue }
    if (@(Get-MappedSources $packageId | Where-Object { $_.Source -eq 'fps-software' }).Count -gt 0) {
        Fail "public package '$packageId' is eligible on 'fps-software': the private feed would be asked for it"
    }
}

if ($failures.Count -gt 0) {
    Write-Host ""
    Write-Host "$($failures.Count) failure(s)." -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host 'All package source mapping checks passed.' -ForegroundColor Green
exit 0
