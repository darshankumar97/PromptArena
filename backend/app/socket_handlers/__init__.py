def register_socket_handlers() -> None:
    from app.socket_handlers.battle import register_battle_handlers
    from app.socket_handlers.connection import register_connection_handlers
    from app.socket_handlers.judging import register_judging_handlers

    register_connection_handlers()
    register_battle_handlers()
    register_judging_handlers()
