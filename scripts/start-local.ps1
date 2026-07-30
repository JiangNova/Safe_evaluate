[CmdletBinding()]
param(
  [ValidateRange(1, 65535)]
  [int]$Port = 8080,
  [switch]$SkipBuild,
  [switch]$NoBrowser
)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$venvPython = Join-Path $projectRoot '.venv\Scripts\python.exe'

if (Test-Path -LiteralPath $venvPython) {
  $python = $venvPython
} else {
  $pythonCommand = Get-Command python -ErrorAction SilentlyContinue
  if ($null -eq $pythonCommand) {
    throw '未找到 Python；请创建 .venv 或将 python 加入 PATH。'
  }
  $python = $pythonCommand.Source
}

$arguments = @(
  (Join-Path $PSScriptRoot 'local_preview.py'),
  '--port',
  $Port
)
if ($SkipBuild) { $arguments += '--skip-build' }
if ($NoBrowser) { $arguments += '--no-browser' }

& $python @arguments
exit $LASTEXITCODE
