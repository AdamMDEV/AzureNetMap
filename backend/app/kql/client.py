import logging
import time
from datetime import datetime
from typing import Any

from azure.core.exceptions import HttpResponseError
from azure.identity import DefaultAzureCredential
from azure.monitor.query import LogsQueryClient, LogsQueryStatus

logger = logging.getLogger(__name__)

_client: LogsQueryClient | None = None


def get_client() -> LogsQueryClient:
    global _client
    if _client is None:
        _client = LogsQueryClient(DefaultAzureCredential())
    return _client


def run_query(
    workspace_id: str,
    query: str,
    start: datetime,
    end: datetime,
    additional_workspaces: list[str] | None = None,
    max_retries: int = 1,
) -> list[dict[str, Any]]:
    if not workspace_id:
        logger.warning("run_query called with empty workspace_id")
        return []

    client = get_client()
    timespan = (start, end)
    attempt = 0

    while attempt <= max_retries:
        try:
            response = client.query_workspace(
                workspace_id=workspace_id,
                query=query,
                timespan=timespan,
                additional_workspaces=additional_workspaces or [],
            )
            if response.status == LogsQueryStatus.SUCCESS:
                table = response.tables[0]
                # In azure-monitor-query 1.4.0, table.columns is List[str]
                cols = list(table.columns)
                return [dict(zip(cols, row)) for row in table.rows]
            if response.partial_data:
                logger.warning("Partial LAW result: %s", response.partial_error)
                table = response.partial_data[0]
                cols = list(table.columns)
                return [dict(zip(cols, row)) for row in table.rows]
            return []
        except HttpResponseError as exc:
            if attempt < max_retries and (exc.status_code or 0) >= 500:
                logger.warning("Transient LAW error attempt %d: %s", attempt + 1, exc)
                attempt += 1
                time.sleep(1)
                continue
            logger.error("LAW query failed: %s | workspace=%s | query=%.200s", exc, workspace_id, query)
            return []
        except Exception as exc:
            logger.error("Unexpected LAW error: %s | workspace=%s | query=%.200s", exc, workspace_id, query)
            return []

    return []
