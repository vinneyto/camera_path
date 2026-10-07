from camera_path.api import create_app
from camera_path.routers.auth import require_editor


def create_editor_app(*args, **kwargs):
    """Existing business-operation tests run as an editor, with auth tested separately."""
    app = create_app(*args, **kwargs)
    app.dependency_overrides[require_editor] = lambda: "test-editor"
    return app
