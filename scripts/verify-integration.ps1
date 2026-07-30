param([string]$BaseUrl = 'http://127.0.0.1')

$ErrorActionPreference = 'Stop'

$redirectChecks = @(
  @{ Path = '/website-static'; Location = '/' },
  @{ Path = '/website-static/'; Location = '/' },
  @{ Path = '/evaluate'; Location = '/evaluate/' },
  @{ Path = '/evaluate_tianxin'; Location = '/evaluate_tianxin/' }
)

foreach ($check in $redirectChecks) {
  $request = [System.Net.HttpWebRequest]::Create(
    "$BaseUrl$($check.Path)"
  )
  $request.AllowAutoRedirect = $false
  $response = $null
  try {
    $response = $request.GetResponse()
    $statusCode = [int]$response.StatusCode
    $location = $response.Headers['Location']
  } finally {
    if ($null -ne $response) {
      $response.Close()
    }
  }
  if ($statusCode -ne 302 -or $location -ne $check.Location) {
    throw "Redirect check failed: $($check.Path)"
  }
}

$checks = @(
  @{ Path = '/'; Contains = '<title>AGULAB' },
  @{ Path = '/about'; Contains = '<title>AGULAB' },
  @{ Path = '/evaluate/'; Contains = 'content="AGULAB Public Evaluation"' },
  @{ Path = '/evaluate/future/workflow'; Contains = 'content="AGULAB Public Evaluation"' },
  @{ Path = '/evaluate_tianxin/login'; Contains = 'content="SafeEvaluate"' },
  @{ Path = '/evaluate_tianxin/evaluate'; Contains = 'content="SafeEvaluate"' },
  @{ Path = '/evaluate_tianxin/history'; Contains = 'content="SafeEvaluate"' },
  @{ Path = '/evaluate_tianxin/report/test-id'; Contains = 'content="SafeEvaluate"' },
  @{ Path = '/evaluate_tianxin/rules'; Contains = 'content="SafeEvaluate"' },
  @{ Path = '/evaluate_tianxin/stats'; Contains = 'content="SafeEvaluate"' },
  @{ Path = '/evaluate-evil'; Contains = '<title>AGULAB' },
  @{ Path = '/evaluate_tianxin-evil'; Contains = '<title>AGULAB' }
)

$pageResponses = @{}
foreach ($check in $checks) {
  $response = Invoke-WebRequest -Uri "$BaseUrl$($check.Path)" -UseBasicParsing
  if (
    $response.StatusCode -ne 200 -or
    $response.Content -notmatch [regex]::Escape($check.Contains)
  ) {
    throw "Integration check failed: $($check.Path)"
  }
  $pageResponses[$check.Path] = $response
}

$assetChecks = @(
  @{ Page = '/'; Prefix = '/website-static/' },
  @{ Page = '/evaluate/'; Prefix = '/evaluate/assets/' },
  @{ Page = '/evaluate_tianxin/login'; Prefix = '/evaluate_tianxin/assets/' }
)

foreach ($assetCheck in $assetChecks) {
  $escapedPrefix = [regex]::Escape($assetCheck.Prefix)
  $pattern = '(?i)(?:src|href)="(?<path>' + $escapedPrefix + '[^"]+)"'
  $match = [regex]::Match(
    $pageResponses[$assetCheck.Page].Content,
    $pattern
  )
  if (-not $match.Success) {
    throw "No build asset found in: $($assetCheck.Page)"
  }

  $assetPath = $match.Groups['path'].Value
  $assetResponse = Invoke-WebRequest -Uri "$BaseUrl$assetPath" -UseBasicParsing
  if ($assetResponse.StatusCode -ne 200) {
    throw "Integration asset check failed: $assetPath"
  }
}

$missingAssetChecks = @(
  '/evaluate/assets/does-not-exist.js',
  '/evaluate_tianxin/assets/does-not-exist.js'
)

foreach ($missingAssetPath in $missingAssetChecks) {
  $statusCode = $null
  try {
    $response = Invoke-WebRequest -Uri "$BaseUrl$missingAssetPath" -UseBasicParsing
    $statusCode = $response.StatusCode
  } catch {
    if ($null -ne $_.Exception.Response) {
      $statusCode = [int]$_.Exception.Response.StatusCode
    } else {
      throw
    }
  }
  if ($statusCode -ne 404) {
    throw "Missing asset did not return 404: $missingAssetPath"
  }
}

$health = Invoke-RestMethod -Uri "$BaseUrl/api/health"
if ($health.status -ne 'ok') {
  throw 'Integration check failed: /api/health'
}

Write-Host 'All three frontend routes, assets, and API health passed.'
