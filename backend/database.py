"""
数据库初始化和连接管理
"""
import mysql.connector
from mysql.connector import pooling
from config import DB_CONFIG, DATABASE_NAME

# 创建连接池
pool = pooling.MySQLConnectionPool(
    pool_name="photo_pool",
    pool_size=5,
    **DB_CONFIG
)


def get_connection():
    conn = pool.get_connection()
    # 设置正确的字符集
    conn.set_charset_collation('utf8mb4', 'utf8mb4_unicode_ci')
    return conn


def init_database():
    """初始化数据库和表结构"""
    # 先连接不带数据库，创建数据库
    init_conn = mysql.connector.connect(**DB_CONFIG)
    cursor = init_conn.cursor()
    
    # 创建数据库
    cursor.execute(f"CREATE DATABASE IF NOT EXISTS {DATABASE_NAME} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci")
    cursor.execute(f"USE {DATABASE_NAME}")
    
    # 创建图片表
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS images (
            id BIGINT PRIMARY KEY AUTO_INCREMENT,
            file_path VARCHAR(500) NOT NULL UNIQUE,
            filename VARCHAR(255) NOT NULL,
            folder_date DATE,
            folder_path VARCHAR(500),
            file_size BIGINT,
            width INT DEFAULT 0,
            height INT DEFAULT 0,
            orientation ENUM('landscape', 'portrait', 'square') DEFAULT 'landscape',
            perceptual_hash VARCHAR(64),
            theme_tags VARCHAR(255),
            thumbnail_path VARCHAR(500),
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            indexed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_folder_date (folder_date),
            INDEX idx_orientation (orientation),
            INDEX idx_created_at (created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    """)
    
    # 创建评分表
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS image_scores (
            id BIGINT PRIMARY KEY AUTO_INCREMENT,
            image_id BIGINT NOT NULL,
            total_score DECIMAL(5,2) DEFAULT 0,
            impact_score DECIMAL(5,2) DEFAULT 0,
            impact_analysis TEXT,
            impact_suggestion TEXT,
            composition_score DECIMAL(5,2) DEFAULT 0,
            composition_analysis TEXT,
            composition_suggestion TEXT,
            sharpness_score DECIMAL(5,2) DEFAULT 0,
            sharpness_analysis TEXT,
            sharpness_suggestion TEXT,
            exposure_score DECIMAL(5,2) DEFAULT 0,
            exposure_analysis TEXT,
            exposure_suggestion TEXT,
            color_score DECIMAL(5,2) DEFAULT 0,
            color_analysis TEXT,
            color_suggestion TEXT,
            uniqueness_score DECIMAL(5,2) DEFAULT 0,
            uniqueness_analysis TEXT,
            uniqueness_suggestion TEXT,
            raw_response JSON,
            llm_model VARCHAR(100),
            scored_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (image_id) REFERENCES images(id) ON DELETE CASCADE,
            INDEX idx_total_score (total_score),
            UNIQUE KEY uk_image_id (image_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    """)
    
    # 创建描述表
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS image_descriptions (
            id BIGINT PRIMARY KEY AUTO_INCREMENT,
            image_id BIGINT NOT NULL UNIQUE,
            description TEXT,
            tags VARCHAR(500),
            llm_model VARCHAR(100),
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (image_id) REFERENCES images(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    """)
    
    # 创建每日主题表
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS daily_themes (
            id BIGINT PRIMARY KEY AUTO_INCREMENT,
            date DATE UNIQUE,
            theme_title VARCHAR(200),
            theme_description TEXT,
            photo_count INT DEFAULT 0,
            total_score_avg DECIMAL(5,2) DEFAULT 0,
            keywords VARCHAR(500),
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    """)
    
    # 创建评分任务队列表
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS score_tasks (
            id BIGINT PRIMARY KEY AUTO_INCREMENT,
            image_id BIGINT NOT NULL,
            status ENUM('pending', 'processing', 'completed', 'failed') DEFAULT 'pending',
            model VARCHAR(50),
            error_message TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            completed_at DATETIME,
            FOREIGN KEY (image_id) REFERENCES images(id) ON DELETE CASCADE,
            INDEX idx_status (status)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    """)
    
    # 创建推荐组合表
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS photo_sets (
            id BIGINT PRIMARY KEY AUTO_INCREMENT,
            date DATE,
            set_type ENUM('douyin', 'xiaohongshu', 'weibo') DEFAULT 'xiaohongshu',
            cover_image_id BIGINT,
            caption_title VARCHAR(200),
            caption_body TEXT,
            hashtags VARCHAR(500),
            image_ids JSON,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (cover_image_id) REFERENCES images(id) ON DELETE SET NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    """)
    
    # 创建应用状态表（存储浏览位置等）
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS app_state (
            id INT PRIMARY KEY DEFAULT 1,
            last_folder_path VARCHAR(500),
            last_page INT DEFAULT 1,
            last_sort_by VARCHAR(50) DEFAULT 'filename',
            last_sort_order VARCHAR(10) DEFAULT 'asc',
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    """)
    # 迁移旧数据：确保新字段存在
    for col, dtype in [('last_page', 'INT DEFAULT 1'), ('last_sort_by', "VARCHAR(50) DEFAULT 'filename'"), ('last_sort_order', "VARCHAR(10) DEFAULT 'asc'")]:
        cursor.execute(f"ALTER TABLE app_state ADD COLUMN IF NOT EXISTS {col} {dtype}")
    # 初始化一条记录
    cursor.execute("INSERT IGNORE INTO app_state (id) VALUES (1)")
    
    init_conn.commit()
    cursor.close()
    init_conn.close()
    print(f"数据库 {DATABASE_NAME} 初始化完成")


def execute_query(query, params=None, fetch=True):
    """执行查询"""
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute(query, params or ())
        if fetch:
            result = cursor.fetchall()
        else:
            conn.commit()
            result = cursor.lastrowid
        return result
    finally:
        cursor.close()
        conn.close()


def execute_many(query, params_list):
    """批量执行"""
    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.executemany(query, params_list)
        conn.commit()
    finally:
        cursor.close()
        conn.close()
