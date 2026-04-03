$file = 'c:\Users\sudee\OneDrive\Desktop\ashraya\client\src\components\common\VoiceAssistant.jsx'
$c = [IO.File]::ReadAllText($file)

# Fix corrupted emoji/symbols - replace the garbled sequences with clean text equivalents
$c = $c.Replace('ðŸŒ¿ Ashraya Assistant', 'Ashraya Assistant')
$c = $c.Replace('Live voice Â· Browser', 'Live voice · Browser')
$c = $c.Replace("On âœ"", 'On ✓')
$c = $c.Replace("assistantEnabled ? 'On âœ"' : 'Off'", "assistantEnabled ? 'On' : 'Off'")
$c = $c.Replace("'ðŸ"´ Listeningâ€¦'", "'Listening...'")
$c = $c.Replace("'â³ Thinkingâ€¦'", "'Thinking...'")
$c = $c.Replace("'âšª Standby'", "'Standby'")
$c = $c.Replace("'Ready â€" tap to speak'", "'Ready — tap to speak'")
$c = $c.Replace('ðŸŒ¿ ${response}', '${response}')
$c = $c.Replace("'Voice quota exceeded â€" browser fallback active.'", "'Voice quota exceeded — browser fallback active.'")
$c = $c.Replace('ðŸŒ¿ {item.assistant}', '{item.assistant}')
$c = $c.Replace("'â³ Workingâ€¦'", "'Working...'")
$c = $c.Replace("'ðŸ"´ Stop Listening'", "'Stop Listening'")
$c = $c.Replace("'ðŸŽ™ Tap to Speak Now'", "'Tap to Speak Now'")
$c = $c.Replace("open ? 'âœ• Close'", "open ? 'Close'")
$c = $c.Replace(": 'ðŸŽ™ Assistant'", ": 'Assistant'")

[IO.File]::WriteAllText($file, $c, [System.Text.Encoding]::UTF8)
Write-Host 'VoiceAssistant symbols fixed'
