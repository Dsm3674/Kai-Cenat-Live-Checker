from sqlalchemy import create_engine, Column, Integer, String, Float, DateTime, Boolean
from sqlalchemy.orm import declarative_base, sessionmaker
from datetime import datetime
import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
DB_PATH = BASE_DIR / "data" / "twitch_analytics.db"
DB_PATH.parent.mkdir(parents=True, exist_ok=True)

engine = create_engine(f'sqlite:///{DB_PATH}', echo=False)
Base = declarative_base()

class StreamSnapshot(Base):
    __tablename__ = 'stream_snapshots'
    
    id = Column(Integer, primary_key=True)
    username = Column(String, index=True)
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)
    viewer_count = Column(Integer)
    game_name = Column(String)
    title = Column(String)
    
class ChatSentiment(Base):
    __tablename__ = 'chat_sentiments'
    
    id = Column(Integer, primary_key=True)
    username = Column(String, index=True)
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)
    sentiment_score = Column(Float) # -1.0 to 1.0 from VADER
    message_count = Column(Integer) # How many messages analyzed in this chunk

Base.metadata.create_all(engine)
SessionLocal = sessionmaker(bind=engine)

def log_stream_snapshot(username: str, viewer_count: int, game_name: str, title: str):
    session = SessionLocal()
    snapshot = StreamSnapshot(
        username=username,
        viewer_count=viewer_count,
        game_name=game_name,
        title=title
    )
    session.add(snapshot)
    session.commit()
    session.close()

def log_chat_sentiment(username: str, sentiment_score: float, message_count: int):
    session = SessionLocal()
    sentiment = ChatSentiment(
        username=username,
        sentiment_score=sentiment_score,
        message_count=message_count
    )
    session.add(sentiment)
    session.commit()
    session.close()

def get_recent_snapshots(username: str, limit: int = 100):
    session = SessionLocal()
    results = session.query(StreamSnapshot).filter(StreamSnapshot.username == username).order_by(StreamSnapshot.timestamp.desc()).limit(limit).all()
    session.close()
    return [
        {
            "timestamp": r.timestamp.isoformat(),
            "viewer_count": r.viewer_count,
            "game_name": r.game_name
        } for r in reversed(results)
    ]
