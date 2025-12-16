import os
from flask import Flask, render_template, request, jsonify, make_response
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import text

app = Flask(__name__)

class PrefixMiddleware(object):
    def __init__(self, app, prefix=''):
        self.app = app
        self.prefix = prefix

    def __call__(self, environ, start_response):
        if environ['PATH_INFO'].startswith(self.prefix):
            environ['PATH_INFO'] = environ['PATH_INFO'][len(self.prefix):]
            environ['SCRIPT_NAME'] = self.prefix
            return self.app(environ, start_response)
        else:
            start_response('404', [('Content-Type', 'text/plain')])
            return ["Esta URL no pertenece a la aplicacion.".encode()]

app.wsgi_app = PrefixMiddleware(app.wsgi_app, prefix='/reveal-gender-battle')

# Database Configuration
db_user = os.environ.get('DB_USER', 'root')
db_password = os.environ.get('DB_PASSWORD', 'root')
db_host = os.environ.get('DB_HOST', 'localhost')
db_name = os.environ.get('DB_NAME', 'gender_reveal')

app.config['SQLALCHEMY_DATABASE_URI'] = f'mysql+pymysql://{db_user}:{db_password}@{db_host}/{db_name}'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)


from datetime import datetime, timedelta, timezone
import binascii

# Simple XOR Encryption for Doctor Votes
ENCRYPTION_KEY = "SECRET" # Simple key

def encrypt_vote(text):
    """Encrypts plain text using XOR and hex encoding."""
    encrypted = []
    for i in range(len(text)):
        key_c = ENCRYPTION_KEY[i % len(ENCRYPTION_KEY)]
        encrypted_c = chr(ord(text[i]) ^ ord(key_c))
        encrypted.append(encrypted_c)
    return binascii.hexlify("".join(encrypted).encode()).decode()

def decrypt_vote(hex_text):
    """Decrypts hex encoded text using XOR."""
    try:
        # Check if it looks like hex and is encrypted
        # If decryption fails or result is not boy/girl, assume it was plain text (legacy compatibility)
        encrypted_bytes = binascii.unhexlify(hex_text)
        encrypted_str = encrypted_bytes.decode()
        
        decrypted = []
        for i in range(len(encrypted_str)):
            key_c = ENCRYPTION_KEY[i % len(ENCRYPTION_KEY)]
            decrypted_c = chr(ord(encrypted_str[i]) ^ ord(key_c))
            decrypted.append(decrypted_c)
        
        result = "".join(decrypted)
        
        # Validation for legacy mixed data: if not valid enum, maybe it was plain text
        if result not in ['boy', 'girl']:
            return hex_text # Return original if garbage (or handle as error)
            
        return result
    except Exception:
        return hex_text # Fallback for plain text votes


# Models
class Vote(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    team = db.Column(db.String(10), nullable=False) # 'boy' or 'girl'
    access_key_id = db.Column(db.Integer, db.ForeignKey('access_key.id'), nullable=True)
    is_revealed = db.Column(db.Boolean, default=False)
    timestamp = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc).replace(tzinfo=None))

