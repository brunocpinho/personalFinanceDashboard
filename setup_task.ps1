$action = New-ScheduledTaskAction -Execute "python" -Argument "C:\Users\bruno\Financeiro_Dashboard\sync_itau.py" -WorkingDirectory "C:\Users\bruno\Financeiro_Dashboard"
$trigger = New-ScheduledTaskTrigger -AtLogOn
$trigger.Delay = "PT30M"
$principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive
Register-ScheduledTask -TaskName "DashboardFinanceiro_SyncItau" -Action $action -Trigger $trigger -Principal $principal -Force
