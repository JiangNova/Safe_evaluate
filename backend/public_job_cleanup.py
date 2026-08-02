"""Lifecycle cleanup for anonymous evaluation jobs and their artifacts."""

from __future__ import annotations

import logging
import os
import shutil
from datetime import datetime

from . import public_jobs
from .config import PUBLIC_JOB_STORAGE_DIR


LOGGER = logging.getLogger(__name__)


def _job_directory(job_id: str) -> str:
    root = os.path.abspath(PUBLIC_JOB_STORAGE_DIR)
    target = os.path.abspath(os.path.join(root, job_id))
    if target == root or os.path.commonpath([root, target]) != root:
        raise ValueError("public job storage path escaped its root")
    return target


def cleanup_expired_public_jobs(now: datetime | None = None) -> list[str]:
    """Remove expired job directories, then their database records.

    A record is retained when filesystem removal fails so a later cleanup pass can
    retry without leaving an untracked artifact directory behind.
    """
    removed: list[str] = []
    for job_id in public_jobs.list_expired_job_ids(now):
        try:
            directory = _job_directory(job_id)
            if os.path.isdir(directory):
                shutil.rmtree(directory)
            public_jobs.delete_jobs([job_id])
            removed.append(job_id)
        except (OSError, ValueError):
            LOGGER.exception("Could not clean expired public job %s", job_id)
    return removed
