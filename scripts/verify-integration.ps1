param([string]$BaseUrl = 'http://127.0.0.1')

$ErrorActionPreference = 'Stop'

$checks = @(
  @{ Path = '/'; Contains = '<title>AGULAB' },
  @{ Path = '/about'; Contains = '<title>AGULAB' },
  @{ Path = '/evaluate'; Contains = 'content="SafeEvaluate"' },
  @{ Path = '/login'; Contains = 'content="SafeEvaluate"' },
  @{ Path = '/history'; Contains = 'content="SafeEvaluate"' },
  @{ Path = '/report/test-id'; Contains = 'content="SafeEvaluate"' },
  @{ Path = '/rules'; Contains = 'content="SafeEvaluate"' },
  @{ Path = '/stats'; Contains = 'content="SafeEvaluate"' }
)

foreach ($check in $checks) {
  $response = Invoke-WebRequest -Uri "$BaseUrl$($check.Path)" -UseBasicParsing
  if (
    $response.StatusCode -ne 200 -or
    $response.Content -notmatch [regex]::Escape($check.Contains)
  ) {
    throw "Integration check failed: $($check.Path)"
  }
}

$health = Invoke-RestMethod -Uri "$BaseUrl/api/health"
if ($health.status -ne 'ok') {
  throw 'Integration check failed: /api/health'
}

Write-Host 'All integration routes passed.'
