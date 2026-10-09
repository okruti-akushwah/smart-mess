import importlib, inspect, unittest
from pathlib import Path
suite=unittest.TestSuite()
for path in sorted(Path('backend').glob('test_*.py')):
 module=importlib.import_module(path.stem)
 for name,cls in inspect.getmembers(module,inspect.isclass):
  if cls.__module__ != module.__name__ or not issubclass(cls,unittest.TestCase): continue
  for method,fn in cls.__dict__.items():
   if method.startswith('test_'): suite.addTest(cls(method))
result=unittest.TextTestRunner(verbosity=2).run(suite)
raise SystemExit(not result.wasSuccessful())
