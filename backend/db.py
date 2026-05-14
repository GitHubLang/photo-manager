"""
Unified Data Access Layer
Wraps database.execute_query with named methods for every entity.
"""
from typing import List, Dict, Optional, Any
import json

from database import execute_query


class DB:
    """Data access facade — all database operations go through here."""

    # ==================== images ====================

    @staticmethod
    def images_get_by_ids(ids: List[int]) -> List[Dict]:
        """Batch-fetch images by primary key IDs, with latest score + description."""
        if not ids:
            return []
        placeholders = ','.join(['%s'] * len(ids))
        return execute_query(
            f"""
            SELECT i.id, i.filename, i.file_path, i.width, i.height, i.file_size,
                   s.total_score, d.description, d.tags
            FROM images i
            LEFT JOIN image_scores s ON s.id = (
                SELECT id FROM image_scores WHERE image_id = i.id ORDER BY scored_at DESC LIMIT 1
            )
            LEFT JOIN image_descriptions d ON d.id = (
                SELECT id FROM image_descriptions WHERE image_id = i.id ORDER BY created_at DESC LIMIT 1
            )
            WHERE i.id IN ({placeholders}) AND i.is_deleted = 0
            """,
            tuple(ids))

    @staticmethod
    def images_get_detail(image_id: int) -> Optional[Dict]:
        """Single image full detail with scores + description."""
        rows = execute_query("""
            SELECT i.*,
                   s.total_score,
                   s.impact_score, s.impact_analysis, s.impact_suggestion,
                   s.composition_score, s.composition_analysis, s.composition_suggestion,
                   s.sharpness_score, s.sharpness_analysis, s.sharpness_suggestion,
                   s.exposure_score, s.exposure_analysis, s.exposure_suggestion,
                   s.color_score, s.color_analysis, s.color_suggestion,
                   s.uniqueness_score, s.uniqueness_analysis, s.uniqueness_suggestion,
                   d.description, d.tags
            FROM images i
            LEFT JOIN image_scores s ON i.id = s.image_id
            LEFT JOIN image_descriptions d ON i.id = d.image_id
            WHERE i.id = %s AND i.is_deleted = 0
        """, (image_id,))
        return rows[0] if rows else None

    @staticmethod
    def images_get_path(image_id: int) -> Optional[str]:
        """Get file_path for an image."""
        rows = execute_query("SELECT file_path FROM images WHERE id = %s AND is_deleted = 0", (image_id,))
        return rows[0]['file_path'] if rows else None

    @staticmethod
    def images_get_paths_for_ids(ids: List[int]) -> List[Dict]:
        """Get file_path for a list of image IDs."""
        if not ids:
            return []
        placeholders = ",".join(["%s"] * len(ids))
        return execute_query(
            "SELECT i.id AS img_id, i.file_path, COALESCE(d.tags,'') as tags, "
            "COALESCE(d.description,'') as description "
            "FROM images i LEFT JOIN image_descriptions d ON i.id = d.image_id "
            "WHERE i.id IN (" + placeholders + ") AND i.is_deleted = 0",
            ids)

    @staticmethod
    def images_count_by_folder(
        folder_path: str,
        min_score: Optional[float] = None,
        search: Optional[str] = None,
    ) -> int:
        """Count non-deleted images in a folder (with optional filters)."""
        where_clauses = ["i.is_deleted = 0", "i.folder_path = %s"]
        params = [folder_path]
        if min_score is not None:
            where_clauses.append("s.total_score >= %s")
            params.append(min_score)
        if search:
            where_clauses.append("(i.filename LIKE %s OR d.description LIKE %s OR d.tags LIKE %s)")
            pattern = f"%{search}%"
            params.extend([pattern, pattern, pattern])
        where_sql = " AND ".join(where_clauses)
        rows = execute_query(
            f"SELECT COUNT(*) as total FROM images i "
            f"LEFT JOIN image_scores s ON i.id = s.image_id "
            f"LEFT JOIN image_descriptions d ON i.id = d.image_id "
            f"WHERE {where_sql}", params)
        return rows[0]['total']

    @staticmethod
    def images_get_by_folder(
        folder_path: str,
        page: int,
        page_size: int,
        sort_by: str = "filename",
        sort_order: str = "asc",
        min_score: Optional[float] = None,
        search: Optional[str] = None,
    ) -> List[Dict]:
        """Paginated images from a folder with scores + descriptions."""
        where_clauses = ["i.is_deleted = 0", "i.folder_path = %s"]
        params = [folder_path]
        if min_score is not None:
            where_clauses.append("s.total_score >= %s")
            params.append(min_score)
        if search:
            where_clauses.append("(i.filename LIKE %s OR d.description LIKE %s OR d.tags LIKE %s)")
            pattern = f"%{search}%"
            params.extend([pattern, pattern, pattern])
        where_sql = " AND ".join(where_clauses)
        sort_column_map = {
            "filename": "i.filename", "total_score": "s.total_score",
            "file_size": "i.file_size", "created_at": "i.created_at",
        }
        sort_column = sort_column_map.get(sort_by, "i.filename")
        sort_dir = "DESC" if sort_order == "desc" else "ASC"
        offset = (page - 1) * page_size
        params.extend([page_size, offset])
        return execute_query(
            f"""
            SELECT i.*,
                   s.total_score,
                   s.impact_score, s.impact_analysis, s.impact_suggestion,
                   s.composition_score, s.composition_analysis, s.composition_suggestion,
                   s.sharpness_score, s.sharpness_analysis, s.sharpness_suggestion,
                   s.exposure_score, s.exposure_analysis, s.exposure_suggestion,
                   s.color_score, s.color_analysis, s.color_suggestion,
                   s.uniqueness_score, s.uniqueness_analysis, s.uniqueness_suggestion,
                   d.description, d.tags
            FROM images i
            LEFT JOIN image_scores s ON s.id = (
                SELECT id FROM image_scores WHERE image_id = i.id ORDER BY scored_at DESC LIMIT 1
            )
            LEFT JOIN image_descriptions d ON d.id = (
                SELECT id FROM image_descriptions WHERE image_id = i.id ORDER BY created_at DESC LIMIT 1
            )
            WHERE {where_sql}
            ORDER BY {sort_column} {sort_dir}
            LIMIT %s OFFSET %s
            """, params)

    @staticmethod
    def images_search(
        keyword: str,
        page: int,
        page_size: int,
    ) -> tuple:
        """Full-text search across filename, description, tags."""
        pattern = f"%{keyword}%"
        rows = execute_query(
            "SELECT COUNT(*) as total FROM images i "
            "LEFT JOIN image_scores s ON i.id = s.image_id "
            "LEFT JOIN image_descriptions d ON i.id = d.image_id "
            "WHERE i.is_deleted = 0 AND (i.filename LIKE %s OR d.description LIKE %s OR d.tags LIKE %s)",
            (pattern, pattern, pattern))
        total = rows[0]['total']
        offset = (page - 1) * page_size
        images = execute_query(
            """
            SELECT i.*,
                   s.total_score,
                   s.impact_score, s.impact_analysis, s.impact_suggestion,
                   s.composition_score, s.composition_analysis, s.composition_suggestion,
                   s.sharpness_score, s.sharpness_analysis, s.sharpness_suggestion,
                   s.exposure_score, s.exposure_analysis, s.exposure_suggestion,
                   s.color_score, s.color_analysis, s.color_suggestion,
                   s.uniqueness_score, s.uniqueness_analysis, s.uniqueness_suggestion,
                   d.description, d.tags
            FROM images i
            LEFT JOIN image_scores s ON s.id = (
                SELECT id FROM image_scores WHERE image_id = i.id ORDER BY scored_at DESC LIMIT 1
            )
            LEFT JOIN image_descriptions d ON d.id = (
                SELECT id FROM image_descriptions WHERE image_id = i.id ORDER BY created_at DESC LIMIT 1
            )
            WHERE i.is_deleted = 0 AND (i.filename LIKE %s OR d.description LIKE %s OR d.tags LIKE %s)
            ORDER BY s.total_score DESC
            LIMIT %s OFFSET %s
            """,
            (pattern, pattern, pattern, page_size, offset))
        return total, images

    @staticmethod
    def images_get_export_with_tags(pattern: str = "%导出%") -> List[Dict]:
        """Get export-folder images with tags."""
        rows = execute_query("""
            SELECT i.id, i.file_path, i.filename, i.folder_path,
                   COALESCE(d.tags, '') as tags,
                   COALESCE(d.description, '') as description
            FROM images i
            LEFT JOIN image_descriptions d ON i.id = d.image_id
            WHERE i.is_deleted = 0 AND i.folder_path LIKE %s
            ORDER BY RAND()
        """, (pattern,))
        if not rows:
            rows = execute_query("""
                SELECT i.id, i.file_path, i.filename, i.folder_path,
                       COALESCE(d.tags, '') as tags,
                       COALESCE(d.description, '') as description
                FROM images i
                LEFT JOIN image_descriptions d ON i.id = d.image_id
                WHERE i.is_deleted = 0
                ORDER BY RAND()
                LIMIT 500
            """)
        return rows

    @staticmethod
    def images_get_unscored(folder_path: str) -> List[Dict]:
        """Get images in a folder that have no score yet."""
        return execute_query("""
            SELECT i.id, i.file_path FROM images i
            WHERE i.is_deleted = 0 AND i.folder_path = %s
              AND i.id NOT IN (SELECT image_id FROM image_scores)
            ORDER BY i.filename
        """, (folder_path,))

    @staticmethod
    def images_get_existing_paths(folder_path: str) -> set:
        """Get set of file_path for non-deleted images in a folder."""
        rows = execute_query(
            "SELECT file_path FROM images WHERE folder_path = %s AND is_deleted = 0",
            (folder_path,))
        return {row['file_path'] for row in rows}

    @staticmethod
    def images_get_all_paths(folder_path: str) -> List[Dict]:
        """Get all DB records (including deleted) for a folder."""
        return execute_query(
            "SELECT file_path FROM images WHERE folder_path = %s",
            (folder_path,))

    @staticmethod
    def images_mark_deleted(file_path: str, folder_path: str, is_deleted: int):
        """Mark an image as deleted or not."""
        execute_query(
            "UPDATE images SET is_deleted = %s WHERE file_path = %s AND folder_path = %s",
            (is_deleted, file_path, folder_path), fetch=False)

    @staticmethod
    def images_insert_many(params_list: List[tuple]):
        """Bulk-insert images."""
        from database import execute_many
        sql = """
            INSERT INTO images (file_path, filename, folder_date, folder_path,
                              file_size, width, height, orientation, perceptual_hash, is_deleted)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, 0)
        """
        execute_many(sql, params_list)

    # ==================== image_scores ====================

    @staticmethod
    def score_save(
        image_id: int,
        total: float,
        impact_score: float, impact_analysis: str, impact_suggestion: str,
        composition_score: float, composition_analysis: str, composition_suggestion: str,
        sharpness_score: float, sharpness_analysis: str, sharpness_suggestion: str,
        exposure_score: float, exposure_analysis: str, exposure_suggestion: str,
        color_score: float, color_analysis: str, color_suggestion: str,
        uniqueness_score: float, uniqueness_analysis: str, uniqueness_suggestion: str,
        raw_response: str,
        llm_model: str,
    ):
        """Insert or update a score record."""
        sql = """
            INSERT INTO image_scores (
                image_id, total_score,
                impact_score, impact_analysis, impact_suggestion,
                composition_score, composition_analysis, composition_suggestion,
                sharpness_score, sharpness_analysis, sharpness_suggestion,
                exposure_score, exposure_analysis, exposure_suggestion,
                color_score, color_analysis, color_suggestion,
                uniqueness_score, uniqueness_analysis, uniqueness_suggestion,
                raw_response, llm_model
            ) VALUES (
                %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
                %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
            )
            ON DUPLICATE KEY UPDATE
                total_score = VALUES(total_score),
                impact_score = VALUES(impact_score), impact_analysis = VALUES(impact_analysis),
                impact_suggestion = VALUES(impact_suggestion),
                composition_score = VALUES(composition_score),
                composition_analysis = VALUES(composition_analysis),
                composition_suggestion = VALUES(composition_suggestion),
                sharpness_score = VALUES(sharpness_score),
                sharpness_analysis = VALUES(sharpness_analysis),
                sharpness_suggestion = VALUES(sharpness_suggestion),
                exposure_score = VALUES(exposure_score),
                exposure_analysis = VALUES(exposure_analysis),
                exposure_suggestion = VALUES(exposure_suggestion),
                color_score = VALUES(color_score), color_analysis = VALUES(color_analysis),
                color_suggestion = VALUES(color_suggestion),
                uniqueness_score = VALUES(uniqueness_score),
                uniqueness_analysis = VALUES(uniqueness_analysis),
                uniqueness_suggestion = VALUES(uniqueness_suggestion),
                raw_response = VALUES(raw_response), llm_model = VALUES(llm_model),
                scored_at = CURRENT_TIMESTAMP
        """
        execute_query(sql, (
            image_id, total,
            impact_score, impact_analysis, impact_suggestion,
            composition_score, composition_analysis, composition_suggestion,
            sharpness_score, sharpness_analysis, sharpness_suggestion,
            exposure_score, exposure_analysis, exposure_suggestion,
            color_score, color_analysis, color_suggestion,
            uniqueness_score, uniqueness_analysis, uniqueness_suggestion,
            raw_response, llm_model,
        ), fetch=False)

    @staticmethod
    def score_results_get(image_id: int) -> Optional[Dict]:
        """Get full score results for an image."""
        rows = execute_query(
            """SELECT i.*,
                   s.total_score,
                   s.impact_score, s.impact_analysis, s.impact_suggestion,
                   s.composition_score, s.composition_analysis, s.composition_suggestion,
                   s.sharpness_score, s.sharpness_analysis, s.sharpness_suggestion,
                   s.exposure_score, s.exposure_analysis, s.exposure_suggestion,
                   s.color_score, s.color_analysis, s.color_suggestion,
                   s.uniqueness_score, s.uniqueness_analysis, s.uniqueness_suggestion,
                   d.description, d.tags
            FROM images i
            LEFT JOIN image_scores s ON i.id = s.image_id
            LEFT JOIN image_descriptions d ON i.id = d.image_id
            WHERE i.id = %s""",
            (image_id,))
        return rows[0] if rows else None

    # ==================== image_descriptions ====================

    @staticmethod
    def description_save(image_id: int, description: str, tags: str, llm_model: str):
        """Insert or update a description."""
        sql = """
            INSERT INTO image_descriptions (image_id, description, tags, llm_model)
            VALUES (%s, %s, %s, %s)
            ON DUPLICATE KEY UPDATE description = VALUES(description), tags = VALUES(tags)
        """
        execute_query(sql, (image_id, description, tags, llm_model), fetch=False)

    # ==================== score_tasks ====================

    @staticmethod
    def score_tasks_check_processing(image_id: int) -> Optional[Dict]:
        """Check for an active processing task for this image."""
        rows = execute_query(
            "SELECT id, created_at FROM score_tasks WHERE image_id = %s AND status = 'processing'",
            (image_id,))
        return rows[0] if rows else None

    @staticmethod
    def score_tasks_check_pending(image_id: int) -> Optional[Dict]:
        """Check for a pending task for this image."""
        rows = execute_query(
            "SELECT id FROM score_tasks WHERE image_id = %s AND status = 'pending'",
            (image_id,))
        return rows[0] if rows else None

    @staticmethod
    def score_tasks_create(image_id: int, model: str) -> int:
        """Create a new score task, returns lastrowid."""
        return execute_query(
            "INSERT INTO score_tasks (image_id, status, model) VALUES (%s, 'pending', %s)",
            (image_id, model), fetch=False)

    @staticmethod
    def score_tasks_get_status(image_id: int) -> Optional[Dict]:
        """Get the most recent task status for an image."""
        rows = execute_query(
            "SELECT status, error_message, completed_at FROM score_tasks "
            "WHERE image_id = %s ORDER BY id DESC LIMIT 1",
            (image_id,))
        return rows[0] if rows else None

    @staticmethod
    def score_tasks_list(
        status: Optional[str],
        page: int,
        page_size: int,
    ) -> tuple:
        """List score tasks with pagination. Returns (total, tasks)."""
        where_sql = "WHERE 1=1"
        params = []
        if status:
            where_sql += " AND t.status = %s"
            params.append(status)
        count_rows = execute_query(
            f"SELECT COUNT(*) as total FROM score_tasks t {where_sql}", params)
        total = count_rows[0]['total']
        offset = (page - 1) * page_size
        params.extend([page_size, offset])
        tasks = execute_query(
            f"""
            SELECT t.id, t.image_id, t.status, t.model, t.error_message,
                   t.created_at, t.completed_at,
                   i.filename, i.file_path, i.width, i.height
            FROM score_tasks t
            LEFT JOIN images i ON t.image_id = i.id
            {where_sql}
            ORDER BY t.created_at DESC
            LIMIT %s OFFSET %s
            """, params)
        return total, tasks

    @staticmethod
    def score_tasks_update_status(task_id: int, status: str, error_message: Optional[str] = None):
        """Update a score task's status and optional error."""
        if error_message is not None:
            execute_query(
                "UPDATE score_tasks SET status = %s, error_message = %s, completed_at = NOW() WHERE id = %s",
                (status, error_message, task_id), fetch=False)
        else:
            execute_query(
                "UPDATE score_tasks SET status = %s WHERE id = %s",
                (status, task_id), fetch=False)

    @staticmethod
    def score_tasks_fail_old(task_id: int, error_message: str):
        """Mark an old processing task as failed."""
        execute_query(
            "UPDATE score_tasks SET status = 'failed', error_message = %s WHERE id = %s",
            (error_message, task_id), fetch=False)

    @staticmethod
    def score_tasks_reset(image_id: int):
        """Reset failed/processing tasks for an image back to pending."""
        execute_query(
            "UPDATE score_tasks SET status = 'pending', error_message = NULL "
            "WHERE image_id = %s AND status IN ('failed', 'processing')",
            (image_id,), fetch=False)

    @staticmethod
    def score_tasks_get_model(task_id: int) -> Optional[str]:
        """Get the model for a score task."""
        rows = execute_query(
            "SELECT model FROM score_tasks WHERE id = %s", (task_id,))
        return rows[0]['model'] if rows else None

    @staticmethod
    def score_tasks_complete(image_id: int):
        """Complete all score tasks for an image."""
        execute_query(
            "UPDATE score_tasks SET status = 'completed', completed_at = NOW() WHERE image_id = %s",
            (image_id,), fetch=False)

    @staticmethod
    def score_tasks_fail_for_image(image_id: int, task_id: int, error_message: str):
        """Mark a specific task as failed."""
        execute_query(
            "UPDATE score_tasks SET status = 'failed', error_message = %s WHERE id = %s",
            (error_message, task_id), fetch=False)

    # ==================== daily_themes ====================

    @staticmethod
    def daily_theme_get(date_str: str) -> Optional[Dict]:
        rows = execute_query(
            "SELECT * FROM daily_themes WHERE date = %s", (date_str,))
        return rows[0] if rows else None

    @staticmethod
    def daily_theme_save(
        date_str: str, theme_title: str, theme_description: str,
        photo_count: int, avg_score: float, keywords: str,
    ):
        sql = """
            INSERT INTO daily_themes (date, theme_title, theme_description,
                                    photo_count, total_score_avg, keywords)
            VALUES (%s, %s, %s, %s, %s, %s)
            ON DUPLICATE KEY UPDATE
                theme_title = VALUES(theme_title),
                theme_description = VALUES(theme_description),
                keywords = VALUES(keywords),
                photo_count = VALUES(photo_count),
                total_score_avg = VALUES(total_score_avg)
        """
        execute_query(sql, (date_str, theme_title, theme_description,
                           photo_count, avg_score, keywords), fetch=False)

    @staticmethod
    def daily_images_get(date_str: str, limit: int = 20) -> List[Dict]:
        """Get scored images for a date, ordered by score DESC."""
        return execute_query("""
            SELECT i.id, i.filename, i.file_path, i.folder_date,
                   s.total_score, s.impact_score, s.composition_score,
                   d.description, d.tags
            FROM images i
            LEFT JOIN image_scores s ON i.id = s.image_id
            LEFT JOIN image_descriptions d ON i.id = d.image_id
            WHERE i.is_deleted = 0 AND i.folder_date = %s AND s.total_score IS NOT NULL
            ORDER BY s.total_score DESC
            LIMIT %s
        """, (date_str, limit))

    @staticmethod
    def daily_images_count(date_str: str) -> int:
        rows = execute_query(
            "SELECT COUNT(*) as cnt FROM images WHERE folder_date = %s AND is_deleted = 0",
            (date_str,))
        return rows[0]['cnt']

    @staticmethod
    def daily_avg_score(date_str: str) -> float:
        rows = execute_query(
            "SELECT AVG(total_score) as avg FROM image_scores s "
            "JOIN images i ON s.image_id = i.id AND i.is_deleted = 0 WHERE i.folder_date = %s",
            (date_str,))
        return rows[0]['avg'] or 0

    @staticmethod
    def daily_top_images(date_str: str, limit: int = 12) -> List[Dict]:
        """Top scored images for a date."""
        return execute_query("""
            SELECT i.id, i.filename, i.file_path, i.orientation,
                   s.total_score, d.description, d.tags
            FROM images i
            LEFT JOIN image_scores s ON i.id = s.image_id
            LEFT JOIN image_descriptions d ON i.id = d.image_id
            WHERE i.is_deleted = 0 AND i.folder_date = %s AND s.total_score IS NOT NULL
            ORDER BY s.total_score DESC
            LIMIT %s
        """, (date_str, limit))

    # ==================== photo_sets (captions) ====================

    @staticmethod
    def photo_sets_save(
        effective_date: str, set_type: str, cover_id: Optional[int],
        title: str, body: str, hashtags: str, image_ids_json: str,
    ):
        execute_query("""
            INSERT INTO photo_sets (date, set_type, cover_image_id, caption_title,
                                  caption_body, hashtags, image_ids)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
        """, (effective_date, set_type, cover_id, title, body, hashtags, image_ids_json), fetch=False)

    @staticmethod
    def photo_sets_count(where_sql: str, params: List) -> int:
        rows = execute_query(
            f"SELECT COUNT(*) as total FROM photo_sets WHERE {where_sql}", params if params else None)
        return rows[0]['total']

    @staticmethod
    def photo_sets_search(where_sql: str, params: List, page_size: int, offset: int) -> List[Dict]:
        return execute_query(
            f"""
            SELECT ps.*, i.file_path as cover_filename
            FROM photo_sets ps
            LEFT JOIN images i ON ps.cover_image_id = i.id AND i.is_deleted = 0
            WHERE {where_sql}
            ORDER BY ps.created_at DESC
            LIMIT %s OFFSET %s
            """,
            params + [page_size, offset])

    @staticmethod
    def photo_sets_get_by_date(date_str: str, set_type: Optional[str] = None) -> List[Dict]:
        if set_type:
            return execute_query("""
                SELECT ps.*, i.file_path as cover_filename FROM photo_sets ps
                LEFT JOIN images i ON ps.cover_image_id = i.id AND i.is_deleted = 0
                WHERE ps.date = %s AND ps.set_type = %s ORDER BY ps.created_at DESC
            """, (date_str, set_type))
        return execute_query("""
            SELECT ps.*, i.file_path as cover_filename FROM photo_sets ps
            LEFT JOIN images i ON ps.cover_image_id = i.id AND i.is_deleted = 0
            WHERE ps.date = %s ORDER BY ps.created_at DESC
        """, (date_str,))

    @staticmethod
    def photo_sets_get_theme(date_str: str) -> Optional[Dict]:
        rows = execute_query(
            "SELECT theme_title, theme_description, keywords FROM daily_themes WHERE date = %s",
            (date_str,))
        return rows[0] if rows else None

    # ==================== photo_collections ====================

    @staticmethod
    def collections_create(
        title: str, description: str, tags: str,
        theme_type: str, theme_value: str,
        photo_paths: str, photo_ids: str,
        cover_path: str, llm_model: str,
    ) -> int:
        return execute_query("""
            INSERT INTO photo_collections
                (title, description, tags, theme_type, theme_value,
                 photo_paths, photo_ids, cover_path, llm_model)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
        """, (title, description, tags, theme_type, theme_value,
              photo_paths, photo_ids, cover_path, llm_model), fetch=False)

    @staticmethod
    def collections_get_by_ids(ids: List[int]) -> List[Dict]:
        if not ids:
            return []
        placeholders = ",".join(["%s"] * len(ids))
        return execute_query(
            f"SELECT * FROM photo_collections WHERE id IN ({placeholders})", ids)

    @staticmethod
    def collections_get_detail(collection_id: int) -> Optional[Dict]:
        rows = execute_query(
            "SELECT * FROM photo_collections WHERE id = %s", (collection_id,))
        return rows[0] if rows else None

    @staticmethod
    def collections_list(page: int, page_size: int, favorite_only: bool) -> tuple:
        offset = (page - 1) * page_size
        if favorite_only:
            where = "WHERE is_favorite = 1"
        else:
            where = "WHERE is_favorite = 0"
        total_rows = execute_query(f"SELECT COUNT(*) as total FROM photo_collections {where}")
        total = total_rows[0]["total"]
        rows = execute_query(
            f"SELECT * FROM photo_collections {where} ORDER BY created_at DESC LIMIT %s OFFSET %s",
            (page_size, offset))
        return total, rows

    @staticmethod
    def collections_is_favorite(collection_id: int) -> Optional[bool]:
        rows = execute_query(
            "SELECT is_favorite FROM photo_collections WHERE id = %s", (collection_id,))
        if not rows:
            return None
        return bool(rows[0]["is_favorite"])

    @staticmethod
    def collections_toggle_favorite(collection_id: int, new_val: int, bgm_track: str = ""):
        if new_val == 1 and bgm_track:
            execute_query(
                "UPDATE photo_collections SET is_favorite = %s, bgm_track = %s WHERE id = %s",
                (new_val, bgm_track, collection_id), fetch=False)
        else:
            execute_query(
                "UPDATE photo_collections SET is_favorite = %s WHERE id = %s",
                (new_val, collection_id), fetch=False)

    @staticmethod
    def collections_update_meta(collection_id: int, title: str, description: str, tags: str):
        execute_query(
            "UPDATE photo_collections SET title=%s, description=%s, tags=%s WHERE id=%s",
            (title, description, tags, collection_id), fetch=False)

    @staticmethod
    def collections_delete(collection_id: int):
        execute_query("DELETE FROM photo_collections WHERE id = %s", (collection_id,), fetch=False)

    @staticmethod
    def collections_clear_unfavorited():
        execute_query("DELETE FROM photo_collections WHERE is_favorite = 0", fetch=False)

    # ==================== instruction_history ====================

    @staticmethod
    def instruction_history_get_all(set_type: Optional[str] = None) -> List[Dict]:
        if set_type:
            return execute_query(
                "SELECT id, instruction, set_type, created_at FROM instruction_history "
                "WHERE set_type = %s ORDER BY created_at DESC LIMIT 20",
                (set_type,))
        return execute_query(
            "SELECT id, instruction, set_type, created_at FROM instruction_history "
            "ORDER BY created_at DESC LIMIT 20")

    @staticmethod
    def instruction_history_check_duplicate(instruction: str, set_type: str) -> bool:
        rows = execute_query(
            "SELECT id FROM instruction_history WHERE TRIM(instruction) = %s AND set_type = %s LIMIT 1",
            (instruction, set_type))
        return len(rows) > 0

    @staticmethod
    def instruction_history_save(instruction: str, set_type: str):
        execute_query(
            "INSERT INTO instruction_history (instruction, set_type) VALUES (%s, %s)",
            (instruction, set_type), fetch=False)

    # ==================== models ====================

    @staticmethod
    def models_list() -> List[Dict]:
        return execute_query(
            "SELECT id, name, api_endpoint, api_key, model_name, model_type, is_default "
            "FROM models ORDER BY id")

    @staticmethod
    def models_get(model_id: int) -> Optional[Dict]:
        rows = execute_query(
            "SELECT is_default FROM models WHERE id=%s", (model_id,))
        return rows[0] if rows else None

    @staticmethod
    def models_reset_all_default():
        execute_query("UPDATE models SET is_default=0", fetch=False)

    @staticmethod
    def models_create(name: str, api_endpoint: str, api_key: str,
                      model_name: str, model_type: str, is_default: bool) -> int:
        from database import get_connection
        conn = get_connection()
        cursor = conn.cursor(dictionary=True)
        try:
            if is_default:
                cursor.execute("UPDATE models SET is_default=0")
            cursor.execute(
                "INSERT INTO models (name, api_endpoint, api_key, model_name, model_type, is_default) "
                "VALUES (%s, %s, %s, %s, %s, %s)",
                (name, api_endpoint, api_key, model_name, model_type, 1 if is_default else 0))
            conn.commit()
            row_id = cursor.lastrowid
        finally:
            cursor.close()
            conn.close()
        return row_id

    @staticmethod
    def models_update(model_id: int, updates: Dict):
        """updates: dict of column → value. Handles is_default reset if applicable."""
        if updates.get('is_default'):
            execute_query("UPDATE models SET is_default=0", fetch=False)
        if not updates:
            return
        set_parts = []
        values = []
        for col, val in updates.items():
            set_parts.append(f"{col}=%s")
            values.append(val)
        values.append(model_id)
        execute_query(
            f"UPDATE models SET {', '.join(set_parts)} WHERE id=%s",
            tuple(values), fetch=False)

    @staticmethod
    def models_delete(model_id: int):
        execute_query("DELETE FROM models WHERE id=%s", (model_id,), fetch=False)

    @staticmethod
    def models_list_chat() -> List[Dict]:
        return execute_query(
            "SELECT id, name, api_endpoint, api_key, model_name "
            "FROM models WHERE model_type='chat' ORDER BY is_default DESC, id")

    @staticmethod
    def models_get_default() -> Optional[Dict]:
        rows = execute_query(
            "SELECT id, name, api_endpoint, api_key, model_name FROM models "
            "WHERE is_default=1 AND model_type='chat' LIMIT 1")
        if not rows:
            return None
        r = rows[0]
        return {
            "id": r["id"], "name": r["name"], "api_endpoint": r["api_endpoint"],
            "api_key": r["api_key"] or "", "model_name": r["model_name"],
        }

    @staticmethod
    def models_get_endpoint(name: str) -> Optional[str]:
        rows = execute_query(
            "SELECT api_endpoint FROM models WHERE name = %s LIMIT 1", (name,))
        if rows:
            return rows[0].get('api_endpoint', '')
        return None

    @staticmethod
    def models_get_model_name(name: str) -> Optional[str]:
        rows = execute_query(
            "SELECT model_name FROM models WHERE name = %s LIMIT 1", (name,))
        if rows:
            return rows[0].get('model_name', name)
        return None

    # ==================== app_state ====================

    @staticmethod
    def app_state_get() -> Dict:
        result = execute_query(
            "SELECT last_folder_path, last_page, last_sort_by, last_sort_order, "
            "last_scroll_top, updated_at FROM app_state WHERE id = 1")
        if result:
            return result[0]
        return {"last_folder_path": None, "last_page": 1, "last_sort_by": "filename",
                "last_sort_order": "asc", "last_scroll_top": 0}

    @staticmethod
    def app_state_update(fields: List[tuple]):
        """fields: list of (column_name, value) pairs to update."""
        if not fields:
            return
        set_parts = []
        params = []
        for col, val in fields:
            set_parts.append(f"{col} = %s")
            params.append(val)
        set_parts.append("updated_at = CURRENT_TIMESTAMP")
        execute_query(
            f"UPDATE app_state SET {', '.join(set_parts)} WHERE id = 1",
            tuple(params), fetch=False)
