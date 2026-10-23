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

    Finally it checks that the Docker build gets the same mapping: the image restores
    from inside the build stage, where only files the Dockerfile COPYs exist. If the
    root nuget.config is not copied there (or a later COPY brings
    easyfinance.client/nuget.config in and overrides it), the container restore falls
    back to an unmapped source list and asks Gitea for every public package.

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
# NuGet resolves its config walking up from each project and merges the files it finds.
# A subdirectory nuget.config is only harmful when it resets the inherited state: a
# <clear /> in <packageSources> drops BOTH the private feed and the root
# <packageSourceMapping> for that whole subtree. A nested config that inherits (no
# <clear />, e.g. only disabling a source) is fine and is not reported.
foreach ($nestedConfig in @(Get-ChildItem -LiteralPath $RepositoryRoot -Recurse -Filter 'nuget.config' -File -Force |
            Where-Object { $_.FullName -notmatch '[\\/]node_modules[\\/]' -and $_.FullName -ne $configPath })) {

    # Windows PowerShell 5.1 has no [System.IO.Path]::GetRelativePath.
    $parent = Split-Path -Parent $nestedConfig.FullName
    $relativeParent = $parent.Substring($RepositoryRoot.TrimEnd('\', '/').Length).TrimStart('\', '/').Replace('\', '/')
    if (-not $relativeParent) { $relativeParent = '.' }

    $nestedConfiguration = $null
    try {
        [xml] $nestedXml = Get-Content -LiteralPath $nestedConfig.FullName -Raw -ErrorAction Stop
        $nestedConfiguration = $nestedXml.configuration
    }
    catch {
        Fail "cannot parse '$relativeParent\nuget.config': $($_.Exception.Message.Split("`n")[-1].Trim())"
        continue
    }

    # NuGet's rule: "<clear /> present for a given node" makes it ignore previously
    # defined values FOR THAT NODE. Clearing <packageSources> drops the private feed;
    # clearing <packageSourceMapping> drops the root mapping, which leaves every feed
    # unmapped — the 403 storm this whole exercise exists to stop. Both count.
    $clearsSources = $nestedConfiguration.packageSources -and
        @($nestedConfiguration.packageSources.clear).Count -gt 0
    $clearsMapping = $nestedConfiguration.packageSourceMapping -and
        @($nestedConfiguration.packageSourceMapping.clear).Count -gt 0

    if (-not ($clearsSources -or $clearsMapping)) {
        Info "'$relativeParent\nuget.config' clears neither the inherited sources nor the inherited mapping; it inherits both"
        continue
    }

    $clearedNode = if ($clearsMapping) { 'packageSourceMapping' } else { 'packageSources' }

    $projectFiles = @(Get-ChildItem -LiteralPath $parent -Recurse -File -ErrorAction SilentlyContinue |
            Where-Object {
                $_.FullName -notmatch '[\\/]node_modules[\\/]' -and
                $_.FullName -notmatch '[\\/](bin|obj)[\\/]' -and
                $_.Extension -in @('.csproj', '.sln', '.esproj')
            })

    if ($projectFiles.Count -eq 0) {
        Info "'$relativeParent\nuget.config' clears <$clearedNode /> but governs no project; it does not affect restore"
        continue
    }

    # Clearing the sources loses the private feed, so any private reference below it can
    # never restore. Check every <PackageReference> written anywhere in it.
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

    if ($clearsMapping) {
        Fail "nested NuGet config '$relativeParent\nuget.config' clears <packageSourceMapping /> for the projects below it, leaving every feed unmapped; remove that <clear /> or fold its settings into the root nuget.config"
    }
    elseif ($privateReferences.Count -gt 0) {
        Fail "'$relativeParent\nuget.config' removes the private feed from that subtree, but it references private package(s): $($privateReferences -join '; ')"
    }
    else {
        Fail "nested NuGet config '$relativeParent\nuget.config' clears <packageSources /> for the projects below it; remove its <clear /> so it inherits the root mapping, or fold its settings into the root nuget.config"
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

# ── The Docker build must restore with this mapping ──────────────────────────
# The image restores inside its build stage, where only COPYed files exist. NuGet
# resolves its config walking up from each project, so a nuget.config further down
# the tree wins for that subtree: copying it in after the root one silently replaces
# the mapping. Both directions are checked here.
function Test-DockerMapping {
    $dockerfilePath = Join-Path $RepositoryRoot 'Dockerfile'
    if (-not (Test-Path -LiteralPath $dockerfilePath)) {
        # This repository ships a container image (see docker-publish.yml); a missing
        # Dockerfile means the check cannot prove anything, so treat it as a failure
        # rather than silently passing a restore path that may then flood Gitea.
        Fail 'no Dockerfile found: the container restore path is unverified (scripts/nuget-source-mapping.test.ps1 expects one)'
        return
    }

    # Drop continuation lines and comments so each instruction is one line.
    try {
        $lines = @(Get-Content -LiteralPath $dockerfilePath -ErrorAction Stop)
    }
    catch {
        Fail "cannot read the Dockerfile: $($_.Exception.Message)"
        return
    }
    $instructions = @()
    $buffer = ''
    foreach ($line in $lines) {
        $trimmed = $line.Trim()
        if ($trimmed.StartsWith('#')) { continue }
        if ($trimmed.EndsWith('\')) { $buffer += $trimmed.TrimEnd('\') + ' '; continue }
        $complete = ($buffer + $trimmed).Trim()
        $buffer = ''
        if ($complete) { $instructions += $complete }
    }

    # Everything the build stage receives, as '<context path> -> <image path>'.
    # A directory source carries EVERYTHING below it, which is where a nested
    # nuget.config hides: 'COPY easyfinance.client/ ...' brings
    # easyfinance.client/nuget.config along without naming it.
    $copied = @()
    $firstRestoreIndex = $null
    for ($index = 0; $index -lt $instructions.Count; $index++) {
        $instruction = $instructions[$index]
        # A restore boundary: an explicit restore/publish, or a build/test that restores
        # implicitly. Anything before the first one is present when NuGet resolves config.
        if ($instruction -match '^RUN\s.*\bdotnet\s+(restore|publish|build|test|run)\b' -and $null -eq $firstRestoreIndex) {
            $firstRestoreIndex = $index
        }
        if ($instruction -notmatch '^COPY\s+(?<rest>.+)$') { continue }
        $rest = $Matches['rest']
        # 'COPY --from=<stage> ...' copies out of another stage, not the build context.
        if ($rest -match '--from=') { continue }
        # Split on whitespace: a context path with spaces is legal (Docker also accepts
        # JSON-array form, which no instruction here uses).
        $tokens = @($rest -split '\s+' | Where-Object { $_ -and -not $_.StartsWith('--') })
        if ($tokens.Count -lt 2) { continue }
        $destination = $tokens[-1]
        foreach ($source in $tokens[0..($tokens.Count - 2)]) {
            # A leading './' is a prefix, not a character set: do not use TrimStart.
            $contextPath = if ($source.StartsWith('./')) { $source.Substring(2) } else { $source }
            $copied += [pscustomobject]@{ Source = $contextPath; Destination = $destination; Index = $index; IsDirectory = $false }

            $absolute = Join-Path $RepositoryRoot $contextPath.TrimEnd('/')
            if (Test-Path -LiteralPath $absolute -PathType Container) {
                foreach ($nestedConfig in @(Get-ChildItem -LiteralPath $absolute -Recurse -Filter 'nuget.config' -File -Force -ErrorAction SilentlyContinue |
                            Where-Object { $_.FullName -notmatch '[\\/]node_modules[\\/]' })) {
                    $relative = $nestedConfig.FullName.Substring($RepositoryRoot.TrimEnd('\', '/').Length).TrimStart('\', '/').Replace('\', '/')
                    $copied += [pscustomobject]@{ Source = $relative; Destination = $destination; Index = $index; IsDirectory = $true }
                }
            }
        }
    }

    $rootConfigCopied = @($copied | Where-Object { $_.Source -eq 'nuget.config' })
    $nestedCopied = @($copied | Where-Object { $_.Source -match 'nuget\.config$' -and $_.Source -ne 'nuget.config' })

    if ($rootConfigCopied.Count -eq 0) {
        Fail 'Dockerfile does not COPY nuget.config into the build stage: the container restore has no packageSourceMapping and asks Gitea for every public package'
    }
    else {
        Pass 'Dockerfile copies nuget.config into the build stage'
    }

    foreach ($copy in $nestedCopied) {
        # Harmless when the config inherits (no <clear />): NuGet merges it with the root
        # and keeps the root sources and mapping. Harmful only when it resets state AND
        # is present during a restore.
        $nestedResets = $false
        try {
            [xml] $nestedXml = Get-Content -LiteralPath (Join-Path $RepositoryRoot $copy.Source) -Raw -ErrorAction Stop
            $nestedConfiguration = $nestedXml.configuration
            # Only <packageSources> and <packageSourceMapping> can un-map a subtree.
            # A <clear /> inside <disabledPackageSources> merely re-enables inherited
            # sources, so it is deliberately not treated as a reset.
            $nestedResets = ($nestedConfiguration.packageSources -and @($nestedConfiguration.packageSources.clear).Count -gt 0) -or
                ($nestedConfiguration.packageSourceMapping -and @($nestedConfiguration.packageSourceMapping.clear).Count -gt 0)
        }
        catch {
            # The nested-config scan above already reported an unparsable file.
            continue
        }

        if (-not $nestedResets) {
            Info "'$($copy.Source)' reaches the build stage but clears nothing; it inherits the root sources and mapping"
            continue
        }

        # The question is "is this config present when a restore runs?", i.e. does its
        # COPY come before the FIRST restore — not whether the root config came first.
        $landsBeforeRestore = $null -ne $firstRestoreIndex -and $copy.Index -lt $firstRestoreIndex
        if ($landsBeforeRestore) {
            Fail "Dockerfile copies '$($copy.Source)' into the build stage before the first restore, and that config resets the inherited sources or mapping for that subtree; the container restore then loses the mapping"
        }
        else {
            Info "'$($copy.Source)' reaches the build stage only after the first restore; it cannot affect it"
        }
    }

    # Registering the feed by command writes the user-level config, which carries no
    # mapping; it only makes sense when the root config is not copied.
    if ($rootConfigCopied.Count -gt 0) {
        $addSource = @($instructions | Where-Object { $_ -match 'dotnet nuget add source' })
        if ($addSource.Count -gt 0) {
            Fail 'Dockerfile registers the feed with "dotnet nuget add source", which writes an unmapped user-level config; copy nuget.config instead'
        }
        else {
            Pass 'Dockerfile does not register an unmapped user-level feed'
        }
    }
}

Test-DockerMapping

if ($failures.Count -gt 0) {
    Write-Host ""
    Write-Host "$($failures.Count) failure(s)." -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host 'All package source mapping checks passed.' -ForegroundColor Green
exit 0
