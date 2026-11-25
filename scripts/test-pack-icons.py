"""校验内嵌图标的路径、大小限制与缓存复用。"""

import base64
import hashlib
import importlib.util
import io
import json
import tempfile
import unittest
import zipfile
from http.client import IncompleteRead
from pathlib import Path
from unittest.mock import patch

SPEC = importlib.util.spec_from_file_location("pack_icons", Path(__file__).with_name("sync-pack-icons.py"))
icons = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(icons)


class PackIconTest(unittest.TestCase):
    def test_interrupted_download_continues_to_next_pack(self):
        entries = [{"id": "example.one"}, {"id": "example.two"}]
        with tempfile.TemporaryDirectory() as directory:
            index = Path(directory)
            (index / "index.json").write_text(json.dumps({"modpacks": entries}), encoding="utf-8")
            with patch.object(icons, "INDEX", index), patch.object(
                icons, "update_pack", side_effect=[IncompleteRead(b""), None]
            ) as update:
                icons.main()
            self.assertEqual([call.args[0] for call in update.call_args_list], entries)

    def test_extract_and_reuse_verified_archive(self):
        icon = "assets/plugins/example.png"
        manifest = {"type": "dshhome", "profiles": {"one": {"plugins": {
            "demo": {"icon": icon}, "remote": {"icon": "https://example.org/a.svg"},
            "bad": {"icon": "assets/plugins/../../outside.svg"}}}}}
        self.assertEqual(icons.icon_paths(manifest), {icon})
        archive = io.BytesIO()
        with zipfile.ZipFile(archive, "w", zipfile.ZIP_DEFLATED) as z:
            z.writestr(icon, b"image")
        data = archive.getvalue()
        entry = {"size": len(data), "sha256": hashlib.sha256(data).hexdigest(), "downloadUrl": "https://example.org/p.dspack"}
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "manifest.json").write_text(json.dumps(manifest))
            with patch.object(icons, "urlopen", return_value=io.BytesIO(data)) as load:
                icons.update_pack(entry, root)
                icons.update_pack(entry, root)
                load.assert_called_once()
            cache = json.loads((root / "plugin-icons.json").read_text())
            self.assertEqual(cache["icons"][icon], "data:image/png;base64," + base64.b64encode(b"image").decode())
            with patch.object(icons, "urlopen", return_value=io.BytesIO(data)), self.assertRaises(ValueError):
                icons.update_pack({**entry, "sha256": "0" * 64}, root)
            self.assertEqual(json.loads((root / "plugin-icons.json").read_text()), cache)


if __name__ == "__main__":
    unittest.main()
