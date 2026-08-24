from contextlib import contextmanager
from html import unescape

import requests
from django.conf import settings


_GOOGLE_TRANSLATE_JSON_URL = "https://translate.googleapis.com/translate_a/single"
_MYMEMORY_TRANSLATE_URL = "https://api.mymemory.translated.net/get"


def _split_translation_text(text, max_length=450):
    chunks = []
    remaining = text
    while len(remaining) > max_length:
        split_at = remaining.rfind(" ", 0, max_length + 1)
        if split_at <= 0:
            split_at = max_length
        chunks.append(remaining[:split_at].strip())
        remaining = remaining[split_at:].strip()
    if remaining:
        chunks.append(remaining)
    return chunks


def _translate_with_mymemory(text, timeout_seconds):
    translated_chunks = []
    for chunk in _split_translation_text(text):
        response = requests.get(
            _MYMEMORY_TRANSLATE_URL,
            params={"q": chunk, "langpair": "pt|en"},
            timeout=timeout_seconds,
        )
        response.raise_for_status()
        payload = response.json()
        translated = str(
            ((payload or {}).get("responseData") or {}).get("translatedText")
            or ""
        ).strip()
        if not translated or (payload or {}).get("responseStatus") not in (None, 200):
            raise ValueError("MyMemory response contained no translation")
        translated_chunks.append(unescape(translated))
    return " ".join(translated_chunks).strip()


@contextmanager
def _requests_get_default_timeout(timeout_seconds):
    original_get = requests.get

    def get_with_timeout(*args, **kwargs):
        kwargs.setdefault("timeout", timeout_seconds)
        return original_get(*args, **kwargs)

    requests.get = get_with_timeout
    try:
        yield
    finally:
        requests.get = original_get


def translate_pt_to_en(text, timeout_seconds=None):
    from deep_translator import GoogleTranslator

    effective_timeout = timeout_seconds
    if effective_timeout is None:
        effective_timeout = getattr(
            settings,
            "TRANSLATE_PREVIEW_TIMEOUT_SECONDS",
            5,
        )

    clean_text = str(text or "").strip()
    if not clean_text:
        return ""

    # deep-translator parses Google's HTML page. That markup changes often and
    # can raise TranslationNotFound even for valid, simple input. Prefer the
    # structured response and retain the current translator as a fallback.
    try:
        response = requests.get(
            _GOOGLE_TRANSLATE_JSON_URL,
            params={
                "client": "gtx",
                "sl": "pt",
                "tl": "en",
                "dt": "t",
                "q": clean_text,
            },
            timeout=effective_timeout,
        )
        response.raise_for_status()
        payload = response.json()
        translated = "".join(
            str(part[0])
            for part in (payload[0] if payload else [])
            if isinstance(part, (list, tuple)) and part and part[0]
        ).strip()
        if translated:
            return translated
        raise ValueError("Translation response contained no text")
    except Exception:
        try:
            translated = _translate_with_mymemory(clean_text, effective_timeout)
            if translated:
                return translated
        except Exception:
            pass

    try:
        with _requests_get_default_timeout(effective_timeout):
            translated = GoogleTranslator(source="pt", target="en").translate(
                clean_text
            )
        if translated:
            return str(translated).strip()
        raise ValueError("Fallback translator returned no text")
    except Exception as exc:
        raise RuntimeError("Translation services are unavailable") from exc
