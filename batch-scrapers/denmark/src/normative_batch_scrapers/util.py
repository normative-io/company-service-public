import asyncio
import functools
import logging
from dataclasses import dataclass
from typing import Any, AsyncIterable, Callable, Iterable, Optional, TypeVar, cast

log = logging.getLogger(__name__)

T = TypeVar("T")


async def aenumerate(ait: AsyncIterable[T]) -> AsyncIterable[tuple[int, T]]:
    """Asyncronous version of enumerate."""
    i = 0
    async for t in ait:
        yield i, t
        i += 1


TCallable = TypeVar("TCallable", bound=Callable[..., Any])


def retry_async(
    func: TCallable, nbr_of_retries: int, cooldown_in_ms: Optional[int] = None
) -> TCallable:
    @functools.wraps(func)
    async def decorated(*args, **kwargs):  # type: ignore
        for i in range(nbr_of_retries):
            try:
                return await func(*args, **kwargs)
            except:
                log.warning(f"retry nbr {i}", exc_info=True)
            if cooldown_in_ms is not None:
                await asyncio.sleep(cooldown_in_ms / 1000)
        return await func(*args, **kwargs)

    return cast(TCallable, decorated)


def coro(f):
    @functools.wraps(f)
    def wrapper(*args, **kwargs):
        return asyncio.run(f(*args, **kwargs))

    return wrapper


def batch(iterable: list[T], n: int = 1) -> Iterable[list[T]]:
    """Batch a list into a sequence of lists"""
    l = len(iterable)
    for ndx in range(0, l, n):
        yield iterable[ndx : min(ndx + n, l)]
