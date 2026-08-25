$files = @(
  'src\components\Footer.tsx',
  'src\pages\Home.tsx',
  'src\pages\ProvincePage.tsx',
  'src\pages\UniversityPage.tsx',
  'src\pages\ReservedPage.tsx',
  'src\pages\AboutPage.tsx',
  'src\components\columns\RencaiColumn.tsx',
  'src\components\columns\XuandiaoColumn.tsx',
  'src\components\columns\ShiyeColumn.tsx'
)
foreach ($f in $files) {
  $c = Get-Content $f -Raw -Encoding UTF8
  $c = $c -replace 'max-w-7xl', 'max-w-[1680px]'
  Set-Content $f $c -NoNewline -Encoding UTF8
  Write-Output "updated: $f"
}
Write-Output "done"
