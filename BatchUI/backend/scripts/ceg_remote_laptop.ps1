# Later: Load the encrypted password
$securePassword = Get-Content "D:\batchui\password.txt" | ConvertTo-SecureString
$cred = New-Object System.Management.Automation.PSCredential($username, $securePassword)

# Use it
Invoke-Command -ComputerName remote-machine -Credential $cred -ScriptBlock {
    & "D:\mass_performance66x\etl_wso2_build\your_script.bat"
}
