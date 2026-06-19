$procs = Get-Process | Where-Object { $_.ProcessName -match 'electron|node|Docx|Proofread|conhost' }
$procs | Select-Object Id, ProcessName, Path | Format-Table -AutoSize
