from app.extensions import db


class SerializerMixin:
    def to_dict(self):
        return {column.name: getattr(self, column.name) for column in self.__table__.columns}


class CrudMixin:
    def update_from_dict(self, data, allowed_fields):
        for field in allowed_fields:
            if field in data:
                setattr(self, field, data[field])
        return self


class TimestampMixin:
    created_at = db.Column(db.DateTime(timezone=True), server_default=db.func.now(), nullable=False)