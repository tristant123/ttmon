# -*- mode: python ; coding: utf-8 -*-
"""PyInstaller spec for the Japanese grammar analyzer as one executable.

    pip install -r nihongo/requirements.txt pyinstaller
    pyinstaller NihongoGrammar.spec

Produces dist/NihongoGrammar.exe on Windows (dist/NihongoGrammar elsewhere).
Double-clicking it opens the app in the browser; the console window that
comes with it is how you quit (close it).
"""

block_cipher = None

a = Analysis(
    ['nihongo_app.py'],
    pathex=[],
    binaries=[],
    # The page and the demo sample are read from disk next to the modules.
    datas=[
        ('nihongo/static/index.html', 'nihongo/static'),
        ('nihongo/demo.json', 'nihongo'),
    ],
    hiddenimports=['nihongo.server'],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=['tkinter'],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)
pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
    name='NihongoGrammar',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=True,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
