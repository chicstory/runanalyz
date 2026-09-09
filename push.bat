@echo off
chcp 65001 > nul
set "PATH=C:\Program Files\Git\cmd;%PATH%"

echo ========================================================
echo   [RunAnalyz] 러닝 분석 대시보드 GitHub 배포기
echo   원격 저장소: https://github.com/chicstory/runanalyz.git
echo ========================================================

cd /d "%~dp0"

if not exist ".git" (
    echo [1/4] Git 저장소 초기화 중...
    git init
    git branch -M main
    git remote add origin https://github.com/chicstory/runanalyz.git
)

echo [2/4] 변경 사항 명시적 스테이징 (보안 수칙 준수)...
git add index.html style.css app.js activities_data.js .gitignore push.bat

echo [3/4] 커밋 생성 중...
git commit -m "feat: RunAnalyz test deployment with August running data"

echo [4/4] GitHub로 푸시 중 (main 브랜치)...
git push -u origin main

echo.
echo ========================================================
echo   배포가 완료되었습니다!
echo   접속 주소: https://chicstory.github.io/runanalyz/
echo   (GitHub 저장소 Settings > Pages 에서 Source를 main 브랜치로 설정해주세요)
echo ========================================================
pause
