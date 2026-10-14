#!/usr/bin/env python3
"""Write test/fixtures/chunks.json from the Fallacy Lens desktop app's chunk_text, so the JS port in
src/chunk.js can be checked against the original.

Usage: python3 tools/make_fixtures.py path/to/fallacylens   (the desktop app's main script)
"""
import importlib.machinery
import importlib.util
import json
import sys
from pathlib import Path


def load(path):
    loader = importlib.machinery.SourceFileLoader("fallacylens_app", path)
    spec = importlib.util.spec_from_loader("fallacylens_app", loader)
    mod = importlib.util.module_from_spec(spec)
    loader.exec_module(mod)
    return mod


# ASCII and BMP characters only: Python offsets count code points and JS offsets count UTF-16 units,
# which agree only below U+10000. Astral characters are covered by a JS-only test.
CASES = [
    ("single", "One short paragraph that fits easily.", 200, 60),
    ("paragraphs", "\n\n".join(f"Paragraph {i} talks about topic {i} at a modest length for testing purposes."
                               for i in range(8)), 200, 60),
    ("long-paragraph", "".join(f"Sentence {i} is part of one long paragraph. " for i in range(20)).strip(), 200, 60),
    ("questions-and-quotes", " ".join(['He asked, "Is this right?" She said no.', "Wait… really?",
                                       "(It was.)", "They left!"] * 12), 150, 40),
    ("long-sentence", " ".join(f"word{i}" for i in range(150)), 200, 60),
    ("no-spaces", "~" * 500, 200, 60),
    ("crlf", "\r\n\r\n".join(f"Line paragraph {i} uses Windows line endings here." for i in range(8)), 150, 40),
    ("messy-whitespace", "\n\n   First paragraph.  \n\n\n\t Second paragraph has tabs.\t\n\n \n Third.   \n", 30, 10),
    ("empty", "", 200, 60),
    ("blank", "  \n\n \t ", 200, 60),
]


def main():
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    app = load(sys.argv[1])
    out = [{"name": name, "size": size, "overlap": overlap, "text": text,
            "chunks": app.chunk_text(text, size=size, overlap=overlap)}
           for name, text, size, overlap in CASES]
    dest = Path(__file__).resolve().parent.parent / "test/fixtures/chunks.json"
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text(json.dumps(out, indent=1, ensure_ascii=False) + "\n")
    print(f"wrote {len(out)} cases to {dest.relative_to(Path.cwd()) if dest.is_relative_to(Path.cwd()) else dest}")


if __name__ == "__main__":
    main()
