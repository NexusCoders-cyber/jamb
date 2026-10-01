# Generates favicon artwork from public/logo.png.
# The logo has rounded corners + transparent padding baked in, so at browser
# favicon sizes the artwork looks tiny. We find the bounding box of
# non-transparent pixels and scale THAT to fill the target canvas (small
# margin), producing icon.png (favicon) and apple-icon.png (iOS home screen).
Add-Type -AssemblyName System.Drawing

$root = Split-Path -Parent $PSScriptRoot  # project root
# Scan the 512px rendition, not the multi-megabyte original — padding
# proportions are resolution-independent and 512^2 pixels is instant to scan.
$src  = Join-Path $root 'public\logo-512.png'
if (-not (Test-Path $src)) { Write-Error "Source logo not found: $src"; exit 1 }

$srcImg = [System.Drawing.Bitmap]::new($src)

# ── 1. Find the bounding box of non-transparent pixels ───────────────────────
$bmpData = $srcImg.LockBits(
  (New-Object System.Drawing.Rectangle(0, 0, $srcImg.Width, $srcImg.Height)),
  [System.Drawing.Imaging.ImageLockMode]::ReadOnly,
  [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$bytes = New-Object byte[] ($bmpData.Stride * $srcImg.Height)
[System.Runtime.InteropServices.Marshal]::Copy($bmpData.Scan0, $bytes, 0, $bytes.Length)
$srcImg.UnlockBits($bmpData)

$minX = $srcImg.Width;  $minY = $srcImg.Height
$maxX = 0;              $maxY = 0
for ($y = 0; $y -lt $srcImg.Height; $y++) {
  $row = $y * $bmpData.Stride
  for ($x = 0; $x -lt $srcImg.Width; $x++) {
    $a = $bytes[$row + 4 * $x + 3]
    if ($a -gt 16) {
      if ($x -lt $minX) { $minX = $x }
      if ($x -gt $maxX) { $maxX = $x }
      if ($y -lt $minY) { $minY = $y }
      if ($y -gt $maxY) { $maxY = $y }
    }
  }
}
if ($maxX -le $minX -or $maxY -le $minY) { Write-Error "Logo appears fully transparent"; exit 1 }
Write-Output ("Artwork bounds: x $minX..$maxX, y $minY..$maxY (source $($srcImg.Width)x$($srcImg.Height))")

$cropW = $maxX - $minX + 1
$cropH = $maxY - $minY + 1
# Keep the crop square (favicons are square) — take the larger side, re-center
$side = [Math]::Max($cropW, $cropH)
$cx = [int](($minX + $maxX) / 2)
$cy = [int](($minY + $maxY) / 2)
$cropX = [Math]::Max(0, [Math]::Min($srcImg.Width  - $side, $cx - [int]($side / 2)))
$cropY = [Math]::Max(0, [Math]::Min($srcImg.Height - $side, $cy - [int]($side / 2)))

# ── 2. Render the cropped artwork into padded square canvases ────────────────
# 4% padding: the mark fills ~92% of the canvas — much larger than the old
# full-logo scaling (which wasted up to ~35% on baked-in margins).
function New-Icon([int]$size, [string]$outPath) {
  $canvas = [System.Drawing.Bitmap]::new($size, $size)
  $g = [System.Drawing.Graphics]::FromImage($canvas)
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
  $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
  $g.Clear([System.Drawing.Color]::Transparent)
  $pad = [int]($size * 0.04)
  $dst = New-Object System.Drawing.Rectangle($pad, $pad, ($size - 2 * $pad), ($size - 2 * $pad))
  $srcRect = New-Object System.Drawing.Rectangle($cropX, $cropY, $side, $side)
  $g.DrawImage($srcImg, $dst, $srcRect, [System.Drawing.GraphicsUnit]::Pixel)
  $g.Dispose()
  $canvas.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
  $canvas.Dispose()
  Write-Output ("Wrote $outPath ($size x $size)")
}

New-Icon 256 (Join-Path $root 'src\app\icon.png')        # favicon (Next.js metadata file convention)
New-Icon 180 (Join-Path $root 'src\app\apple-icon.png')  # iOS home-screen icon

$srcImg.Dispose()
Write-Output "Done."
