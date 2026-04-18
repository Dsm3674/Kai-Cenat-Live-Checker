from __future__ import annotations

from contextlib import contextmanager
from datetime import datetime
from pathlib import Path
from typing import Iterator

from sqlalchemy import Column, DateTime, Float, Integer, String, create_engine
from sqlalchemy.orm import Session, declarative_base, sessionmaker

BASE_DIR = Path(__file__).resolve().parent.parent
DB_PATH = BASE_DIR / "data" / "twitch_analytics.db"
DB_PATH.parent.mkdir(parents=True, exist_ok=True)

engine = create_engine(
    f"sqlite:///{DB_PATH}",
    echo=False,
    connect_args={"check_same_thread": False},
)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)
Base = declarative_base()


class StreamSnapshot(Base):
    __tablename__ = "stream_snapshots"

    id = Column(Integer, primary_key=True)
    username = Column(String, index=True)
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)
    viewer_count = Column(Integer)
    game_name = Column(String)
    title = Column(String)


class ChatSentiment(Base):
    __tablename__ = "chat_sentiments"

    id = Column(Integer, primary_key=True)
    username = Column(String, index=True)
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)
    sentiment_score = Column(Float)
    message_count = Column(Integer)


Base.metadata.create_all(engine)


@contextmanager
def session_scope() -> Iterator[Session]:
    session = SessionLocal()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


def log_stream_snapshot(username: str, viewer_count: int, game_name: str, title: str) -> None:
    with session_scope() as session:
        session.add(
            StreamSnapshot(
                username=username,
                viewer_count=viewer_count,
                game_name=game_name,
                title=title,
            )
        )


def log_chat_sentiment(username: str, sentiment_score: float, message_count: int) -> None:
    with session_scope() as session:
        session.add(
            ChatSentiment(
                username=username,
                sentiment_score=sentiment_score,
                message_count=message_count,
            )
        )


def get_recent_snapshots(username: str, limit: int = 100) -> list[dict[str, object]]:
    with session_scope() as session:
        results = (
            session.query(StreamSnapshot)
            .filter(StreamSnapshot.username == username)
            .order_by(StreamSnapshot.timestamp.desc())
            .limit(limit)
            .all()
        )

    return [
        {
            "timestamp": row.timestamp.isoformat(),
            "viewer_count": row.viewer_count,
            "game_name": row.game_name,
            "title": row.title,
        }
        for row in reversed(results)
    ]
