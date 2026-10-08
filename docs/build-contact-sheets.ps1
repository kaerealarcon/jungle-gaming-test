Add-Type -AssemblyName System.Drawing
$assetRoot = Join-Path $PSScriptRoot '../assets/png/retina'
foreach ($group in @('ui','ships','ship_parts','effects','tiles')) {
  $files = @(Get-ChildItem (Join-Path $assetRoot $group) -Recurse -File | Sort-Object FullName)
  $columns = 6
  $rows = [int][Math]::Ceiling($files.Count / $columns)
  $bitmap = New-Object System.Drawing.Bitmap ($columns*180),($rows*160)
  $canvas = [System.Drawing.Graphics]::FromImage($bitmap)
  $canvas.Clear([System.Drawing.ColorTranslator]::FromHtml('#183443'))
  $font = New-Object System.Drawing.Font 'Arial',9
  $ink = New-Object System.Drawing.SolidBrush ([System.Drawing.ColorTranslator]::FromHtml('#ffebbf'))
  for ($index=0; $index -lt $files.Count; $index++) {
    $image = [System.Drawing.Image]::FromFile($files[$index].FullName)
    $x = ($index%$columns)*180
    $y = [Math]::Floor($index/$columns)*160
    $scale = [Math]::Min(140/$image.Width,110/$image.Height)
    $w = [int]($image.Width*$scale)
    $h = [int]($image.Height*$scale)
    $canvas.DrawImage($image,[int]($x+90-$w/2),[int]($y+60-$h/2),$w,$h)
    $canvas.DrawString($files[$index].BaseName,$font,$ink,[single]($x+6),[single]($y+124))
    $image.Dispose()
  }
  $catalogName = if ($group -eq 'tiles') { 'tile-catalog.png' } else { "$group-catalog.png" }
  $bitmap.Save((Join-Path $PSScriptRoot $catalogName),[System.Drawing.Imaging.ImageFormat]::Png)
  $canvas.Dispose()
  $bitmap.Dispose()
  $font.Dispose()
  $ink.Dispose()
}
