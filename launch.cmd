@echo off
rem InsightHunter launcher — starts the local server and opens the app in your browser.
rem Keep this window open while using the app; close it to stop the server.
cd /d "%~dp0"
node tools\serve.mjs --open
