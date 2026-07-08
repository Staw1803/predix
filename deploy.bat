@echo off
echo ===================================================
echo   Predix - Firebase Deploy Helper (Self-Healing)
echo ===================================================
echo.

rem Check if .firebaserc exists. If not, ask the user for their Project ID.
if not exist .firebaserc (
    echo [CONFIG] Nao encontramos nenhum projeto Firebase vinculado a esta pasta.
    echo Para prosseguir, precisamos do ID do seu projeto Firebase.
    echo (Voce pode encontrar o ID no console do Firebase, ex: "predix-market-a123")
    echo.
    set /p PROJECT_ID="Digite o ID do seu projeto Firebase: "
    
    rem Write the .firebaserc file
    echo { "projects": { "default": "%PROJECT_ID%" } } > .firebaserc
    echo.
    echo [CONFIG] Projeto vinculado com sucesso! Criado o arquivo .firebaserc.
    echo.
)

echo 1. Compilando o site para producao...
call npm run build
if %errorlevel% neq 0 (
    echo.
    echo [ERRO] Falha na compilacao do TypeScript/Vite.
    pause
    exit /b %errorlevel%
)
echo.
echo 2. Autenticando no Firebase...
call npx firebase-tools login
echo.
echo 3. Iniciando Deploy para o Firebase Hosting...
call npx firebase-tools deploy --only hosting
echo.
echo ===================================================
echo   Deploy concluido! Verifique o link acima.
echo ===================================================
pause
