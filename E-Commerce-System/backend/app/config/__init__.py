from urllib.parse import quote_plus


class Config:
    SECRET_KEY = "change-me"
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    JSON_SORT_KEYS = False

    DB_HOST = "localhost"
    DB_PORT = 5432
    DB_USER = "postgres"
    DB_PASSWORD = "Vuong123!"
    DB_NAME = "e_commerce_system"

    SQLALCHEMY_DATABASE_URI = (
        f"postgresql+psycopg://{DB_USER}:{quote_plus(DB_PASSWORD)}"
        f"@{DB_HOST}:{DB_PORT}/{DB_NAME}"
    )

    SWAGGER = {
        "title": "E-Commerce System API",
        "uiversion": 3,
        "description": "Swagger documentation for the E-Commerce backend API",
    }


class DevelopmentConfig(Config):
    DEBUG = True


class ProductionConfig(Config):
    DEBUG = False


def get_config():
    return DevelopmentConfig