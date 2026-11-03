# Fills in and confirms the native "Save as" dialog of the desktop app, so the
# smoke test covers the real save path. UI Automation finds the controls; they
# are driven with plain window messages (the dialog's file-name box and Save
# button don't expose UIA value/invoke patterns on every Windows build).
param([Parameter(Mandatory)][int]$AppPid, [Parameter(Mandatory)][string]$Path)

Add-Type -AssemblyName UIAutomationClient, UIAutomationTypes
Add-Type -Namespace Win32 -Name User32 -MemberDefinition @'
[DllImport("user32.dll", CharSet = CharSet.Unicode)]
public static extern IntPtr SendMessage(IntPtr hWnd, uint msg, IntPtr wParam, string lParam);
[DllImport("user32.dll")]
public static extern IntPtr SendMessage(IntPtr hWnd, uint msg, IntPtr wParam, IntPtr lParam);
'@
$WM_SETTEXT = 0x000C
$BM_CLICK = 0x00F5

$A = [System.Windows.Automation.AutomationElement]
$P = [System.Windows.Automation.PropertyCondition]
$scope = [System.Windows.Automation.TreeScope]

$deadline = (Get-Date).AddSeconds(30)
$dialog = $null
while (-not $dialog -and (Get-Date) -lt $deadline) {
  $byPid = New-Object $P ($A::ProcessIdProperty, $AppPid)
  $byClass = New-Object $P ($A::ClassNameProperty, '#32770')
  $dialog = $A::RootElement.FindFirst($scope::Descendants, (New-Object System.Windows.Automation.AndCondition ($byPid, $byClass)))
  if (-not $dialog) { Start-Sleep -Milliseconds 250 }
}
if (-not $dialog) { throw 'Save dialog did not appear' }

function Find-Hwnd([string]$class, [string]$id) {
  $cond = New-Object System.Windows.Automation.AndCondition ((New-Object $P ($A::ClassNameProperty, $class)), (New-Object $P ($A::AutomationIdProperty, $id)))
  $el = $dialog.FindFirst($scope::Descendants, $cond)
  if (-not $el) { throw "Control $class #$id not found in the Save dialog" }
  [IntPtr]$el.Current.NativeWindowHandle
}

[void][Win32.User32]::SendMessage((Find-Hwnd 'Edit' '1001'), $WM_SETTEXT, [IntPtr]::Zero, $Path)
[void][Win32.User32]::SendMessage((Find-Hwnd 'Button' '1'), $BM_CLICK, [IntPtr]::Zero, [IntPtr]::Zero)
