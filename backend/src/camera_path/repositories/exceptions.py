class ProjectNotFoundError(KeyError):
    pass


class RevisionConflictError(RuntimeError):
    pass


class ReferenceConflictError(RuntimeError):
    pass
