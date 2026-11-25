"""从已校验的整合包提取市场详情所用的归档内图标。"""

import base64
import hashlib
import json
import re
import tempfile
import zipfile
from http.client import HTTPException
from pathlib import Path
from urllib.error import URLError
from urllib.parse import urlsplit
from urllib.request import urlopen

INDEX = Path(__file__).resolve().parent.parent / "index"
TYPES = {".png": "png", ".jpg": "jpeg", ".jpeg": "jpeg", ".svg": "svg+xml", ".webp": "webp"}
MAX_ICON = 256 * 1024
MAX_ICONS = 16 * 1024 * 1024
MAX_DOWNLOAD = 512 * 1024 * 1024


def icon_paths(manifest):
    profiles = manifest.get("profiles")
    units = profiles.values() if manifest.get("type") == "dshhome" and isinstance(profiles, dict) else [manifest]
    result = set()
    for unit in units:
        plugins = unit.get("plugins") if isinstance(unit, dict) else None
        if not isinstance(plugins, dict):
            continue
        for plugin in plugins.values():
            icon = plugin.get("icon") if isinstance(plugin, dict) else None
            if not isinstance(icon, str) or not icon.startswith("assets/plugins/"):
                continue
            if (any(part in ("", ".", "..") for part in icon.split("/"))
                    or re.search(r"[\x00-\x1f\\:#?%]", icon) or Path(icon).suffix.lower() not in TYPES):
                continue
            result.add(icon)
    return result


def extract_icons(source, paths):
    result = {}
    used = 0
    with zipfile.ZipFile(source) as archive:
        for path in sorted(paths):
            info = archive.getinfo(path)
            used += info.file_size
            if info.file_size > MAX_ICON or used > MAX_ICONS:
                raise ValueError("图标超出预览大小限制")
            data = archive.read(info)
            mime = TYPES[Path(path).suffix.lower()]
            result[path] = "data:image/" + mime + ";base64," + base64.b64encode(data).decode("ascii")
    return result


def update_pack(entry, directory):
    manifest = json.loads((directory / "manifest.json").read_text(encoding="utf-8"))
    paths = icon_paths(manifest)
    cache = directory / "plugin-icons.json"
    if not paths:
        cache.unlink(missing_ok=True)
        return
    digest = entry.get("sha256", "").lower()
    if not re.fullmatch(r"[a-f0-9]{64}", digest):
        raise ValueError("缺少包 SHA-256")
    if cache.exists():
        try:
            saved = json.loads(cache.read_text(encoding="utf-8"))
        except ValueError:
            saved = {}
        if saved.get("sha256") == digest and paths == set(saved.get("icons", {})):
            return
    url = urlsplit(entry["downloadUrl"])
    if url.scheme != "https" or not url.hostname or url.username or url.password:
        raise ValueError("图标提取需要 HTTPS 包地址")
    expected_size = entry.get("size", 0)
    if expected_size > MAX_DOWNLOAD:
        raise ValueError("归档超过图标缓存大小限制")
    with tempfile.TemporaryFile() as file, urlopen(url.geturl(), timeout=30) as response:
        h = hashlib.sha256()
        size = 0
        while chunk := response.read(1024 * 1024):
            size += len(chunk)
            if size > MAX_DOWNLOAD or expected_size and size > expected_size:
                raise ValueError("归档大小异常")
            file.write(chunk)
            h.update(chunk)
        if h.hexdigest() != digest or expected_size and size != expected_size:
            raise ValueError("归档校验失败")
        images = extract_icons(file, paths)
    temp = cache.with_suffix(".tmp")
    temp.write_text(json.dumps({"sha256": digest, "icons": images}, separators=(",", ":")) + "\n", encoding="utf-8")
    temp.replace(cache)


def main():
    entries = json.loads((INDEX / "index.json").read_text(encoding="utf-8"))["modpacks"]
    for i, entry in enumerate(entries, 1):
        pack_id = entry["id"]
        if not re.fullmatch(r"[a-zA-Z0-9_-]+\.[a-zA-Z0-9_.-]+", pack_id):
            raise ValueError("索引中包含非法包标识")
        try:
            print(f"[{i}/{len(entries)}] {pack_id}", flush=True)
            update_pack(entry, INDEX / "packs" / pack_id)
        except (OSError, URLError, HTTPException, KeyError, ValueError, zipfile.BadZipFile, RuntimeError) as error:
            print(f"跳过 {pack_id} 的图标缓存：{error}", flush=True)


if __name__ == "__main__":
    main()
