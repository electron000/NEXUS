"""app/utils/logger.py – Structured logger."""

import logging
import sys

def _build_logger() -> logging.Logger:
    log = logging.getLogger("nexus.intelligence-core")
    if not log.handlers:
        handler = logging.StreamHandler(sys.stdout)
        fmt = logging.Formatter(
            "%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
            datefmt="%Y-%m-%dT%H:%M:%S",
        )
        handler.setFormatter(fmt)
        log.addHandler(handler)
    log.setLevel(logging.INFO)
    return log

logger = _build_logger()
