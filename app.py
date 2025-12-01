import os
from flask import Flask, render_template, request, jsonify, make_response
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import text

app = Flask(__name__)

# Database Configuration
db_user = os.environ.get('DB_USER', 'root')
db_password = os.environ.get('DB_PASSWORD', 'root')
db_host = os.environ.get('DB_HOST', 'localhost')
db_name = os.environ.get('DB_NAME', 'gender_reveal')

app.config['SQLALCHEMY_DATABASE_URI'] = f'mysql+pymysql://{db_user}:{db_password}@{db_host}/{db_name}'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)

# Models
class Vote(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    team = db.Column(db.String(10), nullable=False) # 'boy' or 'girl'

# Infrastructure for future use (as requested)
class AccessKey(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    key_code = db.Column(db.String(50), unique=True, nullable=False)
    is_used = db.Column(db.Boolean, default=False)
    is_admin = db.Column(db.Boolean, default=False)

# Initialize Database
with app.app_context():
    try:
        db.create_all()
        print("Database tables created successfully.")
        
        # Seed Keys if empty (Infrastructure only)
        if not AccessKey.query.first():
            print("Seeding access keys...")
            admin_key = AccessKey(key_code="ADMIN123", is_admin=True)
            user_keys = [
                AccessKey(key_code="USER001"),
                AccessKey(key_code="USER002"),
                AccessKey(key_code="USER003")
            ]
            db.session.add(admin_key)
            db.session.add_all(user_keys)
            db.session.commit()
            print("Access keys seeded.")
            
    except Exception as e:
        print(f"Error creating database tables: {e}")

# Routes
@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/vote', methods=['POST'])
def vote():
    data = request.get_json()
    team = data.get('vote')
    
    if team not in ['boy', 'girl']:
        return jsonify({'error': 'Invalid vote'}), 400
    
    # Record Vote (Direct, no key required)
    new_vote = Vote(team=team)
    db.session.add(new_vote)
    db.session.commit()
    
    return jsonify({'message': 'Vote received!'})

@app.route('/api/stats', methods=['GET'])
def get_stats():
    boy_count = Vote.query.filter_by(team='boy').count()
    girl_count = Vote.query.filter_by(team='girl').count()
    
    total = boy_count + girl_count
    
    return jsonify({
        'boy': boy_count,
        'girl': girl_count,
        'total': total
    })

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)
