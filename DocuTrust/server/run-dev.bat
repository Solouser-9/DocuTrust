@echo off
rem Dev runner for Windows: compiles if needed (ECJ fallback), loads .env, starts the API.
setlocal enabledelayedexpansion
cd /d "%~dp0"

if not exist "target\classes\com\docutrust" (
  echo [run-dev] target\classes missing - compiling with ECJ...
  if not exist target\classes mkdir target\classes
  dir /s /b src\main\java\*.java > "%TEMP%\docutrust-srcs.txt"
  java -jar C:\ecj\ecj-3.36.0.jar -21 -nowarn -d target\classes @"%TEMP%\docutrust-srcs.txt"
  if errorlevel 1 (
    echo [run-dev] compile failed - run compile-check first
    exit /b 1
  )
)

if exist .env (
  for /f "usebackq eol=# tokens=1,* delims==" %%a in (".env") do set "%%a=%%b"
)

java -cp "target\classes;lib\postgresql-42.7.4.jar" com.docutrust.Main
