"""
数据模型
"""
from dataclasses import dataclass, field
from datetime import date, datetime
from typing import Optional, List
from enum import Enum


@dataclass
class Image:
    id: int
    file_path: str
    filename: str
    folder_date: date
    folder_path: str
    file_size: int = 0
    width: int = 0
    height: int = 0
    orientation: str = 'landscape'
    perceptual_hash: Optional[str] = None
    theme_tags: Optional[str] = None
    created_at: datetime = None
    indexed_at: datetime = None
    
    # 关联数据
    score: Optional['ImageScore'] = None
    description: Optional['ImageDescription'] = None


@dataclass
class ImageScore:
    id: int
    image_id: int
    total_score: float
    impact_score: float = 0
    composition_score: float = 0
    sharpness_score: float = 0
    exposure_score: float = 0
    color_score: float = 0
    uniqueness_score: float = 0
    raw_response: str = ""
    llm_model: str = ""
    scored_at: datetime = None


@dataclass
class ImageDescription:
    id: int
    image_id: int
    description: str = ""
    tags: str = ""
    llm_model: str = ""
    created_at: datetime = None


@dataclass
class DailyTheme:
    id: int
    date: date
    theme_title: str = ""
    theme_description: str = ""
    photo_count: int = 0
    total_score_avg: float = 0
    keywords: str = ""
    created_at: datetime = None


@dataclass
class PhotoSet:
    id: int
    date: date
    set_type: str = 'xiaohongshu'
    cover_image_id: int = None
    caption_title: str = ""
    caption_body: str = ""
    hashtags: str = ""
    image_ids: List[int] = field(default_factory=list)
    created_at: datetime = None


@dataclass
class FolderNode:
    """目录树节点"""
    path: str
    name: str
    date: Optional[date] = None
    image_count: int = 0
    children: List['FolderNode'] = field(default_factory=list)
    is_leaf: bool = False
