from importlib import import_module

from flask import Blueprint


ROUTER_MODULES = [
    "admin",
    "auth",
    "orders",
    "products",
]


def register_blueprints(app):
    for module_name in ROUTER_MODULES:
        module = import_module(f"app.router.{module_name}")
        blueprint = getattr(module, "bp", None)
        if isinstance(blueprint, Blueprint):
            app.register_blueprint(blueprint)