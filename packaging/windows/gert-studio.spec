from pathlib import Path

root = Path(SPECPATH).parents[1]
a = Analysis(
    [str(root / 'packaging/windows/launcher.py')],
    pathex=[str(root / 'backend')],
    datas=[(str(root / 'frontend/dist'), 'frontend/dist'),
           (str(root / 'backend/app/engine/CPYTHON-LICENSE.txt'), 'licenses'),
           (str(root / 'packaging/windows/THIRD_PARTY_NOTICES.txt'), '.')],
    hiddenimports=['uvicorn.logging', 'uvicorn.loops.asyncio',
                   'uvicorn.protocols.http.h11_impl'],
    # Optional NetworkX accelerators are unused by the existing engine.
    excludes=['pytest', 'httpx', 'numpy', 'scipy', 'matplotlib', 'pandas', 'IPython'],
    noarchive=False,
)
pyz = PYZ(a.pure)
exe = EXE(pyz, a.scripts, [], exclude_binaries=True, name='GERT Studio',
          debug=False, strip=False, upx=False, console=False,
          version=str(root / 'packaging/windows/version-info.txt'))
coll = COLLECT(exe, a.binaries, a.datas, strip=False, upx=False, name='GERT-Studio-Windows')
