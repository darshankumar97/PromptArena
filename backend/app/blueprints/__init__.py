from flask import Flask

from app.blueprints.auth import auth_bp
from app.blueprints.battles import battles_bp
from app.blueprints.health import health_bp
from app.blueprints.rooms import rooms_bp


def register_blueprints(app: Flask) -> None:
    app.register_blueprint(health_bp)
    app.register_blueprint(auth_bp)
    app.register_blueprint(rooms_bp)
    app.register_blueprint(battles_bp)
