"""Download and unpack an archive without sudo, using what a bare Ubuntu already has.

A fresh WSL Ubuntu has no `unzip`, no `curl` and no `wget` (and nothing else that would
need sudo to add), but it does have `python3` and `tar`:

    python3 boxdl.py URL DESTDIR --strip 1    # download, unpack, cut one leading directory
    python3 boxdl.py URL DESTDIR              # download and unpack as-is

The format is read from the bytes, not the name: the Android SDK, the Node tarball and the
adoptium JDK all come from URLs whose last path segment says nothing about the format.
"""
import os
import shutil
import sys
import tarfile
import tempfile
import urllib.request
import zipfile


def download(url: str, path: str) -> None:
    with urllib.request.urlopen(url) as response, open(path, "wb") as out:
        shutil.copyfileobj(response, out)


def unpack(archive: str, dest: str) -> None:
    """Extracts `archive` into `dest`, whatever it is."""
    os.makedirs(dest, exist_ok=True)
    with open(archive, "rb") as f:
        head = f.read(6)
    if head.startswith(b"PK"):
        with zipfile.ZipFile(archive) as zf:
            zf.extractall(dest)
    else:
        # gzip, xz and plain tar are all `tarfile`'s business.
        with tarfile.open(archive, "r:*") as tf:
            def is_within(member, path):
                target = os.path.realpath(os.path.join(path, member.name))
                return target.startswith(os.path.realpath(path) + os.sep) or target == os.path.realpath(path)
            tf.extractall(dest, filter="data" if hasattr(tarfile, "data_filter") else None)


def main(argv: list[str]) -> None:
    if len(argv) < 3:
        raise SystemExit(__doc__)
    url, dest = argv[1], argv[2]
    strip = 0
    if "--strip" in argv:
        strip = int(argv[argv.index("--strip") + 1])

    with tempfile.TemporaryDirectory() as tmp:
        archive = os.path.join(tmp, "archive")
        download(url, archive)
        unpack(archive, tmp)

        src = tmp
        if strip:
            entries = os.listdir(tmp)
            entries = [e for e in entries if e != "archive"]
            if len(entries) == 1 and os.path.isdir(os.path.join(tmp, entries[0])):
                src = os.path.join(tmp, entries[0])
        os.makedirs(dest, exist_ok=True)
        for name in os.listdir(src):
            if name == "archive":
                continue
            target = os.path.join(dest, name)
            if os.path.isdir(target):
                shutil.rmtree(target)
            elif os.path.exists(target):
                os.remove(target)
            shutil.move(os.path.join(src, name), target)

        # zipfile does not keep the Unix mode bits, so everything inside a zip lands as 644:
        # the SDK's scripts (`sdkmanager`, `avdmanager`) and CMake's binaries (`cmake`,
        # `ninja`) then cannot be executed. Scripts are found by their `#!`, programs (the
        # ELF ones) by their magic number.
        for root, _dirs, files in os.walk(dest):
            for name in files:
                path = os.path.join(root, name)
                try:
                    with open(path, "rb") as f:
                        head = f.read(4)
                except OSError:
                    continue
                if (head.startswith(b"#!") or head.startswith(b"\x7fELF")) and not os.access(path, os.X_OK):
                    os.chmod(path, 0o755)


if __name__ == "__main__":
    main(sys.argv)
