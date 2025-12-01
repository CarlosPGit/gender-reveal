# PROJECT MANIFESTO: GENDER REVEAL BATTLE

## 1. Project Goal
Desarrollar una aplicación web interactiva en tiempo real para una revelación de género.
La mecánica principal es una "Batalla Visual": una pantalla dividida donde los votos de los usuarios (Team Boy vs Team Girl) modifican el ancho de los paneles en tiempo real.

## 2. Naming Conventions
* **Project Root:** `gender-reveal-battle` (Kebab-case).
* **Python Files/Variables:** Snake_case (e.g., `app.py`, `vote_manager.py`, `boy_percent`).
* **Frontend Classes/IDs:** Kebab-case (e.g., `.battle-container`, `#boy-side`).

## 3. Technical Stack (Local Standard -> VPS Ready)
* **Language:** Python 3.12+
* **Framework:** Flask (Simplicity & Flexibility).
* **WSGI Server:** * *Local:* Flask Dev Server.
    * *Production (VPS):* Gunicorn + Nginx.
* **Database Strategy:**
    * **Development (Local):** MySQL.
    * **Driver:** PyMySQL.
    * **Connection URI:** `mysql+pymysql://root:secret@localhost/gender_reveal` (Adjust based on local setup).
    * **ORM:** SQLAlchemy.
* **Frontend:** HTML5, CSS3 (Flexbox/Grid), JavaScript (ES6+).
* **Libraries:** * `GSAP` (via CDN) for high-performance animations.
    * `Flask-SQLAlchemy` (ORM for DB abstraction).

## 4. Architecture & Logic
* **Entry Point:** `app.py`.
* **Endpoints:**
    * `GET /`: Renderiza `index.html`.
    * `POST /api/vote`: Recibe JSON `{"vote": "boy"}`. Valida cookies para evitar spam.
    * `GET /api/stats`: Retorna JSON `{"boy": 45, "girl": 55}`.
* **Visual Logic:**
    * Initial State: 50% width each side.
    * Update Loop: JS hace polling cada 2s a `/api/stats`.
    * Animation: Si los datos cambian, GSAP anima el ancho de los contenedores `#boy-side` y `#girl-side`.

## 5. Developer Role (AI Persona)
* Actúa como un Desarrollador Full-Stack Senior.
* Escribe código modular y limpio.
* Usa Type Hinting en Python (e.g., `def get_stats() -> dict:`).
* Prioriza la experiencia de usuario (animaciones fluidas, sin saltos bruscos).