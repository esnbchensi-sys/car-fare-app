@echo off

echo ==================================================
echo ==      Car Fare Calculator Server Setup      ==
echo ==================================================
echo.

echo [Step 1/3] Changing directory to server...
cd server

echo.
echo [Step 2/3] Installing dependencies (this may take a moment)...
npm install

echo.
echo --- NPM INSTALL FINISHED --- 
echo If there were any errors above, please take a screenshot.
pause

echo.
echo [Step 3/3] Starting the server...
echo.

npm start

echo.
echo --- NPM START FINISHED ---
echo If the server did not start, please check for errors above.
pause
