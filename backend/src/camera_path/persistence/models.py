from sqlalchemy import CheckConstraint, ForeignKey, Integer, Text
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


class ProjectRecord(Base):
    __tablename__ = "projects"
    __table_args__ = (CheckConstraint("cursor >= 0", name="ck_projects_cursor_non_negative"),)

    id: Mapped[str] = mapped_column(Text, primary_key=True)
    cursor: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    snapshots: Mapped[list["ProjectSnapshotRecord"]] = relationship(
        back_populates="project",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )


class ProjectSnapshotRecord(Base):
    __tablename__ = "project_snapshots"
    __table_args__ = (
        CheckConstraint("position >= 0", name="ck_project_snapshots_position_non_negative"),
    )

    project_id: Mapped[str] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"), primary_key=True
    )
    position: Mapped[int] = mapped_column(Integer, primary_key=True)
    payload: Mapped[str] = mapped_column(Text, nullable=False)
    project: Mapped[ProjectRecord] = relationship(back_populates="snapshots")
