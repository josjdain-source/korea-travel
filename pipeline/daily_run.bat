@echo off
cd /d "%~dp0.."
python pipeline\run.py >> pipeline\run.log 2>&1
