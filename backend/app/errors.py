class AppError(Exception):
    """Domain error with HTTP status and machine-readable code."""

    def __init__(self, message: str, *, code: str = "APP_ERROR", status_code: int = 400):
        super().__init__(message)
        self.message = message
        self.code = code
        self.status_code = status_code


class NotFoundError(AppError):
    def __init__(self, message: str = "Resource not found", *, code: str = "NOT_FOUND"):
        super().__init__(message, code=code, status_code=404)


class ForbiddenError(AppError):
    def __init__(self, message: str = "Forbidden", *, code: str = "FORBIDDEN"):
        super().__init__(message, code=code, status_code=403)


class ConflictError(AppError):
    def __init__(self, message: str = "Conflict", *, code: str = "CONFLICT"):
        super().__init__(message, code=code, status_code=409)
