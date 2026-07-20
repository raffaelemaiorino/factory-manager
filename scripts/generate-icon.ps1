Add-Type -AssemblyName System.Drawing
$assetsDir = Join-Path $PSScriptRoot '..\src\renderer\assets'
$pngPath = Join-Path $assetsDir 'app-icon.png'
$icoPath = Join-Path $assetsDir 'icon.ico'
$png = [System.Drawing.Image]::FromFile($pngPath)
$bmp = New-Object System.Drawing.Bitmap 256, 256
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.DrawImage($png, 0, 0, 256, 256)
$g.Dispose()
$hIcon = $bmp.GetHicon()
$icon = [System.Drawing.Icon]::FromHandle($hIcon)
$fs = [System.IO.File]::Open($icoPath, [System.IO.FileMode]::Create)
$icon.Save($fs)
$fs.Close()
$icon.Dispose()
$bmp.Dispose()
$png.Dispose()
Write-Output "Generated $icoPath"
