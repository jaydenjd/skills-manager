@echo off
setlocal

set "SCRIPT_DIR=%~dp0"
set "CLI_SCRIPT=%SCRIPT_DIR%skill-manager-cli.cjs"

where node >nul 2>nul
if %ERRORLEVEL%==0 (
  node "%CLI_SCRIPT%" %*
  exit /b %ERRORLEVEL%
)

set "APP_EXE=%SCRIPT_DIR%..\..\Skill Manager.exe"
if exist "%APP_EXE%" (
  set "ELECTRON_RUN_AS_NODE=1"
  "%APP_EXE%" "%CLI_SCRIPT%" %*
  exit /b %ERRORLEVEL%
)

echo Skill Manager CLI requires Node.js or the packaged Skill Manager app runtime. 1>&2
exit /b 1