class AccessKey(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    key_code = db.Column(db.String(50), unique=True, nullable=False)
    is_used = db.Column(db.Boolean, default=False)
    is_admin = db.Column(db.Boolean, default=False)
    is_doctor = db.Column(db.Boolean, default=False)
    votes = db.relationship('Vote', backref='access_key', lazy=True)

# Initialize Database
with app.app_context():
    try:
        # Create tables if they don't exist
        db.create_all()
        
        # Migration Logic
        inspector = db.inspect(db.engine)
        
        # Check AccessKey columns
        ak_columns = [col['name'] for col in inspector.get_columns('access_key')]
        if 'is_doctor' not in ak_columns:
            print("Migrating: Adding is_doctor column to access_key table")
            with db.engine.connect() as conn:
                conn.execute(text("ALTER TABLE access_key ADD COLUMN is_doctor BOOLEAN DEFAULT 0"))
                conn.commit()

        # Check Vote columns
        vote_columns = [col['name'] for col in inspector.get_columns('vote')]
        if 'access_key_id' not in vote_columns:
            print("Migrating: Adding access_key_id and timestamp to vote table")
            with db.engine.connect() as conn:
                # SQLite/MySQL syntax might vary slightly, but adding columns usually works
                # Note: Adding FK constraint on existing table in SQLite is hard, but for MySQL it's okay.
                # Since we are using MySQL (based on connection string), we can add FK.
                # However, for simplicity and robustness against existing data, we might skip strict FK constraint in raw SQL if complex
                conn.execute(text("ALTER TABLE vote ADD COLUMN access_key_id INTEGER"))
                conn.execute(text("ALTER TABLE vote ADD COLUMN timestamp DATETIME"))
                conn.commit()
        
        if 'is_revealed' not in vote_columns:
            print("Migrating: Adding is_revealed to vote table")
            with db.engine.connect() as conn:
                conn.execute(text("ALTER TABLE vote ADD COLUMN is_revealed BOOLEAN DEFAULT 0"))
                conn.commit()

        print("Database tables checked/created successfully.")
        
        # Seed Keys if empty (Infrastructure only)
        if not AccessKey.query.first():
            print("Seeding access keys...")
            admin_key = AccessKey(key_code="ADMIN123", is_admin=True)
            doctor_key = AccessKey(key_code="DOCTOR999", is_doctor=True)
            user_keys = [
                AccessKey(key_code="USER001"),
                AccessKey(key_code="USER002"),
                AccessKey(key_code="USER003")
            ]
            db.session.add(admin_key)
            db.session.add(doctor_key)
            db.session.add_all(user_keys)
            db.session.commit()
            print("Access keys seeded.")
        
        # Ensure a doctor key exists for testing
        elif not AccessKey.query.filter_by(is_doctor=True).first():
             print("Seeding doctor key...")
             doctor_key = AccessKey(key_code="DOCTOR999", is_doctor=True)
             db.session.add(doctor_key)
             db.session.commit()
            
    except Exception as e:
        print(f"Error creating/updating database tables: {e}")

# Routes
@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/validate_access', methods=['POST'])
def validate_access():
    data = request.get_json()
    key_code = data.get('access_key')
    
    key_obj = AccessKey.query.filter_by(key_code=key_code).first()
    
    if not key_obj:
        return jsonify({'valid': False, 'error': 'Clave no encontrada'}), 401
        
    return jsonify({
        'valid': True,
        'is_admin': key_obj.is_admin,
        'is_doctor': key_obj.is_doctor,
        'has_voted': key_obj.is_used
    })

@app.route('/api/vote', methods=['POST'])
def vote():
    data = request.get_json()
    team = data.get('team')
    access_key = data.get('access_key')
    
    if team not in ['boy', 'girl']:
        return jsonify({'error': 'Invalid vote'}), 400
        
    # Validate Access Key again
    key_obj = AccessKey.query.filter_by(key_code=access_key).first()
    if not key_obj:
        return jsonify({'error': 'Acceso denegado'}), 401
    
    # Check Game State (Derived)
    # Check if any doctor has voted AND it is revealed
    doctor_vote = Vote.query.join(AccessKey).filter(AccessKey.is_doctor == True).first()
    if doctor_vote and doctor_vote.is_revealed:
        return jsonify({'error': 'La votación ha terminado'}), 403

    # Check if already voted (and not admin)
    if key_obj.is_used and not key_obj.is_admin:
        return jsonify({'error': 'Ya has votado'}), 403
    
    # Record Vote
    new_vote = Vote(team=team, access_key_id=key_obj.id, timestamp=datetime.now(timezone.utc).replace(tzinfo=None))
    if key_obj.is_doctor:
        new_vote.team = encrypt_vote(team)
    
    db.session.add(new_vote)
    
    # Mark key as used if not admin
    if not key_obj.is_admin:
        key_obj.is_used = True
        
    db.session.commit()
    
    # If this was a doctor vote, we just save it. Reveal is manual now.
    if key_obj.is_doctor:
         return jsonify({'message': 'Doctor vote received. Waiting for admin reveal.', 'status': 'VOTING'})
    
    return jsonify({'message': 'Vote received!'})

@app.route('/api/reveal', methods=['POST'])
def reveal_vote():
    data = request.get_json()
    access_key = data.get('access_key')
    
    # Validate Admin Key
    key_obj = AccessKey.query.filter_by(key_code=access_key).first()
    if not key_obj or not key_obj.is_admin:
        return jsonify({'error': 'Acceso denegado'}), 403
        
    # Find Doctor Vote
    doctor_vote = Vote.query.join(AccessKey).filter(AccessKey.is_doctor == True).first()
    
    if not doctor_vote:
        return jsonify({'error': 'No hay voto del doctor para revelar'}), 404
        
    # Trigger Reveal
    doctor_vote.is_revealed = True
    # doctor_vote.timestamp = datetime.now(timezone.utc).replace(tzinfo=None) # Timestamp not reset, preserving original vote time
    db.session.commit()
    
    return jsonify({'message': 'Reveal triggered!', 'status': 'ENDED', 'final_result': decrypt_vote(doctor_vote.team)})

@app.route('/api/stats', methods=['GET'])
def get_stats():
    # Check for Doctor Vote
    doctor_vote = Vote.query.join(AccessKey).filter(AccessKey.is_doctor == True).first()
    
    status = 'VOTING'
    final_result = None
    
    if doctor_vote and doctor_vote.is_revealed:
        final_result = decrypt_vote(doctor_vote.team)
        print(final_result)
        status = 'ENDED'
    
    # Calculate counts excluding doctor votes
    # We can do this by joining AccessKey and filtering where is_doctor is False (or NULL if we had public votes without keys, but here all votes have keys)
    # Actually, the requirement says "ignore votes that are from the doctor".
    
    boy_count = Vote.query.join(AccessKey).filter(Vote.team == 'boy', AccessKey.is_doctor == False).count()
    girl_count = Vote.query.join(AccessKey).filter(Vote.team == 'girl', AccessKey.is_doctor == False).count()
    
    total = boy_count + girl_count
    
    return jsonify({
        'boy': boy_count,
        'girl': girl_count,
        'total': total,
        'status': status,
        'final_result': final_result
    })

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)
