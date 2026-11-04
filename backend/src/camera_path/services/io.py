"""Finish blocking I/O before allowing cancellation to start rollback."""

import asyncio


async def blocking_io(operation):
    task = asyncio.create_task(asyncio.to_thread(operation))
    try:
        return await asyncio.shield(task)
    except asyncio.CancelledError:
        await task
        raise
