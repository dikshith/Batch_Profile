call venv\Scripts\activate
echo ======================================================
echo Installing dependencies...
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
echo ======================================================
call python app.py
