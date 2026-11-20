@echo off
chcp 65001 > nul
cd /d "%~dp0"
echo === RunAnalyz 인스타 카드뉴스 자동 생성 ===
python generate_insta_cards.py
echo.
echo insta_cards 폴더를 확인하세요.
pause
